import { useRef, useEffect, useState } from 'react';
import { useApp } from './hooks/useApp';
import Landing from './components/Landing';
import RoomView from './components/RoomView';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';

export default function App() {
  const { state } = useApp();
  const [animClass, setAnimClass] = useState('screen-enter');
  const prevScreenRef = useRef(state.screen);

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

      <div className={animClass}>
        {state.screen === 'landing' && <Landing />}
        {state.screen === 'room' && <RoomView />}
      </div>

      <Toast />
      <ConfirmDialog />
    </>
  );
}
