import { useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useWebRTC } from '../hooks/useWebRTC';
import FileUpload from './FileUpload';
import TransferList from './TransferList';
import PeerList from './PeerList';
import ReceivedList from './ReceivedList';

export default function RoomView() {
  const { state, dispatch, send, addToast, setConfirm } = useApp();
  const { startFileSend, cancelTransfer, cleanupAllPeers } = useWebRTC();

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(file => startFileSend(file));
  }, [startFileSend]);

  const handleLeave = () => {
    setConfirm('Leave Room', 'Are you sure you want to leave?', () => {
      send({ type: 'leave' });
      cleanupAllPeers();
      dispatch({ type: 'CLEAR_ROOM' });
      history.replaceState(null, '', '/');
    });
  };

  const copyRoomCode = useCallback(() => {
    if (!state.currentRoom) return;
    navigator.clipboard.writeText(state.currentRoom)
      .then(() => addToast('Room code copied!', 'success'))
      .catch(() => addToast('Failed to copy', 'error'));
  }, [state.currentRoom, addToast]);

  const copyShareLink = useCallback((e) => {
    e.preventDefault();
    if (!state.currentRoom) return;
    navigator.clipboard.writeText(`${location.origin}?room=${state.currentRoom}`)
      .then(() => addToast('Share link copied!', 'success'))
      .catch(() => addToast('Failed to copy link', 'error'));
  }, [state.currentRoom, addToast]);

  const peerCount = useMemo(() =>
    Object.values(state.peers).filter(p => p.connected).length,
    [state.peers]
  );
  const hasPeers = peerCount > 0;

  return (
    <div id="app" className="screen">
      <div className="app-header">
        <div className="app-header-left">
          <h2>Room</h2>
          <div className="room-code-group">
            <span className="room-code room-code-pop" onClick={copyRoomCode} title="Copy room code" key={state.currentRoom}>
              {state.currentRoom}
            </span>
            <button onClick={copyRoomCode} className="btn icon-btn" title="Copy room code">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="app-actions">
          <a href={`?room=${state.currentRoom}`} onClick={copyShareLink} className="btn small" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </a>
          <button onClick={handleLeave} className="btn small danger">Leave</button>
        </div>
      </div>

      <div className="status-bar">
        <span className={`dot${hasPeers ? ' connected' : ''}`}></span>
        <span>{hasPeers ? 'Connected - share files!' : 'Waiting for peer...'}</span>
        <span className="status-meta">{hasPeers ? `${peerCount} peer(s)` : ''}</span>
      </div>

      <div className="app-layout">
        <div className="main-panel">
          <FileUpload onFiles={handleFiles} disabled={!hasPeers} />
          <TransferList onCancel={cancelTransfer} />
        </div>
        <div className="side-panel">
          <PeerList />
          <ReceivedList />
        </div>
      </div>
    </div>
  );
}
