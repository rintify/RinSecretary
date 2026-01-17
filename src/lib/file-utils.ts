
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
}

export function generateServerFilename(id: string, originalName: string): string {
    const ext = getFileExtension(originalName);
    return `${id}${ext}`;
}

export function getMimeTypeFromExt(filename: string): string {
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
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'pdf': return 'application/pdf';
        case 'txt': return 'text/plain';
        default: return 'application/octet-stream';
    }
}
