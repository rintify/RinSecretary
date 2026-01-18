
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
        case 'heic': return 'image/heic';
        case 'heif': return 'image/heif';
        case 'bmp': return 'image/bmp';
        case 'ico': return 'image/x-icon';
        case 'tiff':
        case 'tif': return 'image/tiff';
        case 'mp3': return 'audio/mpeg';
        case 'wav': return 'audio/wav';
        case 'm4a': return 'audio/mp4';
        case 'ogg': return 'audio/ogg';
        case 'flac': return 'audio/flac';
        case 'aac': return 'audio/aac';
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'mov': return 'video/quicktime';
        case 'avi': return 'video/x-msvideo';
        case 'mkv': return 'video/x-matroska';
        case 'pdf': return 'application/pdf';
        case 'txt': return 'text/plain';
        case 'html':
        case 'htm': return 'text/html';
        case 'css': return 'text/css';
        case 'js': return 'text/javascript';
        case 'json': return 'application/json';
        case 'xml': return 'application/xml';
        case 'zip': return 'application/zip';
        case 'rar': return 'application/vnd.rar';
        case '7z': return 'application/x-7z-compressed';
        case 'tar': return 'application/x-tar';
        case 'gz': return 'application/gzip';
        default: return 'application/octet-stream';
    }
}


/**
 * ファイル名から拡張子（ドットなし）を取得する
 * @param filename ファイル名
 * @returns 拡張子（小文字）。見つからない場合は空文字。
 */
export function getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * MIMEタイプが画像かどうかを判定する
 */
export function isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}
