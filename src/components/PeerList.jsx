import { useApp } from '../context/AppContext';

export default function PeerList() {
  const { state } = useApp();
  const peers = Object.values(state.peers).filter(p => p.connected);

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
            return (
              <div key={peer.id} className="peer-item">
                <div className="peer-avatar">{initial}</div>
                <span className="peer-name">Peer {i + 1}</span>
                <span className="peer-badge">Connected</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
