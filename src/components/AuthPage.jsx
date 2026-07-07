import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ onClose }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
      onClose?.();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal auth-modal">
        <button className="modal-close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <h3>{mode === 'login' ? 'Sign In' : 'Create Account'}</h3>
        <p>{mode === 'login' ? 'Sign in to your FlashShare account' : 'Create a FlashShare account to save your profile'}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input id="displayName" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Don't have an account? <button className="link-btn" onClick={() => { setMode('signup'); setError(''); }}>Sign Up</button></>
          ) : (
            <>Already have an account? <button className="link-btn" onClick={() => { setMode('login'); setError(''); }}>Sign In</button></>
          )}
        </div>
      </div>
    </div>
  );
}
