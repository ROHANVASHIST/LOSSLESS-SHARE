import { useState, useRef, useEffect } from 'react';
import { useApp } from '../hooks/useApp';

export default function ChatBox({ onSend }) {
  const { state } = useApp();
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  const messages = state.chatMessages || [];

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend?.(input);
    setInput('');
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMe = (from) => from === state.myId;

  return (
    <div className="chatbox">
      <div className="panel-header">
        <h3>Chat</h3>
      </div>
      <div className="chatbox-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chatbox-empty">No messages yet. Say hello!</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-message${isMe(m.from) ? ' mine' : ''}`}>
            <div className="chat-bubble">
              <div className="chat-sender">{isMe(m.from) ? 'You' : `Peer ${m.from?.slice(0, 4)}`}</div>
              <div className="chat-text">{m.text}</div>
              <div className="chat-ts">{formatTime(m.ts)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="chatbox-input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type a message..."
          className="chat-input"
          autoComplete="off"
        />
        <button onClick={handleSend} className="btn small primary chat-send-btn" disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
