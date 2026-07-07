import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { useWebRTC } from '../hooks/useWebRTC';
import QRCode from 'qrcode';
import FileUpload from './FileUpload';
import TransferList from './TransferList';
import PeerList from './PeerList';
import ReceivedList from './ReceivedList';
import ThemeToggle from './ThemeToggle';
import RenameDialog from './RenameDialog';
import ActivityFeed from './ActivityFeed';
import SharedHistory from './SharedHistory';

export default function RoomView() {
  const { state, dispatch, send, addToast, setConfirm, toggleTheme, startLatencyCheck } = useApp();
  const { startFileSend, cancelTransfer, cleanupAllPeers, retryFileSend, broadcastToAll, sendComment } = useWebRTC();
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef(null);
  const [roomExpiry, setRoomExpiry] = useState(900);
  const fileInputRef = useRef(null);
  const [renameFiles, setRenameFiles] = useState(null);

  useEffect(() => {
    const unsub = startLatencyCheck?.();
    return () => unsub?.();
  }, [startLatencyCheck]);

  useEffect(() => {
    if (!state.currentRoom) return;
    const sec = (state.linkExpiry || 15) * 60;
    setRoomExpiry(sec);
    const timer = setInterval(() => {
      setRoomExpiry(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.currentRoom, state.linkExpiry]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setShowQR(false);
        dispatch({ type: 'SET_CONFIRM', payload: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  useEffect(() => {
    if (showQR && state.currentRoom && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, `${location.origin}?room=${state.currentRoom}&e=${state.linkExpiry}`, {
        width: 240,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    }
  }, [showQR, state.currentRoom]);

  const handleFiles = useCallback((files, targetPeerId, customNames, note) => {
    const fileArr = Array.from(files);
    fileArr.forEach((file, i) => {
      const name = customNames?.[i];
      startFileSend(file, targetPeerId, name, note);
    });
  }, [startFileSend]);

  const handleFilesFromUpload = useCallback((files) => {
    setRenameFiles({ files, targetPeerId: null });
  }, []);

  const handleFilesFromUploadToPeer = useCallback((files, peerId) => {
    setRenameFiles({ files, targetPeerId: peerId });
  }, []);

  const handleRenameConfirm = useCallback((files, customNames, note) => {
    setRenameFiles(null);
    handleFiles(files, null, customNames, note);
  }, [handleFiles]);

  const handleRenameCancel = useCallback(() => {
    setRenameFiles(null);
  }, []);

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') files.push(item.getAsFile());
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

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
    const url = `${location.origin}?room=${state.currentRoom}&e=${state.linkExpiry}`;
    navigator.clipboard.writeText(url)
      .then(() => addToast('Share link copied!', 'success'))
      .catch(() => addToast('Failed to copy link', 'error'));
  }, [state.currentRoom, state.linkExpiry, addToast]);

  const cancelAll = useCallback(() => {
    state.transfers.forEach(t => {
      if (!t.complete && !t.error) cancelTransfer(t.id);
    });
    addToast('All transfers cancelled', '');
  }, [state.transfers, cancelTransfer, addToast]);

  const handleBroadcast = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const onBroadcastFiles = useCallback((e) => {
    if (e.target.files.length > 0) {
      broadcastToAll(e.target.files);
    }
    e.target.value = '';
  }, [broadcastToAll]);

  const activeTransfers = useMemo(() =>
    state.transfers.filter(t => !t.complete && !t.error).length,
    [state.transfers]
  );

  const peerCount = useMemo(() =>
    Object.values(state.peers).filter(p => p.connected).length,
    [state.peers]
  );
  const hasPeers = peerCount > 0;

  const expiryMinutes = Math.floor(roomExpiry / 60);
  const expirySeconds = roomExpiry % 60;
  const expiryStr = `${expiryMinutes}:${String(expirySeconds).padStart(2, '0')}`;

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
            <button onClick={() => setShowQR(true)} className="btn icon-btn" title="Show QR code">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="7" height="7"/><rect x="15" y="2" width="7" height="7"/><rect x="2" y="15" width="7" height="7"/><line x1="15" y1="15" x2="18" y2="15"/><line x1="18" y1="15" x2="18" y2="18"/><line x1="18" y1="21" x2="18" y2="22"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="app-actions">
          <ThemeToggle />
          <a href={`?room=${state.currentRoom}&e=${state.linkExpiry}`} onClick={copyShareLink} className="btn small" target="_blank" rel="noreferrer">
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
        <span className="status-meta">
          {state.latency !== null && <span className="latency-badge" title="Connection latency">{'\u231A'} {state.latency}ms</span>}
          <span className="expiry-badge" title="Room expires in">{'\u23F1'} {expiryStr}</span>
          <select
            value={state.linkExpiry}
            onChange={e => dispatch({ type: 'SET_LINK_EXPIRY', payload: Number(e.target.value) })}
            className="expiry-select"
            title="Share link expiry"
          >
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hr</option>
            <option value={360}>6 hr</option>
            <option value={1440}>24 hr</option>
          </select>
          {hasPeers ? `${peerCount} peer(s)` : ''}
          {state.stats.sent > 0 || state.stats.received > 0 ? (
            <span className="stats-badge" title="Session stats">
              {'\u2191'}{state.stats.sent} {'\u2193'}{state.stats.received}
            </span>
          ) : ''}
        </span>
      </div>

      <div className="app-layout">
        <div className="main-panel">
          <FileUpload onFiles={handleFilesFromUpload} disabled={!hasPeers} />
          {activeTransfers > 1 && (
            <div className="transfer-actions">
              <button onClick={cancelAll} className="btn small danger">Cancel All ({activeTransfers})</button>
              <button onClick={handleBroadcast} className="btn small" title="Send to all peers">Broadcast</button>
            </div>
          )}
          <TransferList onCancel={cancelTransfer} onRetry={retryFileSend} />
        </div>
        <div className="side-panel">
          <PeerList onComment={sendComment} onSendTo={handleFilesFromUploadToPeer} />
          <ReceivedList onComment={sendComment} />
          <ActivityFeed />
          <SharedHistory />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={onBroadcastFiles}
        style={{ display: 'none' }}
      />

      {renameFiles && (
        <RenameDialog
          files={renameFiles.files}
          onConfirm={handleRenameConfirm}
          onCancel={handleRenameCancel}
        />
      )}

      {showQR && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowQR(false)}>
          <div className="modal modal-center">
            <h3>Scan to Join Room</h3>
            <canvas ref={qrCanvasRef} className="qr-image" />
            <p className="qr-hint">Scan with your phone camera to join</p>
            <button onClick={() => setShowQR(false)} className="btn small">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
