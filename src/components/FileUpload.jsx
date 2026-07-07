import { useRef, useState } from 'react';

export default function FileUpload({ onFiles, disabled }) {
  const inputRef = useRef(null);
  const [dragover, setDragover] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    if (!disabled && e.dataTransfer.files.length) {
      onFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    if (e.target.files.length) {
      onFiles(e.target.files);
    }
    e.target.value = '';
  };

  return (
    <div
      className={`upload-area${disabled ? ' disabled' : ''}${dragover ? ' dragover' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
    >
      <div className="upload-content">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drop files here or click to browse</p>
        <span className="upload-hint">No quality loss &middot; All file types supported</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        id="fileInput"
        multiple
        onChange={handleChange}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
      />
    </div>
  );
}
