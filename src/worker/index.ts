/// <reference lib="webworker" />

export type {}; // このファイル自体をモジュールとして認識させることで、グローバルスコープの汚染を防ぎます。
declare const self: ServiceWorkerGlobalScope;

import { OFFLINE_FILE_SIZE_LIMIT } from '../lib/constants';
const UUID_LENGTH = 36; // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

// Extract attachment ID from filename (UUID is first 36 chars)
function extractIdFromFilename(filename: string | undefined): string | null {
    if (!filename || filename.length < UUID_LENGTH) return null;
    return filename.substring(0, UUID_LENGTH);
}

// Get MIME type from extension
function getMimeTypeFromExt(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'svg': return 'image/svg+xml';
        case 'mp3': return 'audio/mpeg';
        case 'wav': return 'audio/wav';
        case 'm4a': return 'audio/mp4';
        case 'ogg': return 'audio/ogg';
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'mov': return 'video/quicktime';
        case 'pdf': return 'application/pdf';
        case 'txt': return 'text/plain';
        case 'heic': return 'image/heic';
        case 'heif': return 'image/heif';
        default: return 'application/octet-stream';
    }
}

// Parse Range header and return start/end bytes
function parseRangeHeader(range: string | null, fileSize: number): { start: number; end: number } | null {
    if (!range || !range.startsWith('bytes=')) return null;
    
    const parts = range.replace('bytes=', '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    if (isNaN(start) || start < 0 || start >= fileSize) return null;
    
    return {
        start: start,
        end: Math.min(end, fileSize - 1)
    };
}

const OPTIMIZED_IMAGE_CACHE_NAME = 'optimized-images-v1';

self.addEventListener('fetch', (event: FetchEvent) => {
    const url = new URL(event.request.url);
    const isUploadPath = url.pathname.startsWith('/api/uploads/');
    const isNextImagePath = url.pathname.startsWith('/_next/image');
    
    // Handle original file requests (/api/uploads/)
    if (isUploadPath) {
        event.respondWith(
            (async () => {
                const filename = url.pathname.split('/').pop();
                const id = extractIdFromFilename(filename);
                const mimeType = getMimeTypeFromExt(filename || '');
                
                // 1. Cache First Strategy: Check IndexedDB first
                if (id) {
                    try {
                        const cached = await getFromIndexedDB(id);
                        if (cached && cached.blob) {
                            console.log('[SW] Serving from IDB cache:', id);
                            
                            const blob = cached.blob;
                            const cachedMimeType = cached.mimeType || mimeType;
                            const fileSize = blob.size;
                            
                            // Handle Range requests for cached files
                            const rangeHeader = event.request.headers.get('range');
                            const range = parseRangeHeader(rangeHeader, fileSize);
                            
                            if (range) {
                                // Partial content response
                                const slicedBlob = blob.slice(range.start, range.end + 1);
                                return new Response(slicedBlob, {
                                    status: 206,
                                    headers: {
                                        'Content-Type': cachedMimeType,
                                        'Content-Length': slicedBlob.size.toString(),
                                        'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
                                        'Accept-Ranges': 'bytes',
                                    }
                                });
                            } else {
                                // Full content response
                                return new Response(blob, {
                                    status: 200,
                                    headers: {
                                        'Content-Type': cachedMimeType,
                                        'Content-Length': fileSize.toString(),
                                        'Accept-Ranges': 'bytes',
                                    }
                                });
                            }
                        }
                    } catch (idbError) {
                        console.error('[SW] IDB Cache check failed', idbError);
                        // Continue to network
                    }
                }

                // 2. Network Fallback & Auto Cache
                try {
                    const response = await fetch(event.request);
                    
                    // Auto Cache if successful and small enough
                    if (response.ok && id) {
                        const clonedRes = response.clone();
                        const contentLength = response.headers.get('Content-Length');
                        const size = contentLength ? parseInt(contentLength, 10) : 0;
                        
                        if (size > 0 && size <= OFFLINE_FILE_SIZE_LIMIT) {
                            clonedRes.blob().then(async (blob) => {
                                try {
                                    await saveToIndexedDB(id, blob, mimeType, filename || '');
                                    console.log('[SW] Auto-cached to IDB:', id);
                                } catch (e) {
                                    console.error('[SW] Failed to auto-cache', e);
                                }
                            });
                        }
                    }

                    return response;
                } catch (error) {
                    console.warn('[SW] Network fetch failed', error);
                    throw error;
                }
            })()
        );
        return;
    }
    
    // Handle Next.js optimized image requests (/_next/image)
    if (isNextImagePath) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(OPTIMIZED_IMAGE_CACHE_NAME);
                
                // 1. Cache First: Check Cache API
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    console.log('[SW] Serving optimized image from Cache API:', url.href);
                    return cachedResponse;
                }
                
                // 2. Network Fallback & Cache
                try {
                    const response = await fetch(event.request);
                    
                    if (response.ok) {
                        // Clone and cache the response
                        const clonedResponse = response.clone();
                        cache.put(event.request, clonedResponse).then(() => {
                            console.log('[SW] Cached optimized image:', url.href);
                        }).catch(e => {
                            console.error('[SW] Failed to cache optimized image:', e);
                        });
                    }
                    
                    return response;
                } catch (error) {
                    console.warn('[SW] Network fetch failed for optimized image', error);
                    throw error;
                }
            })()
        );
    }
});

