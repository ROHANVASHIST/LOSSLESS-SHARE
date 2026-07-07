import { useApp } from '../hooks/useApp';

export default function Toast() {
  const { state } = useApp();

  if (state.toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {state.toasts.map(t => (
        <div key={t.id} className={`toast visible ${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
