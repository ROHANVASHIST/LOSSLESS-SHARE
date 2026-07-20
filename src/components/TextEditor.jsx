import { useState, useRef, useCallback } from 'react';

const LANGUAGES = [
  { id: 'text', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
];

export default function TextEditor({ onSend }) {
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('text');
  const [filename, setFilename] = useState('');
  const textareaRef = useRef(null);

  const handleSend = useCallback(() => {
    if (!code.trim()) return;
    const name = filename.trim() || `snippet.${lang === 'text' ? 'txt' : lang}`;
    const file = new File([code], name, { type: 'text/plain' });
    onSend?.([file]);
    setCode('');
    setFilename('');
  }, [code, filename, lang, onSend]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="text-editor">
      <div className="panel-header">
        <h3>Text Snippet</h3>
      </div>
      <div className="editor-toolbar">
        <input
          type="text"
          placeholder="Filename (optional)"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          className="editor-filename-input"
          autoComplete="off"
        />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="editor-lang-select"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        placeholder="Write or paste your code/text here..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
        spellCheck={false}
      />
      <div className="editor-actions">
        <span className="editor-info">{code.length} chars</span>
        <button
          className="btn small primary"
          onClick={handleSend}
          disabled={!code.trim()}
        >
          Send as File
        </button>
      </div>
    </div>
  );
}