interface IDBRecord {
    id: string;
    blob?: Blob;
    mimeType?: string;
    lastAccessedAt: Date;
    memoId: string;
    fileName: string;
    fileSize: number;
    filePath: string;
    createdAt: Date;
    isDirty: boolean;
    isDeleted: boolean;
}

// Helper to save blob to IDB
async function saveToIndexedDB(id: string, blob: Blob, mimeType: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RinSecretaryDB');
        request.onsuccess = (event: any) => {
            const db: IDBDatabase = event.target.result;
            if (!db.objectStoreNames.contains('attachments')) {
                db.close();
                resolve(); // Silent fail if store missing
                return;
            }
            const tx = db.transaction('attachments', 'readwrite');
            const store = tx.objectStore('attachments');
            
            // We need to update existing record or ignore if not found?
            // Usually metadata exists from Sync. If not, we might be creating orphan blob.
            // But we should prioritize saving data.
            // Let's try get first to merge.
            const getReq = store.get(id);
            
            getReq.onsuccess = () => {
                const record = getReq.result as IDBRecord | undefined;
                if (record) {
                    record.blob = blob;
                    record.mimeType = mimeType; // Update mime if missing
                    record.lastAccessedAt = new Date();
                    store.put(record);
                } else {
                   // Record doesn't exist (maybe sync hasn't run yet?).
                   // We could insert partial record, but it might lack memoId etc.
                   // Safer to SKIP if no metadata exists, to avoid SyncManager issues.
                   // SyncManager creates metadata first.
                   // So if we are fetching, metadata usually exists.
                   console.warn('[SW] Metadata not found for auto-cache, skipping:', id);
                }
                resolve();
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => db.close();
        };
        request.onerror = () => reject(request.error);
    });
}

async function getFromIndexedDB(id: string): Promise<{ blob: Blob; mimeType: string } | null> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RinSecretaryDB');
        request.onblocked = () => {
            console.warn('[SW] DB open blocked by another tab');
        };
        request.onsuccess = (event: any) => {
            const db: IDBDatabase = event.target.result;
            // 他のタブ/スレッドでDBバージョンが上がった場合に即座に閉じる
            db.onversionchange = () => {
                db.close();
                console.log('[SW] DB version changed, closing connection');
            };

            if (!db.objectStoreNames.contains('attachments')) {
                db.close();
                resolve(null);
                return;
            }
            const tx = db.transaction('attachments', 'readwrite');
            const store = tx.objectStore('attachments');
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record = getReq.result as IDBRecord | undefined;
                if (record && record.blob) {
                    // Update lastAccessedAt on cache hit
                    // Note: In SW we should be careful with RW transactions on every read for perf?
                    // But LRU needs it.
                    record.lastAccessedAt = new Date();
                    store.put(record);
                    resolve({ blob: record.blob, mimeType: record.mimeType || 'application/octet-stream' });
                } else {
                    resolve(null);
                }
            };
            getReq.onerror = () => resolve(null);
            tx.oncomplete = () => db.close();
        };
        request.onerror = () => reject(request.error);
    });
}

