import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatBytes } from '../utils/helpers';

export default function SharedHistory() {
  const { state, dispatch } = useApp();
  const { sharedHistory } = state;

  const recent = useMemo(() => (sharedHistory || []).slice(0, 50), [sharedHistory]);

  if (!recent || recent.length === 0) return null;

  return (
    <div className="shared-history">
      <div className="panel-header">
        <h3>Shared History</h3>
        <button
          className="action-btn"
          onClick={() => dispatch({ type: 'CLEAR_SHARED_HISTORY' })}
          title="Clear history"
          style={{ fontSize: '0.7rem' }}
        >
          {'\u2716'}
        </button>
      </div>
      <div className="shared-history-list">
        {recent.map(h => (
          <div key={h.id} className="shared-history-item">
            <span className="shared-history-icon">{h.type === 'sent' ? '\u2191' : '\u2193'}</span>
            <div className="shared-history-info">
              <span className="shared-history-name">{h.name}</span>
              <span className="shared-history-size">{formatBytes(h.size)}</span>
            </div>
            <span className="shared-history-time">{formatHistoryTime(h.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHistoryTime(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
