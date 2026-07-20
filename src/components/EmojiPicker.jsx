import { useState, useRef, useEffect } from 'react';

const EMOJIS = [
  '😀','😂','🤣','😊','😎','🤩','😍','🥰','😜','🤪',
  '👍','👎','👊','✊','🤝','🙏','💪','🖐️','👋','🤌',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','💯','🔥',
  '🎉','🎊','✨','🌟','⭐','💡','📌','🎯','🏆','🚀',
  '👀','🗣️','💬','📣','🔔','⏰','✅','❌','⚠️','♻️',
  '🎵','🎶','📷','📹','🔗','📎','📂','🗂️','📊','📈',
];

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref}>
      <div className="emoji-grid">
        {EMOJIS.map((emoji, i) => (
          <button
            key={i}
            className="emoji-btn"
            onClick={() => { onSelect?.(emoji); onClose?.(); }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
