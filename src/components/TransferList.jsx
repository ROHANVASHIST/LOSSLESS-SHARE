import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function TransferList({ onCancel, onRetry }) {
  const { state } = useApp();
  const { transfers } = state;
  const [dragIdx, setDragIdx] = useState(null);

  if (transfers.length === 0) return null;

  const isTextFile = (mime, name) => {
    if (!name) return false;
    const ext = name.split('.').pop()?.toLowerCase();
    return mime?.startsWith('text/') || ['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'xml', 'html', 'css', 'md', 'txt', 'yaml', 'yml', 'toml', 'sh', 'bash', 'env', 'gitignore'].includes(ext);
  };

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    setDragIdx(null);
  };

  return (
    <div className="file-list">
      {transfers.map((t, idx) => (
        <div
          key={t.id}
          className={`file-card${t.complete ? ' complete' : ''}${t.error ? ' error' : ''}`}
          draggable={!t.complete && !t.error}
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={e => handleDragOver(e, idx)}
          onDrop={e => handleDrop(e, idx)}
        >
          <div className="file-info">
            <div className="file-info-left">
              {!t.complete && !t.error && (
                <span className="drag-handle" title="Drag to reorder">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
                  </svg>
                </span>
              )}
              <span className="file-icon">{t.icon}</span>
              <span className="file-name">{t.name}</span>
            </div>
            <div className="file-info-right">
              <span className="file-type-badge">{t.fileType || 'File'}</span>
              <span className="file-size">{formatSize(t.size)}</span>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${t.progress}%` }}></div>
          </div>
          <div className="file-bottom">
            <span className={`file-status ${t.direction === 'send' ? 'sending' : 'receiving'}${t.complete ? ' sent' : ''}${t.error ? ' error' : ''}`}>
              {t.status}
            </span>
            <div className="file-bottom-actions">
              {!t.complete && !t.error && (
                <button className="cancel-btn" onClick={() => onCancel?.(t.id)} title="Cancel transfer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
              {t.error && t.direction === 'send' && (
                <button className="retry-btn" onClick={() => onRetry?.(t)} title="Retry transfer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          {t.complete && t.downloadUrl && (
            <div className="preview-container">
              {t.mimeType?.startsWith('image/') && (
                <img src={t.downloadUrl} alt={t.name} className="preview-img" />
              )}
              {t.mimeType?.startsWith('video/') && (
                <video src={t.downloadUrl} controls className="preview-video" />
              )}
              {isTextFile(t.mimeType, t.name) && (
                <TextPreview url={t.downloadUrl} />
              )}
              <a href={t.downloadUrl} download={t.name} className="download-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TextPreview({ url }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(r => r.text())
      .then(t => { if (!cancelled) { setText(t.slice(0, 2000)); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="text-preview-loading">Loading preview...</div>;
  if (!text) return null;

  return (
    <pre className="text-preview"><code>{text}{text.length >= 2000 ? '\n... (truncated)' : ''}</code></pre>
  );
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
