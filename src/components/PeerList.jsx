import { useRef, useState } from 'react';
import { useApp } from '../hooks/useApp';

export default function PeerList({ onComment, onSendTo }) {
  const { state } = useApp();
  const fileInputRef = useRef(null);
  const peers = Object.values(state.peers).filter(p => p.connected);
  const [dragOverPeer, setDragOverPeer] = useState(null);

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

  const handleDragOver = (e, peerId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPeer(peerId);
  };

  const handleDragLeave = (e, peerId) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverPeer === peerId) setDragOverPeer(null);
  };

  const handleDrop = (e, peerId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPeer(null);
    const files = e.dataTransfer.files;
    if (files.length > 0 && onSendTo) {
      onSendTo(files, peerId);
    }
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
            const peerTransfers = state.transfers.filter(t => t.fromPeer === peer.id && !t.complete && !t.error);
            const peerTransferNames = peerTransfers.map(t => t.name).join(', ');
            const isDragOver = dragOverPeer === peer.id;
            const stats = state.peerStats?.[peer.id];
            return (
              <div
                key={peer.id}
                className={`peer-item${isTransferring ? ' transferring' : ''}${isDragOver ? ' drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, peer.id)}
                onDragLeave={e => handleDragLeave(e, peer.id)}
                onDrop={e => handleDrop(e, peer.id)}
              >
                <div className="peer-avatar">{initial}</div>
                <div className="peer-info">
                  <span className="peer-name">Peer {i + 1}</span>
                  <span className={`peer-badge${isTransferring ? ' transferring-badge' : ''}`}>
                    {isTransferring ? 'Transferring' : 'Connected'}
                    {peerTransfers.length > 0 && <span className="peer-transfer-count"> ({peerTransfers.length})</span>}
                  </span>
                  {peerTransferNames && <span className="peer-transfer-names" title={peerTransferNames}>{peerTransferNames.slice(0, 30)}{peerTransferNames.length > 30 ? '...' : ''}</span>}
                  {stats && stats.rtt !== undefined && (
                    <span className="peer-stats-row">
                      {stats.rtt !== undefined && <span className={`peer-rtt ${stats.rtt < 0.05 ? 'good' : stats.rtt < 0.15 ? 'fair' : 'poor'}`}>{Math.round(stats.rtt * 1000)}ms</span>}
                      {stats.packetsLost > 0 && <span className="peer-packet-loss">{'\u26A0'}{stats.packetsLost}</span>}
                    </span>
                  )}
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
