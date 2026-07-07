import { useState } from 'react';

export default function RenameDialog({ files, onConfirm, onCancel }) {
  const [names, setNames] = useState(() =>
    Array.from(files).map(f => ({ original: f.name, custom: f.name }))
  );
  const [note, setNote] = useState('');

  const handleNameChange = (idx, val) => {
    setNames(prev => prev.map((n, i) => i === idx ? { ...n, custom: val || n.original } : n));
  };

  const handleSend = () => {
    onConfirm(files, names.map(n => n.custom), note);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <h3>Prepare to Send</h3>
        <div className="rename-list">
          {names.map((n, i) => (
            <div key={i} className="rename-row">
              <span className="rename-original" title={n.original}>{n.original}</span>
              <input
                type="text"
                value={n.custom}
                onChange={e => handleNameChange(i, e.target.value)}
                className="rename-input"
                autoFocus={i === 0}
              />
            </div>
          ))}
        </div>
        <div className="rename-note">
          <label className="rename-label">Note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note about these files..."
            className="rename-textarea"
            rows={2}
          />
        </div>
        <div className="modal-actions">
          <button onClick={onCancel} className="btn small">Cancel</button>
          <button onClick={handleSend} className="btn small primary">
            Send {names.length > 1 ? `(${names.length} files)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
