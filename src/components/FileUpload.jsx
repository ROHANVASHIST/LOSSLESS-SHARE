import { useRef, useState } from 'react';

export default function FileUpload({ onFiles, disabled }) {
  const inputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [dragover, setDragover] = useState(false);
  const [showFolderOption, setShowFolderOption] = useState(false);

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

  const handleFolderClick = () => {
    setShowFolderOption(false);
    folderInputRef.current?.click();
  };

  return (
    <div
      className={`upload-area${disabled ? ' disabled' : ''}${dragover ? ' dragover' : ''}`}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
    >
      <div className="upload-content" onClick={() => !disabled && inputRef.current?.click()}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drop files here or click to browse</p>
        <span className="upload-hint">No quality loss &middot; All file types supported</span>
        <span className="upload-hint" style={{ marginTop: 4, fontSize: '0.75rem', opacity: 0.6 }}>
          Tip: Paste files from clipboard or use folders
        </span>
        <button
          className="btn small"
          style={{ marginTop: 10, pointerEvents: 'auto', position: 'relative', zIndex: 2 }}
          onClick={e => { e.stopPropagation(); setShowFolderOption(v => !v); }}
        >
          Upload Folder
        </button>
        {showFolderOption && (
          <div className="upload-folder-dropdown" onClick={e => e.stopPropagation()}>
            <button onClick={handleFolderClick} className="btn small">Select Folder...</button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        id="fileInput"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        id="folderInput"
        /* @ts-ignore */
        webkitdirectory=""
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
