import { useState, useRef, useEffect } from 'react';
import { useApp } from './hooks/useApp';
import { useAuth } from './context/AuthContext';
import Landing from './components/Landing';
import RoomView from './components/RoomView';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';

export default function App() {
  const { state } = useApp();
  const { user } = useAuth();
  const [animClass, setAnimClass] = useState('screen-enter');
  const prevScreenRef = useRef(state.screen);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (prevScreenRef.current !== state.screen) {
      setAnimClass('screen-exit');
      const timer = setTimeout(() => {
        setAnimClass('screen-enter');
        prevScreenRef.current = state.screen;
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setAnimClass('screen-enter');
    }
  }, [state.screen]);

  return (
    <>
      <div className="hero-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="auth-bar">
        {user ? (
          <button className="btn small" onClick={() => setShowProfile(true)}>
            Profile
          </button>
        ) : (
          <button className="btn small" onClick={() => setShowAuth(true)}>
            Sign In
          </button>
        )}
      </div>

      <div className={animClass}>
        {state.screen === 'landing' && <Landing />}
        {state.screen === 'room' && <RoomView />}
      </div>

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfilePage onClose={() => setShowProfile(false)} />}

      <Toast />
      <ConfirmDialog />
    </>
  );
}
