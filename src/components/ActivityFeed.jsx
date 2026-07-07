import { useMemo } from 'react';
import { useApp } from '../hooks/useApp';

const ICONS = {
  'file-sent': '\u2191',
  'file-received': '\u2193',
  'peer-joined': '\u2795',
  'peer-left': '\u2796',
  'peer-connected': '\u2705',
  'peer-disconnected': '\u26A0',
  room: '\uD83C\uDFE0',
  chat: '\uD83D\uDCAC',
};

export default function ActivityFeed() {
  const { state, dispatch } = useApp();
  const { activity } = state;

  const recent = useMemo(() => activity?.slice(0, 30) || [], [activity]);

  if (!recent || recent.length === 0) return null;

  return (
    <div className="activity-feed">
      <div className="panel-header">
        <h3>Activity</h3>
        {activity?.length > 0 && (
          <button
            className="action-btn"
            onClick={() => dispatch({ type: 'CLEAR_SHARED_HISTORY' })}
            title="Clear"
            style={{ fontSize: '0.7rem' }}
          >
            {'\u2716'}
          </button>
        )}
      </div>
      <div className="activity-list">
        {recent.map(a => (
          <div key={a.id} className="activity-item">
            <span className="activity-icon">{ICONS[a.type] || '\u2022'}</span>
            <span className="activity-text">{a.text}</span>
            <span className="activity-time">{formatTimeAgo(a.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'now';
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}
