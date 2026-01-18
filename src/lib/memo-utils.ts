export function extractTitle(content: string): string {
  const trimmed = content.trim();
  // Check for markdown image or link at the start: ![alt](url) or [text](url)
  // We want to capture the content inside [] as the title
  const linkMatch = trimmed.match(/^(!?\[(.*?)\]\(.*?\))/);
  
  if (linkMatch && linkMatch[2]) {
      return linkMatch[2].trim().slice(0, 30) || '無題のメモ';
  }

  const lines = content.split('\n');
  const firstLine = lines.find(line => line.trim().length > 0) || '';
  const title = firstLine.trim().slice(0, 30);
  return title || '無題のメモ';
}

export function extractThumbnail(content: string): string | null {
  const match = content.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : null;
}

/**
 * 添付ファイルのMarkdownリンクを生成する
 */
export function generateAttachmentMarkdown(fileName: string, filePath: string, mimeType: string): string {
    const isImage = mimeType.startsWith('image/');
    return isImage 
        ? `![${fileName}](${filePath})` 
        : `[${fileName}](${filePath})`;
}

import { OFFLINE_FILE_SIZE_LIMIT } from './constants';

/**
 * オフライン時のファイルサイズ制限をチェックする
 * @returns エラーメッセージ（問題ない場合はnull）
 */
export function checkOfflineFileSize(fileSize: number, isOnline: boolean): string | null {
    if (!isOnline && fileSize > OFFLINE_FILE_SIZE_LIMIT) {
        const limitMB = OFFLINE_FILE_SIZE_LIMIT / 1024 / 1024;
        return `オフライン時は${limitMB}MB以下のファイルのみ追加可能です。`;
    }
    return null;
}
