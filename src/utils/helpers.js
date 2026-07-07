export const FILE_ICONS = {
  image: '\u{1F5BC}',
  video: '\u{1F3AC}',
  audio: '\u{1F3B5}',
  pdf: '\u{1F4C4}',
  archive: '\u{1F4E6}',
  code: '\u{1F4BB}',
  default: '\u{1F4C4}',
};

export function getFileIcon(mime, name) {
  if (mime?.startsWith('image/')) return FILE_ICONS.image;
  if (mime?.startsWith('video/')) return FILE_ICONS.video;
  if (mime?.startsWith('audio/')) return FILE_ICONS.audio;
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return FILE_ICONS.pdf;
  if (['zip', 'gz', 'tar', 'rar', '7z'].includes(ext)) return FILE_ICONS.archive;
  if (['js', 'ts', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'html', 'css', 'json', 'xml'].includes(ext)) return FILE_ICONS.code;
  return FILE_ICONS.default;
}

export function getFileType(file) {
  if (file.type?.startsWith('image/')) return 'Image';
  if (file.type?.startsWith('video/')) return 'Video';
  if (file.type?.startsWith('audio/')) return 'Audio';
  return 'File';
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec) {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const CHUNK_SIZE = 64 * 1024;
export const MAX_BUFFERED = 1024 * 1024;
export const MAX_RECONNECT_ATTEMPTS = 5;
