import { useState, useCallback, useEffect } from 'react';

export default function ImageLightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const current = images[idx];

  const prev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const next = useCallback(() => setIdx((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  if (!current) return null;

  return (
    <div className="lightbox-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lightbox-container">
        <button className="lightbox-close" onClick={onClose}>&times;</button>
        {images.length > 1 && (
          <>
            <button className="lightbox-nav lightbox-prev" onClick={prev}>&lsaquo;</button>
            <button className="lightbox-nav lightbox-next" onClick={next}>&rsaquo;</button>
          </>
        )}
        <div className="lightbox-content">
          <img src={current.url} alt={current.name} className="lightbox-image" />
          <div className="lightbox-info">
            <span className="lightbox-name">{current.name}</span>
            {images.length > 1 && <span className="lightbox-counter">{idx + 1} / {images.length}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
