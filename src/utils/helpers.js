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

export async function sha256(data) {
  const hash = await crypto.subtle.digest('SHA-256', data instanceof ArrayBuffer ? data : new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file.type?.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w <= maxWidth && h <= maxWidth) { resolve(file); return; }
      if (w > h && w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
      else if (h > maxWidth) { w *= maxWidth / h; h = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const compressed = new File([blob], file.name, { type: file.type });
        resolve(compressed);
      }, file.type, quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

const SYNTAX_LANGUAGES = {
  js: ['const', 'let', 'var', 'function', 'return', 'import', 'export', 'class', 'async', 'await', '=>'],
  py: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'async', 'await'],
  html: ['<', '>', 'div', 'span', 'class', 'id', 'href', 'src'],
  css: ['color', 'margin', 'padding', 'font', 'background', 'display', 'flex', 'grid', 'border'],
  json: ['"', '{', '}', '[', ']', ',', ':'],
};

export function highlightSyntax(code, lang) {
  const langMap = { javascript: 'js', python: 'py', html: 'html', css: 'css', json: 'json' };
  const keywords = SYNTAX_LANGUAGES[langMap[lang] || 'js'] || [];
  if (!code) return code;
  let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (lang === 'json' || lang === 'html') {
    escaped = escaped.replace(/(["'].*?["'])/g, '<span class="syn-string">$1</span>');
    if (lang === 'html') escaped = escaped.replace(/(&lt;\/?\w+[^&]*&gt;)/g, '<span class="syn-tag">$1</span>');
    return escaped;
  }
  keywords.forEach(kw => {
    escaped = escaped.replace(new RegExp(`\\b(${kw})\\b`, 'g'), '<span class="syn-kw">$1</span>');
  });
  escaped = escaped.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="syn-comment">$1</span>');
  escaped = escaped.replace(/(["'`].*?["'`])/g, '<span class="syn-string">$1</span>');
  escaped = escaped.replace(/(\b\d+\.?\d*\b)/g, '<span class="syn-number">$1</span>');
  return escaped;
}

export async function extractMetadata(file) {
  if (file.type?.startsWith('image/')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height, type: 'Image' });
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }
  if (file.type?.startsWith('video/') || file.type?.startsWith('audio/')) {
    return new Promise((resolve) => {
      const el = file.type?.startsWith('video/') ? document.createElement('video') : document.createElement('audio');
      el.onloadedmetadata = () => {
        const info = { duration: el.duration, type: file.type?.startsWith('video/') ? 'Video' : 'Audio' };
        if (file.type?.startsWith('video/')) { info.width = el.videoWidth; info.height = el.videoHeight; }
        resolve(info);
      };
      el.onerror = () => resolve(null);
      el.src = URL.createObjectURL(file);
    });
  }
  return null;
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function downloadAsZip(items, zipName = 'files.zip') {
  const JSZip = await import('jszip');
  const zip = new JSZip.default();
  for (const item of items) {
    if (item.url) {
      const blob = await fetch(item.url).then((r) => r.blob());
      zip.file(item.name, blob);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateEncryptionKey() {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

export async function deriveRoomKey(roomId) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(roomId), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('flashshare'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptChunk(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

export async function decryptChunk(data, key) {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(decrypted);
}
