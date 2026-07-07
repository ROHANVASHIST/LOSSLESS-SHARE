import { useApp } from '../context/AppContext';
import { getFileIcon, formatBytes } from '../utils/helpers';

export default function ReceivedList() {
  const { state } = useApp();

  return (
    <>
      <div className="panel-header" style={{ marginTop: 16 }}>
        <h3>Received</h3>
        <span className="badge">{state.received.length}</span>
      </div>
      <div className="received-list">
        {state.received.length === 0 ? (
          <div className="peer-placeholder">No files received yet</div>
        ) : (
          state.received.map((item, i) => {
            const ext = item.name.split('.').pop()?.toUpperCase() || 'FILE';
            return (
              <div
                key={`${item.name}-${i}`}
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
    </>
  );
}
