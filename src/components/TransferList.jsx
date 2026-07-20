import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { highlightSyntax } from '../utils/helpers';
import SpeedGraph from './SpeedGraph';

export default function TransferList({ onCancel, onRetry }) {
  const { state, dispatch } = useApp();
  const { transfers } = state;
  const [dragIdx, setDragIdx] = useState(null);

  const filtered = useMemo(() => {
    let list = transfers;
    const pendingItems = (state.pendingSends || []).map(p => ({
      id: p.id,
      name: p.name,
      size: p.size,
      direction: 'send',
      progress: 0,
      status: 'Queued',
      icon: '\u23F3',
      complete: false,
      error: false,
      pending: true,
      startTime: p.addedAt,
    }));
    list = [...pendingItems, ...list];
    if (state.transferStatusFilter === 'active') {
      list = list.filter(t => !t.complete && !t.error);
    } else if (state.transferStatusFilter === 'completed') {
      list = list.filter(t => t.complete);
    } else if (state.transferStatusFilter === 'failed') {
      list = list.filter(t => t.error);
    }
    if (state.transferSearch) {
      const q = state.transferSearch.toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q));
    }
    return list;
  }, [transfers, state.pendingSends, state.transferSearch, state.transferStatusFilter]);

  if (transfers.length === 0) return null;

  const isTextFile = (mime, name) => {
    if (!name) return false;
    const ext = name.split('.').pop()?.toLowerCase();
    return mime?.startsWith('text/') || ['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'xml', 'html', 'css', 'md', 'txt', 'yaml', 'yml', 'toml', 'sh', 'bash', 'env', 'gitignore'].includes(ext);
  };

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      dispatch({ type: 'MOVE_TRANSFER', payload: { from: dragIdx, to: idx } });
    }
    setDragIdx(null);
  };

  return (
    <div className="file-list">
      {transfers.length > 1 && (
        <div className="transfer-search-bar">
          <div className="transfer-filter-tabs">
            {['all', 'active', 'completed', 'failed'].map(f => (
              <button
                key={f}
                className={`tab-btn small ${state.transferStatusFilter === f ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_TRANSFER_STATUS_FILTER', payload: f })}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search transfers..."
            value={state.transferSearch}
            onChange={e => dispatch({ type: 'SET_TRANSFER_SEARCH', payload: e.target.value })}
            className="search-input"
            autoComplete="off"
          />
        </div>
      )}
      {state.showSpeedGraph && <SpeedGraph />}
      {filtered.length === 0 && (
        <div className="peer-placeholder">
          {state.transferSearch ? 'No matching transfers' : state.transferStatusFilter === 'active' ? 'No active transfers' : state.transferStatusFilter === 'completed' ? 'No completed transfers' : state.transferStatusFilter === 'failed' ? 'No failed transfers' : 'No transfers yet'}
        </div>
      )}
      {filtered.map((t, idx) => (
        <div
          key={t.id}
          className={`file-card${t.complete ? ' complete' : ''}${t.error ? ' error' : ''}${t.hashValid === false ? ' hash-error' : ''}${dragIdx === idx ? ' dragging' : ''}`}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={e => handleDragOver(e, idx)}
          onDrop={e => handleDrop(e, idx)}
          onDragEnd={() => setDragIdx(null)}
        >
          <div className="file-info">
            <div className="file-info-left">
              <span className="file-icon">{t.icon}</span>
              <span className="file-name">{t.name}</span>
              {t.fileHash && t.complete && (
                <span className={`hash-badge ${t.hashValid ? 'valid' : 'invalid'}`} title={`SHA-256: ${t.fileHash}`}>
                  {t.hashValid ? '✓' : '✗'}
                </span>
              )}
            </div>
            <div className="file-info-right">
              <span className="file-type-badge">{t.fileType || 'File'}</span>
              <span className="file-size">{formatSize(t.size)}</span>
              {t.startTime && <span className="file-time">{formatTime(t.startTime)}</span>}
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${t.progress}%` }}></div>
          </div>
          <div className="file-bottom">
            <span className={`file-status ${t.direction === 'send' ? 'sending' : 'receiving'}${t.complete ? ' sent' : ''}${t.error ? ' error' : ''}${t.hashValid === false ? ' hash-error' : ''}`}>
              {t.status}
              {t.complete && t.startTime && t.completedTime && (
                <span className="file-duration"> ({formatDuration(t.completedTime - t.startTime)})</span>
              )}
            </span>
            <div className="file-bottom-actions">
              {!t.complete && !t.error && (
                <button className="cancel-btn" onClick={() => onCancel?.(t.id)} title="Cancel transfer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
          {t.pending && (
            <button className="cancel-btn" onClick={() => onCancel?.(t.id, true)} title="Cancel queued send">
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
                <img src={t.downloadUrl} alt={t.name} className="preview-img"
                  onClick={() => dispatch({ type: 'SET_LIGHTBOX', payload: { images: transfers.filter(t2 => t2.complete && t2.downloadUrl && t2.mimeType?.startsWith('image/')).map(t2 => ({ url: t2.downloadUrl, name: t2.name })), startIndex: transfers.filter(t2 => t2.complete && t2.downloadUrl && t2.mimeType?.startsWith('image/')).findIndex(t2 => t2.id === t.id) } })}
                  style={{ cursor: 'pointer' }}
                />
              )}
              {t.mimeType?.startsWith('video/') && (
                <video src={t.downloadUrl} controls className="preview-video" />
              )}
              {t.mimeType?.startsWith('audio/') && (
                <audio src={t.downloadUrl} controls className="preview-audio" />
              )}
              {isTextFile(t.mimeType, t.name) && (
                <TextPreview url={t.downloadUrl} name={t.name} />
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

function TextPreview({ url, name }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);
  const lang = name?.split('.').pop()?.toLowerCase();

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

  const langMap = { js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', py: 'python', html: 'html', css: 'css', json: 'json', xml: 'html', md: 'markdown', sh: 'bash', bash: 'bash' };
  const detected = langMap[lang] || 'text';

  return (
    <pre className="text-preview syntax-highlighted">
      <code dangerouslySetInnerHTML={{ __html: highlightSyntax(text, detected) }} />
      {text.length >= 2000 ? '\n... (truncated)' : ''}
    </pre>
  );
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
  if (!ms) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}
