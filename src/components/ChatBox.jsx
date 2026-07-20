import { useState, useRef, useEffect } from 'react';
import { useApp } from '../hooks/useApp';

export default function ChatBox({ onSend, onFilesDrop }) {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

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

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0 && onFilesDrop) {
      onFilesDrop(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={`chatbox${dragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="panel-header">
        <h3>Chat</h3>
        {dragOver && <span className="drop-hint">Drop files to send</span>}
      </div>
      <div className="chatbox-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chatbox-empty">No messages yet. Say hello!</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-message${isMe(m.from) ? ' mine' : ''}`}>
            <div className={`chat-bubble${m.isClipboard ? ' is-clipboard' : ''}${m.isScreenShare ? ' is-screen-share' : ''}${m.isFileShare ? ' is-file-share' : ''}${m.isReceipt ? ' is-receipt' : ''}`}>
              {m.isReceipt ? (
                <div className="receipt-indicator">Seen</div>
              ) : (
                <>
                  <div className="chat-sender">
                    {isMe(m.from) ? 'You' : `Peer ${m.from?.slice(0, 4)}`}
                    {m.isFileShare && <span className="file-share-icon"> 📎</span>}
                  </div>
                  {m.isPreview && m.previewUrl ? (
                    <div className="chat-preview">
                      <img src={m.previewUrl} alt="" className="chat-preview-img" />
                    </div>
                  ) : m.isFileShare ? (
                    <div className="chat-file-share">
                      <span className="chat-file-icon">{getChatFileIcon(m.mimeType)}</span>
                      <span className="chat-file-name">{m.fileName}</span>
                      <span className="chat-file-size">{formatChatSize(m.fileSize)}</span>
                    </div>
                  ) : null}
                  <div className="chat-text">{m.text}</div>
                  <div className="chat-ts">{formatTime(m.ts)}</div>
                </>
              )}
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
          placeholder="Type a message or drop files..."
          className="chat-input"
          autoComplete="off"
        />
        <button className="btn small emoji-btn" onClick={() => dispatch({ type: 'SET_SHOW_EMOJI_PICKER', payload: !state.showEmojiPicker })} title="Emoji">{'\u{1F600}'}</button>
        <button onClick={handleSend} className="btn small primary chat-send-btn" disabled={!input.trim()}>
          Send
        </button>
      </div>
      {state.showEmojiPicker && (
        <EmojiPickerInline input={input} setInput={setInput} onClose={() => dispatch({ type: 'SET_SHOW_EMOJI_PICKER', payload: false })} />
      )}
    </div>
  );
}

function EmojiPickerInline({ input, setInput, onClose }) {
  const ref = useRef(null);
  const EMOJIS = ['😀','😂','🤣','😊','😎','🤩','😍','🥰','😜','🤪','👍','👎','👊','✊','🤝','🙏','💪','❤️','🧡','💛','💚','💙','💜','🔥','🎉','✨','🌟','⭐','💡','🎯','🚀','👀','💬','🔗','✅','❌','♻️'];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div className="emoji-picker-inline" ref={ref}>
      {EMOJIS.map((e, i) => (
        <button key={i} className="emoji-btn" onClick={() => { setInput((input || '') + e); onClose?.(); }}>{e}</button>
      ))}
    </div>
  );
}

function getChatFileIcon(mime) {
  if (mime?.startsWith('image/')) return '🖼️';
  if (mime?.startsWith('video/')) return '🎬';
  if (mime?.startsWith('audio/')) return '🎵';
  return '📎';
}

function formatChatSize(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
