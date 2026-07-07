import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';

const AppContext = createContext(null);

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('flashshare_history') || '[]');
  } catch { return []; }
}

function saveHistory(items) {
  try {
    localStorage.setItem('flashshare_history', JSON.stringify(items.slice(-50)));
  } catch {}
}

function loadTheme() {
  try {
    return localStorage.getItem('flashshare_theme') || 'dark';
  } catch { return 'dark'; }
}

const initialState = {
  screen: 'landing',
  wsReady: false,
  myId: null,
  currentRoom: null,
  peers: {},
  transfers: [],
  received: loadHistory(),
  toasts: [],
  confirmDialog: null,
  theme: loadTheme(),
  stats: { sent: 0, received: 0, sentBytes: 0, receivedBytes: 0 },
  latency: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_WS_READY':
      return { ...state, wsReady: action.payload };
    case 'SET_MY_ID':
      return { ...state, myId: action.payload };
    case 'SET_SCREEN':
      return { ...state, screen: action.payload };
    case 'SET_ROOM':
      return { ...state, currentRoom: action.payload, screen: 'room' };
    case 'CLEAR_ROOM':
      return { ...state, currentRoom: null, screen: 'landing', peers: {}, transfers: [], received: [] };
    case 'SET_PEERS':
      return { ...state, peers: action.payload };
    case 'ADD_TRANSFER':
      return { ...state, transfers: [...state.transfers, action.payload] };
    case 'UPDATE_TRANSFER':
      return { ...state, transfers: state.transfers.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) };
    case 'REMOVE_TRANSFER':
      return { ...state, transfers: state.transfers.filter(t => t.id !== action.payload) };
    case 'ADD_RECEIVED':
      if (state.received.find(r => r.name === action.payload.name && r.size === action.payload.size)) return state;
      const updated = [...state.received, action.payload];
      saveHistory(updated);
      return { ...state, received: updated };
    case 'CLEAR_RECEIVED':
      saveHistory([]);
      return { ...state, received: [] };
    case 'SET_THEME':
      try { localStorage.setItem('flashshare_theme', action.payload); } catch {}
      return { ...state, theme: action.payload };
    case 'UPDATE_STATS':
      return { ...state, stats: { ...state.stats, ...action.payload } };
    case 'SET_LATENCY':
      return { ...state, latency: action.payload };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case 'SET_CONFIRM':
      return { ...state, confirmDialog: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const peersRef = useRef(new Map());
  const messageHandlersRef = useRef([]);

  const addToast = useCallback((message, type = '') => {
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 3000);
  }, []);

  const setConfirm = useCallback((title, message, onConfirm) => {
    dispatch({ type: 'SET_CONFIRM', payload: { title, message, onConfirm } });
  }, []);

  const clearConfirm = useCallback(() => {
    dispatch({ type: 'SET_CONFIRM', payload: null });
  }, []);

  const toggleTheme = useCallback(() => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', payload: next });
  }, [state.theme]);

  const requestNotification = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const sendBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>' });
    }
  }, []);

  const send = useCallback((msg) => {
    if (!state.wsReady || wsRef.current?.readyState !== WebSocket.OPEN) {
      addToast('Not connected to server', 'error');
      return false;
    }
    wsRef.current.send(JSON.stringify(msg));
    return true;
  }, [state.wsReady, addToast]);

  const updatePeers = useCallback(() => {
    const plain = {};
    for (const [id, peer] of peersRef.current) {
      plain[id] = { id, connected: peer.channel?.readyState === 'open' };
    }
    dispatch({ type: 'SET_PEERS', payload: plain });
  }, []);

  const subscribe = useCallback((fn) => {
    messageHandlersRef.current.push(fn);
    return () => {
      messageHandlersRef.current = messageHandlersRef.current.filter(f => f !== fn);
    };
  }, []);

  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'connected':
        dispatch({ type: 'SET_MY_ID', payload: msg.id });
        break;
      case 'room-created':
      case 'room-joined':
        dispatch({ type: 'SET_ROOM', payload: msg.roomId });
        history.replaceState(null, '', `?room=${msg.roomId}`);
        break;
      case 'room-closed':
        dispatch({ type: 'CLEAR_ROOM' });
        history.replaceState(null, '', '/');
        addToast('Room has expired', 'error');
        break;
      case 'error':
        addToast(msg.message || 'An error occurred', 'error');
        break;
    }
    messageHandlersRef.current.forEach(fn => fn(msg));
  }, [addToast]);

  useEffect(() => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    requestNotification();
  }, [requestNotification]);

  const startLatencyCheck = useCallback(() => {
    let timer;
    const check = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const start = performance.now();
      const handler = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') {
            dispatch({ type: 'SET_LATENCY', payload: Math.round(performance.now() - start) });
          }
        } catch {}
      };
      wsRef.current.addEventListener('message', handler, { once: true });
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
      timer = setTimeout(check, 5000);
    };
    timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, []);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;
    let ws;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        dispatch({ type: 'SET_WS_READY', payload: true });
        reconnectAttemptsRef.current = 0;
        const params = new URLSearchParams(location.search);
        const room = params.get('room');
        if (room) {
          setTimeout(() => {
            send({ type: 'join', roomId: room.toUpperCase() });
          }, 300);
        }
      };

      ws.onmessage = (event) => {
        try {
          handleWsMessage(JSON.parse(event.data));
        } catch { }
      };

      ws.onclose = () => {
        dispatch({ type: 'SET_WS_READY', payload: false });
        tryReconnect();
      };

      ws.onerror = () => {
        addToast('Connection error. Retrying...', 'error');
      };
    }

    function tryReconnect() {
      if (reconnectTimerRef.current) return;
      if (reconnectAttemptsRef.current >= 5) {
        addToast('Could not reconnect. Please refresh.', 'error');
        return;
      }
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
      addToast(`Reconnecting in ${Math.round(delay / 1000)}s...`, '');
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  return (
    <AppContext.Provider value={{
      state, dispatch, send, addToast, setConfirm, clearConfirm,
      updatePeers, peersRef, wsRef, subscribe, handleWsMessage,
      toggleTheme, requestNotification, sendBrowserNotification,
      startLatencyCheck,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
