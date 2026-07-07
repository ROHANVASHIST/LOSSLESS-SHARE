import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getFileIcon, formatBytes } from '../utils/helpers';

export default function ReceivedList({ filter = '' }) {
  const { state } = useApp();

  const filtered = useMemo(() => {
    if (!filter) return state.received;
    const q = filter.toLowerCase();
    return state.received.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.mimeType || '').toLowerCase().includes(q)
    );
  }, [state.received, filter]);

  return (
    <div className="received-list">
      {filtered.length === 0 ? (
        <div className="peer-placeholder">
          {filter ? 'No matching files' : 'No files received yet'}
        </div>
      ) : (
        filtered.map((item, i) => {
          const ext = item.name.split('.').pop()?.toUpperCase() || 'FILE';
          return (
            <div
              key={`${item.name}-${item.size}-${i}`}
              className="received-item"
              onClick={() => item.url && window.open(item.url, '_blank')}
            >
              <div className="received-item-top">
                <span className="received-item-icon">{getFileIcon(item.mimeType, item.name)}</span>
                <span className="received-item-name" title={item.name}>{item.name}</span>
                <span className="received-item-size">{formatBytes(item.size)}</span>
              </div>
              <div className="received-item-meta">
                <span className="tag">{ext}</span>
                <span>Received</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
