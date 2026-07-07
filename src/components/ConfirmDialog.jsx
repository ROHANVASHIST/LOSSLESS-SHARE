import { useApp } from '../context/AppContext';

export default function ConfirmDialog() {
  const { state, clearConfirm } = useApp();
  const dialog = state.confirmDialog;

  if (!dialog) return null;

  const handleConfirm = () => {
    dialog.onConfirm?.();
    clearConfirm();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && clearConfirm()}>
      <div className="modal">
        <h3>{dialog.title}</h3>
        <p>{dialog.message}</p>
        <div className="modal-actions">
          <button onClick={clearConfirm} className="btn small">Cancel</button>
          <button onClick={handleConfirm} className="btn small primary">Confirm</button>
        </div>
      </div>
    </div>
  );
}
