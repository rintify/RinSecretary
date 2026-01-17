/// <reference lib="webworker" />


declare const self: ServiceWorkerGlobalScope;

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

self.addEventListener('fetch', (event: FetchEvent) => {
    const url = new URL(event.request.url);
    
    if (url.pathname.startsWith('/api/uploads/')) {
        event.respondWith(
            (async () => {
                const filename = url.pathname.split('/').pop();
                const id = extractIdFromFilename(filename);
                const mimeType = getMimeTypeFromExt(filename || '');
                
                // ネットワークからの取得を試行（キャッシュは行わない。手動キャッシュボタンで対応）
                try {
                    const response = await fetch(event.request);
                    return response;
                } catch (error) {
                    console.warn('[SW] Network fetch failed, attempting cache fallback...', error);
                    
                    // 2. Fallback to IndexedDB cache
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
                            console.error('[SW] IDB Fallback failed', idbError);
                        }
                    }
                    
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

