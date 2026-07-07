import { useApp } from '../context/AppContext';

export default function TransferList({ onCancel }) {
  const { state } = useApp();
  const { transfers } = state;

  if (transfers.length === 0) return null;

  return (
    <div className="file-list">
      {transfers.map(t => (
        <div
          key={t.id}
          className={`file-card${t.complete ? ' complete' : ''}${t.error ? ' error' : ''}`}
        >
          <div className="file-info">
            <div className="file-info-left">
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
            {!t.complete && !t.error && (
              <button className="cancel-btn" onClick={() => onCancel?.(t.id)} title="Cancel transfer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          {t.complete && t.downloadUrl && (
            <div className="preview-container">
              {t.mimeType?.startsWith('image/') && (
                <img src={t.downloadUrl} alt={t.name} className="preview-img" />
              )}
              {t.mimeType?.startsWith('video/') && (
                <video src={t.downloadUrl} controls className="preview-video" />
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

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
