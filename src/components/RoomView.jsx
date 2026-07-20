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
import ChatBox from './ChatBox';
import ImageLightbox from './ImageLightbox';
import TextEditor from './TextEditor';

export default function RoomView() {
  const { state, dispatch, send, addToast, setConfirm, toggleTheme, startLatencyCheck } = useApp();
  const { startFileSend, cancelTransfer, cleanupAllPeers, retryFileSend, broadcastToAll, sendComment, sendChat, sendClipboard, startScreenShare, sendFileShareChat, sendReadReceipt, cancelPendingSend } = useWebRTC();

  const handleCancel = useCallback((id, isPending) => {
    if (isPending) {
      cancelPendingSend(id);
      addToast('Queued send cancelled', '');
    } else {
      cancelTransfer(id);
    }
  }, [cancelTransfer, cancelPendingSend, addToast]);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef(null);
  const [roomExpiry, setRoomExpiry] = useState(900);
  const fileInputRef = useRef(null);
  const [renameFiles, setRenameFiles] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const settingsRef = useRef(null);
  const importInputRef = useRef(null);

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
        dispatch({ type: 'SET_LIGHTBOX', payload: null });
        dispatch({ type: 'SET_SHOW_EDITOR', payload: false });
        dispatch({ type: 'SET_CONFIRM', payload: null });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const active = document.activeElement;
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA' && active?.contentEditable !== 'true') {
          navigator.clipboard.read().then((items) => {
            const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile());
            if (files.length > 0) handleFiles(files);
          }).catch(() => {});
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleBroadcast();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('.search-input')?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        dispatch({ type: 'SET_SOUND_ENABLED', payload: !state.soundEnabled });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, handleFiles, handleBroadcast, state.soundEnabled]);

  useEffect(() => {
    const h = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleExportHistory = useCallback(() => {
    const data = JSON.stringify(state.received, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashshare-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('History exported', 'success');
  }, [state.received, addToast]);

  const handleImportHistory = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          data.forEach(item => dispatch({ type: 'ADD_RECEIVED', payload: item }));
          addToast(`Imported ${data.length} file(s)`, 'success');
        }
      } catch { addToast('Invalid file', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [dispatch, addToast]);

  const handleExportAudit = useCallback(() => {
    const audit = state.auditLog || [];
    const data = JSON.stringify(audit, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashshare-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Audit log exported', 'success');
  }, [state.auditLog, addToast]);

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

  const handleChatFilesDrop = useCallback((files) => {
    const fileArr = Array.from(files);
    fileArr.forEach((file, i) => startFileSend(file, null, null, null));
    fileArr.forEach(file => sendFileShareChat?.(file.name, file.size, file.type));
    addToast(`Sending ${fileArr.length} file(s) from chat`, '');
  }, [startFileSend, sendFileShareChat, addToast]);

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

function formatBitrate(bps) {
  if (!bps) return 'N/A';
  if (bps < 1000) return `${Math.round(bps)} bps`;
  if (bps < 1000000) return `${(bps / 1000).toFixed(1)} Kbps`;
  return `${(bps / 1000000).toFixed(1)} Mbps`;
}

function formatBandwidth(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
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
          <div className="speed-limit-group" title="Upload speed limit (MB/s)">
            <span className="speed-limit-label">{'\u{1F4E4}'}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.speedLimit}
              onChange={e => dispatch({ type: 'SET_SPEED_LIMIT', payload: Number(e.target.value) })}
              className="speed-limit-slider"
            />
            <span className="speed-limit-value">{state.speedLimit || '∞'} MB/s</span>
          </div>
          <div className="speed-limit-group" title="Download speed limit (MB/s)">
            <span className="speed-limit-label">{'\u{1F4E5}'}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.downloadSpeedLimit}
              onChange={e => dispatch({ type: 'SET_DOWNLOAD_SPEED_LIMIT', payload: Number(e.target.value) })}
              className="speed-limit-slider"
            />
            <span className="speed-limit-value">{state.downloadSpeedLimit || '∞'} MB/s</span>
          </div>
          {hasPeers && (
            <>
              <button onClick={() => { if (!state.clipboardSync) { addToast('Enable clipboard sync first', 'error'); return; } sendClipboard?.(); }} className="btn small" title="Share clipboard">{'\u{1F4CB}'}</button>
              <button onClick={() => startScreenShare?.()} className="btn small" title="Share screen">{'\u{1F4FA}'}</button>
            </>
          )}
          <button onClick={() => dispatch({ type: 'SET_SHOW_EDITOR', payload: !state.showEditor })} className={`btn small${state.showEditor ? ' primary' : ''}`} title="Text editor">{'\u{1F4DD}'}</button>
          <button onClick={() => setShowShortcuts(v => !v)} className="btn small" title="Keyboard shortcuts">⌨</button>
          <div className="settings-wrapper" ref={settingsRef}>
            <button onClick={() => setShowSettings(v => !v)} className="btn small" title="Settings">{'\u2699\uFE0F'}</button>
            {showSettings && (
              <div className="settings-dropdown">
                <h4>Settings</h4>
                <label className="settings-row">
                  <span>Auto theme</span>
                  <input type="checkbox" checked={state.autoTheme} onChange={e => dispatch({ type: 'SET_AUTO_THEME', payload: e.target.checked })} />
                </label>
                <label className="settings-row">
                  <span>Image compress</span>
                  <input type="checkbox" checked={state.imageCompress} onChange={e => dispatch({ type: 'SET_IMAGE_COMPRESS', payload: e.target.checked })} />
                </label>
                <label className="settings-row">
                  <span>Concurrent limit</span>
                  <select value={state.concurrentLimit} onChange={e => dispatch({ type: 'SET_CONCURRENT_LIMIT', payload: Number(e.target.value) })}>
                    {[1,2,3,5,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="settings-row">
                  <span>Auto-cleanup (days)</span>
                  <select value={state.cleanupDays} onChange={e => { const v = Number(e.target.value); dispatch({ type: 'SET_CLEANUP_DAYS', payload: v }); if (v > 0) dispatch({ type: 'CLEANUP_OLD_FILES', payload: v }); }}>
                    <option value={0}>Off</option>
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </label>
                <label className="settings-row">
                  <span>Notification sounds</span>
                  <input type="checkbox" checked={state.soundEnabled} onChange={e => dispatch({ type: 'SET_SOUND_ENABLED', payload: e.target.checked })} />
                </label>
                <div className="settings-divider" />
                <button onClick={handleExportHistory} className="btn small" style={{ width: '100%' }}>Export History</button>
                <button onClick={() => importInputRef.current?.click()} className="btn small" style={{ width: '100%', marginTop: 4 }}>Import History</button>
                <button onClick={handleExportAudit} className="btn small" style={{ width: '100%', marginTop: 4 }}>Export Audit Log</button>
                <input ref={importInputRef} type="file" accept=".json" onChange={handleImportHistory} style={{ display: 'none' }} />
              </div>
            )}
          </div>
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
          {state.latency !== null && (
            <span className={`quality-badge ${state.latency < 50 ? 'good' : state.latency < 150 ? 'fair' : 'poor'}`}>
              {state.latency < 50 ? 'Good' : state.latency < 150 ? 'Fair' : 'Poor'}
            </span>
          )}
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
          {state.networkType && <span className="network-badge" title="Connection type">{'\u{1F310}'} {state.networkType}</span>}
          {state.stats.sent > 0 || state.stats.received > 0 ? (
            <span className="stats-badge" title="Session stats">
              {'\u2191'}{state.stats.sent} {'\u2193'}{state.stats.received}
            </span>
          ) : ''}
          {(state.bandwidthTotal?.sent > 0 || state.bandwidthTotal?.received > 0) && (
            <span className="bandwidth-badge" title="Total bandwidth">
              {'\u{1F4E4}'} {formatBandwidth(state.bandwidthTotal?.sent || 0)} / {'\u{1F4E5}'} {formatBandwidth(state.bandwidthTotal?.received || 0)}
            </span>
          )}
        </span>
        <span className="feature-toggles">
          <label className="feature-toggle" title="End-to-end encryption">
            <input type="checkbox" checked={state.encryptionEnabled} onChange={e => dispatch({ type: 'SET_ENCRYPTION', payload: e.target.checked })} />
            <span>{'\u{1F512}'}</span>
          </label>
          <label className="feature-toggle" title="Clipboard sync">
            <input type="checkbox" checked={state.clipboardSync} onChange={e => dispatch({ type: 'SET_CLIPBOARD_SYNC', payload: e.target.checked })} />
            <span>{'\u{1F4CB}'}</span>
          </label>
          <label className="feature-toggle" title="Auto-accept files">
            <input type="checkbox" checked={state.autoAccept} onChange={e => dispatch({ type: 'SET_AUTO_ACCEPT', payload: e.target.checked })} />
            <span>{'\u{1F4E5}'}</span>
          </label>
          <label className="feature-toggle" title="Speed graph">
            <input type="checkbox" checked={state.showSpeedGraph} onChange={e => dispatch({ type: 'SET_SHOW_SPEED_GRAPH', payload: e.target.checked })} />
            <span>{'\u{1F4C8}'}</span>
          </label>
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
          <TransferList onCancel={handleCancel} onRetry={retryFileSend} />
        </div>
        <div className="side-panel">
          <PeerList onComment={sendComment} onSendTo={handleFilesFromUploadToPeer} />
          <ReceivedList onComment={sendComment} />
          {state.showEditor && <TextEditor onSend={(files) => handleFiles(files, null)} />}
          <ChatBox onSend={sendChat} onFilesDrop={handleChatFilesDrop} />
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

      {state.lightbox && (
        <ImageLightbox
          images={state.lightbox.images}
          startIndex={state.lightbox.startIndex || 0}
          onClose={() => dispatch({ type: 'SET_LIGHTBOX', payload: null })}
        />
      )}

      {state.showPeerInfo && (
        <div className="modal-overlay" onClick={() => dispatch({ type: 'SET_PEER_INFO', payload: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Peer Info</h3>
            <div className="peer-info-section">
              <div className="peer-info-row"><span>ID</span><span className="mono">{state.showPeerInfo.id?.slice(0, 12)}...</span></div>
              <div className="peer-info-row"><span>Status</span><span className="accent">{state.showPeerInfo.connected ? 'Connected' : 'Disconnected'}</span></div>
              <div className="peer-info-row"><span>Network</span><span>{state.networkType || 'Unknown'}</span></div>
              <div className="peer-info-row"><span>Latency</span><span>{state.latency ? `${state.latency}ms` : 'N/A'}</span></div>
              {state.peerStats?.[state.showPeerInfo.id] && (() => {
                const s = state.peerStats[state.showPeerInfo.id];
                return <>
                  <div className="peer-info-row"><span>RTT</span><span>{s.rtt !== undefined ? `${Math.round(s.rtt * 1000)}ms` : 'N/A'}</span></div>
                  <div className="peer-info-row"><span>Jitter</span><span>{s.jitter !== undefined ? `${Math.round(s.jitter * 1000)}ms` : 'N/A'}</span></div>
                  <div className="peer-info-row"><span>Packet loss</span><span className={s.packetsLost > 0 ? 'danger' : ''}>{s.packetsLost || 0}</span></div>
                  {s.availableOutgoingBitrate !== undefined && <div className="peer-info-row"><span>Out BW</span><span>{formatBitrate(s.availableOutgoingBitrate)}</span></div>}
                  {s.availableIncomingBitrate !== undefined && <div className="peer-info-row"><span>In BW</span><span>{formatBitrate(s.availableIncomingBitrate)}</span></div>}
                </>;
              })()}
            </div>
            <button onClick={() => dispatch({ type: 'SET_PEER_INFO', payload: null })} className="btn small" style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {state.contextMenu && (
        <div className="context-menu-overlay" onClick={() => dispatch({ type: 'SET_CONTEXT_MENU', payload: null })}>
          <div className="context-menu" style={{ left: state.contextMenu.x, top: state.contextMenu.y }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { window.open(state.contextMenu.item.url, '_blank'); dispatch({ type: 'SET_CONTEXT_MENU', payload: null }); }} className="context-menu-item">Open</button>
            <button onClick={() => { const a = document.createElement('a'); a.href = state.contextMenu.item.url; a.download = state.contextMenu.item.name; a.click(); dispatch({ type: 'SET_CONTEXT_MENU', payload: null }); }} className="context-menu-item">Download</button>
            <button onClick={() => { dispatch({ type: 'TOGGLE_RECEIVED_PIN', payload: { name: state.contextMenu.item.name, size: state.contextMenu.item.size } }); dispatch({ type: 'SET_CONTEXT_MENU', payload: null }); }} className="context-menu-item">
              {state.pinnedItems.includes(`${state.contextMenu.item.name}|${state.contextMenu.item.size}`) ? 'Unpin' : 'Pin'}
            </button>
            <div className="context-menu-divider" />
            <button onClick={() => { dispatch({ type: 'TRASH_ITEM', payload: { name: state.contextMenu.item.name, size: state.contextMenu.item.size } }); dispatch({ type: 'SET_CONTEXT_MENU', payload: null }); }} className="context-menu-item danger">Trash</button>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcuts-list">
              <div className="shortcut-row"><kbd>Ctrl+V</kbd><span>Paste files from clipboard</span></div>
              <div className="shortcut-row"><kbd>Ctrl+B</kbd><span>Broadcast files</span></div>
              <div className="shortcut-row"><kbd>Ctrl+F</kbd><span>Focus received file search</span></div>
              <div className="shortcut-row"><kbd>Ctrl+M</kbd><span>Toggle notification sounds</span></div>
              <div className="shortcut-row"><kbd>Escape</kbd><span>Close modals / lightbox</span></div>
              <div className="shortcut-row"><kbd>Ctrl+/</kbd><span>Show this help</span></div>
            </div>
            <button onClick={() => setShowShortcuts(false)} className="btn small" style={{ width: '100%', marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
