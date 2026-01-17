
const OFFLINE_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

self.addEventListener('fetch', (event) => {
    // Check if it's a file upload/download URL
    // URL pattern: /api/uploads/<ID>.<EXT>
    const url = new URL(event.request.url);
    
    if (url.pathname.startsWith('/api/uploads/')) {
        event.respondWith(
            (async () => {
                // 1. Fetch from network
                try {
                    const response = await fetch(event.request);
                    
                    // If response is not OK, return it
                    if (!response.ok) return response;

                    // 2. Clone response for caching
                    const responseClone = response.clone();
                    
                    // 3. Process in background (don't block response)
                    // We can't await this if we want to return response fast, 
                    // but respondWith expects a Promise for response.
                    // We can return response immediately, but we need to READ the body of the CLONE.
                    
                    const contentLength = response.headers.get('content-length');
                    const size = contentLength ? parseInt(contentLength, 10) : 0;
                    
                    if (size > 0 && size <= OFFLINE_FILE_SIZE_LIMIT) {
                         // Extract ID from filename
                         // Path: /api/uploads/{id}.{ext}
                         const filename = url.pathname.split('/').pop();
                         if (filename) {
                             const id = filename.split('.')[0];
                             
                             // Read blob from clone
                             responseClone.blob().then(blob => {
                                 cacheToIndexedDB(id, blob).catch(e => 
                                     console.warn('[SW] Failed to cache file', filename, e)
                                 );
                             });
                         }
                    }
                    
                    return response;
                } catch (error) {
                    console.warn('[SW] Network fetch failed, attempting cache fallback...', error);
                    
                    // Fallback to IDB
                    try {
                         const filename = url.pathname.split('/').pop();
                         if (filename) {
                             const id = filename.split('.')[0];
                             const cachedBlob = await getFromIndexedDB(id);
                             if (cachedBlob) {
                                 console.log('[SW] Serving from IDB cache:', id);
                                 return new Response(cachedBlob, {
                                     status: 200,
                                     headers: { 'Content-Type': 'application/octet-stream' } // Ideal: store mimeType too
                                 });
                             }
                         }
                    } catch (idbError) {
                        console.error('[SW] IDB Fallback failed', idbError);
                    }
                    
                    // If no cache, propagate error
                    throw error;
                }
            })()
        );
    }
});

async function getFromIndexedDB(id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RinSecretaryDB');
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('attachments')) {
                resolve(null);
                return;
            }
            const tx = db.transaction('attachments', 'readonly');
            const store = tx.objectStore('attachments');
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                resolve(getReq.result?.blob || null);
            };
            getReq.onerror = () => resolve(null);
        };
        request.onerror = () => reject(request.error);
    });
}

async function cacheToIndexedDB(id, blob) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RinSecretaryDB'); // Version logic is tricky if strict
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('attachments')) {
                resolve(); // No store?
                return;
            }
            
            const tx = db.transaction('attachments', 'readwrite');
            const store = tx.objectStore('attachments');
            
            const getReq = store.get(id);
            
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    // Update blob
                    record.blob = blob;
                    record.lastAccessedAt = new Date();
                    store.put(record);
                    console.log('[SW] Automatically cached file:', id);
                }
            };
            
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        };
        
        request.onerror = () => reject(request.error);
    });
}
