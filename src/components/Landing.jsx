import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { generateRoomId } from '../utils/helpers';

export default function Landing() {
  const { send, addToast, state, dispatch } = useApp();
  const [roomCode, setRoomCode] = useState('');

  const isConnected = state.wsReady;

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const e = p.get('e');
    if (e) dispatch({ type: 'SET_LINK_EXPIRY', payload: Math.max(1, Math.min(1440, Number(e) || 60)) });
  }, [dispatch]);

  const handleCreate = () => {
    if (!isConnected) {
      addToast('Connecting to server...', 'error');
      return;
    }
    const id = generateRoomId();
    send({ type: 'create', roomId: id, expiry: state.linkExpiry });
  };

  const handleJoin = () => {
    if (!isConnected) {
      addToast('Connecting to server...', 'error');
      return;
    }
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      addToast('Please enter a room code', 'error');
      return;
    }
    if (code.length !== 6) {
      addToast('Room code must be 6 characters', 'error');
      return;
    }
    send({ type: 'join', roomId: code });
  };

  return (
    <div className="hero-content">
      <div className="hero-badge">
        <span className={`dot ${isConnected ? 'connected' : 'connecting'}`} style={{ width: 8, height: 8, display: 'inline-block', flexShrink: 0 }}></span>
        {isConnected ? 'Connected' : 'Connecting...'}
      </div>
      <h1 className="hero-title">
        Share files <span className="gradient-text">without limits</span>.
      </h1>
      <p className="hero-subtitle">
        Direct peer-to-peer transfer. No uploads to cloud. No quality loss.
        Just fast, private sharing for any file type.
      </p>

      <div className="hero-actions">
        <div className="card create-card">
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"/><path d="M5 12h14"/>
            </svg>
          </div>
          <h3>Create Room</h3>
          <p>Start a room and share the code to receive files instantly.</p>
          <button onClick={handleCreate} className="btn primary" disabled={!isConnected}>
            {!isConnected ? 'Connecting...' : 'Create Room'}
          </button>
        </div>

        <div className="card join-card">
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </div>
          <h3>Join Room</h3>
          <p>Have a room code? Enter it to connect and start sharing.</p>
          <input
            type="text"
            placeholder="Room code"
            maxLength={6}
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoComplete="off"
            style={{ textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'center', fontWeight: 700 }}
          />
          <button onClick={handleJoin} className="btn" disabled={!isConnected}>
            {!isConnected ? 'Connecting...' : 'Join Room'}
          </button>
        </div>
      </div>

      <div className="hero-features">
        <div className="feature-pill"><span className="feature-emoji">{'\u{1F5BC}'}</span> Lossless</div>
        <div className="feature-pill"><span className="feature-emoji">{'\u26A1'}</span> Direct P2P</div>
        <div className="feature-pill"><span className="feature-emoji">{'\u{1F512}'}</span> Private</div>
        <div className="feature-pill"><span className="feature-emoji">{'\u{1F4F1}'}</span> All Devices</div>
        <div className="feature-pill"><span className="feature-emoji">{'\u{1F4C1}'}</span> Any File Type</div>
      </div>
    </div>
  );
}
