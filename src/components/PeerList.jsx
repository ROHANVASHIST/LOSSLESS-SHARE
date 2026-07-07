import { useRef } from 'react';
import { useApp } from '../hooks/useApp';

export default function PeerList({ onComment, onSendTo }) {
  const { state } = useApp();
  const fileInputRef = useRef(null);
  const peers = Object.values(state.peers).filter(p => p.connected);

  const handleSendToPeer = (peerId) => {
    if (onSendTo) {
      const input = fileInputRef.current;
      input._peerId = peerId;
      input.click();
    }
  };

  const handleFilesSelected = (e) => {
    const files = e.target.files;
    if (files.length > 0 && onSendTo) {
      onSendTo(files, e.target._peerId);
    }
    e.target.value = '';
  };

  return (
    <>
      <div className="panel-header">
        <h3>Peers</h3>
        <span className="badge">{peers.length}</span>
      </div>
      <div className="peer-list">
        {peers.length === 0 ? (
          <div className="peer-placeholder">Waiting for peers to join...</div>
        ) : (
          peers.map((peer, i) => {
            const initial = String.fromCharCode(65 + i);
            const isTransferring = peer.transferring;
            return (
              <div key={peer.id} className={`peer-item${isTransferring ? ' transferring' : ''}`}>
                <div className="peer-avatar">{initial}</div>
                <div className="peer-info">
                  <span className="peer-name">Peer {i + 1}</span>
                  <span className={`peer-badge${isTransferring ? ' transferring-badge' : ''}`}>
                    {isTransferring ? 'Transferring' : 'Connected'}
                  </span>
                </div>
                <button className="peer-send-btn" onClick={() => handleSendToPeer(peer.id)} title="Send file to this peer">
                  {'\u2191'}
                </button>
              </div>
            );
          })
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />
    </>
  );
}
