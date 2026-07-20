import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { setSoundEnabled } from '../utils/sound';

export const AppContext = createContext(null);

const TAG_COLORS = ['#4aa3ff', '#22c997', '#f5c542', '#ff4f6e', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem('flashshare_history') || '[]');
    return raw.map(item => ({
      ...item,
      tags: item.tags || [],
      favorite: item.favorite || false,
      trashed: item.trashed || false,
      trashedAt: item.trashedAt || null,
      receivedAt: item.receivedAt || Date.now(),
    }));
  } catch { return []; }
}

function saveHistory(items) {
  try {
    localStorage.setItem('flashshare_history', JSON.stringify(items.slice(-100)));
  } catch {}
}

function loadTags() {
  try {
    return JSON.parse(localStorage.getItem('flashshare_tags') || '[]');
  } catch { return []; }
}

function saveTags(tags) {
  try { localStorage.setItem('flashshare_tags', JSON.stringify(tags)); } catch {}
}

function loadTheme() {
  try { return localStorage.getItem('flashshare_theme') || 'dark'; } catch { return 'dark'; }
}

const initialState = {
  screen: 'landing',
  wsReady: false,
  myId: null,
  currentRoom: null,
  roomPassword: '',
  peers: {},
  peerStats: {},
  transfers: [],
  pendingSends: [],
  transferSearch: '',
  received: loadHistory(),
  tags: loadTags(),
  toasts: [],
  confirmDialog: null,
  theme: loadTheme(),
  autoTheme: false,
  stats: { sent: 0, received: 0, sentBytes: 0, receivedBytes: 0 },
  latency: null,
  networkType: null,
  viewMode: 'received',
  searchQuery: '',
  searchType: '',
  searchTag: '',
  sortBy: 'date-desc',
  galleryView: false,
  transferStatusFilter: 'all',
  bulkMode: false,
  bulkSelected: [],
  activity: [],
  sharedHistory: [],
  pendingRename: null,
  linkExpiry: 60,
  chatMessages: [],
  speedLimit: 0,
  downloadSpeedLimit: 0,
  concurrentLimit: 3,
  encryptionEnabled: false,
  clipboardSync: false,
  autoAccept: false,
  textSnippets: [],
  lightbox: null,
  showEditor: false,
  imageCompress: false,
  cleanupDays: 0,
  showSpeedGraph: false,
  showEmojiPicker: false,
  soundEnabled: true,
  pinnedItems: [],
  bandwidthTotal: { sent: 0, received: 0 },
  showPeerInfo: null,
  contextMenu: null,
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
    case 'SET_PENDING_SENDS':
      return { ...state, pendingSends: action.payload };
    case 'UPDATE_TRANSFER':
      return { ...state, transfers: state.transfers.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) };
    case 'MOVE_TRANSFER': {
      const t = [...state.transfers];
      const [from, to] = [action.payload.from, action.payload.to];
      if (from >= 0 && from < t.length && to >= 0 && to < t.length) {
        const [item] = t.splice(from, 1);
        t.splice(to, 0, item);
      }
      return { ...state, transfers: t };
    }
    case 'REMOVE_TRANSFER':
      return { ...state, transfers: state.transfers.filter(t => t.id !== action.payload) };
    case 'ADD_RECEIVED': {
      let name = action.payload.name;
      const existing = state.received.filter(r => r.name === name && !r.trashed);
      if (existing.length > 0) {
        const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
        const base = ext ? name.slice(0, -ext.length) : name;
        name = `${base}_v${existing.length + 1}${ext}`;
      }
      const ext = (name.split('.').pop() || '').toLowerCase();
      const AUTO_TAG_DEFS = { image: { name: 'Image', color: '#4aa3ff' }, video: { name: 'Video', color: '#22c997' }, audio: { name: 'Audio', color: '#f5c542' }, pdf: { name: 'Document', color: '#ff4f6e' }, doc: { name: 'Document', color: '#ff4f6e' }, docx: { name: 'Document', color: '#ff4f6e' }, zip: { name: 'Archive', color: '#a855f7' }, rar: { name: 'Archive', color: '#a855f7' }, '7z': { name: 'Archive', color: '#a855f7' }, js: { name: 'Code', color: '#f97316' }, ts: { name: 'Code', color: '#f97316' }, py: { name: 'Code', color: '#f97316' }, java: { name: 'Code', color: '#f97316' }, html: { name: 'Code', color: '#f97316' }, css: { name: 'Code', color: '#f97316' }, json: { name: 'Code', color: '#f97316' } };
      const autoTag = AUTO_TAG_DEFS[ext] || null;
      let autoTagId = null;
      if (autoTag) {
        const existingTag = state.tags.find(t => t.name === autoTag.name);
        if (existingTag) { autoTagId = existingTag.id; }
      }
      const tags = autoTagId ? [autoTagId] : [];
      const withMeta = { ...action.payload, name, tags, favorite: false, trashed: false, trashedAt: null, receivedAt: Date.now(), comments: [], note: action.payload.note || '', pinned: false, metadata: null };
      const updated = [...state.received, withMeta];
      saveHistory(updated);
      return { ...state, received: updated };
    }
    case 'CLEAR_RECEIVED':
      saveHistory([]);
      return { ...state, received: [] };
    case 'TOGGLE_FAVORITE': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, favorite: !item.favorite } : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'SET_TAGS': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, tags: action.payload.tags } : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'TRASH_ITEM': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, trashed: true, trashedAt: Date.now() } : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'RESTORE_ITEM': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, trashed: false, trashedAt: null } : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'EMPTY_TRASH': {
      const r = state.received.filter(item => !item.trashed);
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'PERMANENT_DELETE': {
      const r = state.received.filter(item =>
        !(item.name === action.payload.name && item.size === action.payload.size)
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'BULK_TRASH': {
      const names = new Set(action.payload.map(p => `${p.name}|${p.size}`));
      const r = state.received.map(item =>
        names.has(`${item.name}|${item.size}`) ? { ...item, trashed: true, trashedAt: Date.now() } : item
      );
      saveHistory(r);
      return { ...state, received: r, bulkSelected: [], bulkMode: false };
    }
    case 'BULK_RESTORE': {
      const names = new Set(action.payload.map(p => `${p.name}|${p.size}`));
      const r = state.received.map(item =>
        names.has(`${item.name}|${item.size}`) ? { ...item, trashed: false, trashedAt: null } : item
      );
      saveHistory(r);
      return { ...state, received: r, bulkSelected: [], bulkMode: false };
    }
    case 'BULK_TAG': {
      const names = new Set(action.payload.items.map(p => `${p.name}|${p.size}`));
      const r = state.received.map(item =>
        names.has(`${item.name}|${item.size}`) ? { ...item, tags: action.payload.tag } : item
      );
      saveHistory(r);
      return { ...state, received: r, bulkSelected: [], bulkMode: false };
    }
    case 'BULK_FAVORITE': {
      const names = new Set(action.payload.map(p => `${p.name}|${p.size}`));
      const r = state.received.map(item =>
        names.has(`${item.name}|${item.size}`) ? { ...item, favorite: true } : item
      );
      saveHistory(r);
      return { ...state, received: r, bulkSelected: [], bulkMode: false };
    }
    case 'ADD_TAG_DEF': {
      const t = [...state.tags, { ...action.payload, id: Date.now() + Math.random() }];
      saveTags(t);
      return { ...state, tags: t };
    }
    case 'REMOVE_TAG_DEF': {
      const t = state.tags.filter(tag => tag.id !== action.payload);
      saveTags(t);
      const r = state.received.map(item => ({ ...item, tags: item.tags.filter(t => t !== action.payload) }));
      saveHistory(r);
      return { ...state, tags: t, received: r };
    }
    case 'SET_THEME':
      try { localStorage.setItem('flashshare_theme', action.payload); } catch {}
      return { ...state, theme: action.payload };
    case 'UPDATE_STATS':
      return { ...state, stats: { ...state.stats, ...action.payload } };
    case 'SET_LATENCY':
      return { ...state, latency: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, bulkMode: false, bulkSelected: [] };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SEARCH_TYPE':
      return { ...state, searchType: action.payload };
    case 'SET_SEARCH_TAG':
      return { ...state, searchTag: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload };
    case 'SET_GALLERY_VIEW':
      return { ...state, galleryView: action.payload };
    case 'TOGGLE_BULK_MODE':
      return { ...state, bulkMode: !state.bulkMode, bulkSelected: [] };
    case 'TOGGLE_BULK_ITEM': {
      const key = `${action.payload.name}|${action.payload.size}`;
      const exists = state.bulkSelected.find(p => `${p.name}|${p.size}` === key);
      return {
        ...state,
        bulkSelected: exists
          ? state.bulkSelected.filter(p => `${p.name}|${p.size}` !== key)
          : [...state.bulkSelected, action.payload],
      };
    }
    case 'CLEAR_BULK':
      return { ...state, bulkSelected: [], bulkMode: false };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case 'SET_CONFIRM':
      return { ...state, confirmDialog: action.payload };
    case 'ADD_ACTIVITY':
      return { ...state, activity: [{ ...action.payload, id: Date.now() + Math.random(), ts: Date.now() }, ...state.activity].slice(0, 100) };
    case 'ADD_TO_SHARED_HISTORY':
      return { ...state, sharedHistory: [{ ...action.payload, id: Date.now() + Math.random() }, ...state.sharedHistory].slice(0, 200) };
    case 'ADD_AUDIT_LOG': {
      const log = [...(state.auditLog || []), { ...action.payload, ts: Date.now() }].slice(-500);
      try { localStorage.setItem('flashshare_audit', JSON.stringify(log)); } catch {}
      return { ...state, auditLog: log };
    }
    case 'CLEAR_SHARED_HISTORY':
      return { ...state, sharedHistory: [] };
    case 'SET_PENDING_RENAME':
      return { ...state, pendingRename: action.payload };
    case 'ADD_COMMENT': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, comments: [...(item.comments || []), action.payload.comment] }
          : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'SET_PEER_TRANSFERRING': {
      const p = { ...state.peers };
      if (p[action.payload]) p[action.payload] = { ...p[action.payload], transferring: true };
      return { ...state, peers: p };
    }
    case 'SET_PEER_IDLE': {
      const p = { ...state.peers };
      if (p[action.payload]) p[action.payload] = { ...p[action.payload], transferring: false };
      return { ...state, peers: p };
    }
    case 'SET_LINK_EXPIRY':
      return { ...state, linkExpiry: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload].slice(-200) };
    case 'SET_SPEED_LIMIT':
      return { ...state, speedLimit: action.payload };
    case 'SET_DOWNLOAD_SPEED_LIMIT':
      return { ...state, downloadSpeedLimit: action.payload };
    case 'SET_ENCRYPTION':
      return { ...state, encryptionEnabled: action.payload };
    case 'SET_CLIPBOARD_SYNC':
      return { ...state, clipboardSync: action.payload };
    case 'ADD_TEXT_SNIPPET':
      return { ...state, textSnippets: [...state.textSnippets, action.payload].slice(-50) };
    case 'SET_LIGHTBOX':
      return { ...state, lightbox: action.payload };
    case 'SET_SHOW_EDITOR':
      return { ...state, showEditor: action.payload };
    case 'SET_SHOW_EMOJI_PICKER':
      return { ...state, showEmojiPicker: action.payload };
    case 'ADD_FILE_VERSION': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, versions: [...(item.versions || []), action.payload.version] }
          : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'UPDATE_RECEIVED_ITEM': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, ...action.payload.updates }
          : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'SET_ROOM_PASSWORD':
      return { ...state, roomPassword: action.payload };
    case 'SET_AUTO_THEME':
      return { ...state, autoTheme: action.payload };
    case 'SET_NETWORK_TYPE':
      return { ...state, networkType: action.payload };
    case 'SET_AUTO_ACCEPT':
      return { ...state, autoAccept: action.payload };
    case 'SET_CONCURRENT_LIMIT':
      return { ...state, concurrentLimit: action.payload };
    case 'SET_IMAGE_COMPRESS':
      return { ...state, imageCompress: action.payload };
    case 'SET_CLEANUP_DAYS':
      return { ...state, cleanupDays: action.payload };
    case 'SET_TRANSFER_SEARCH':
      return { ...state, transferSearch: action.payload };
    case 'SET_TRANSFER_STATUS_FILTER':
      return { ...state, transferStatusFilter: action.payload };
    case 'SET_SHOW_SPEED_GRAPH':
      return { ...state, showSpeedGraph: action.payload };
    case 'SET_SOUND_ENABLED':
      return { ...state, soundEnabled: action.payload };
    case 'CLEANUP_OLD_FILES': {
      const cutoff = Date.now() - action.payload * 24 * 60 * 60 * 1000;
      const r = state.received.filter(item => !item.trashed || (item.trashedAt && item.trashedAt > cutoff));
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'SET_PINNED': {
      const key = `${action.payload.name}|${action.payload.size}`;
      const pinned = state.pinnedItems.includes(key)
        ? state.pinnedItems.filter(k => k !== key)
        : [...state.pinnedItems, key];
      try { localStorage.setItem('flashshare_pinned', JSON.stringify(pinned)); } catch {}
      return { ...state, pinnedItems: pinned };
    }
    case 'TOGGLE_RECEIVED_PIN': {
      const key = `${action.payload.name}|${action.payload.size}`;
      const pinned = state.pinnedItems.includes(key)
        ? state.pinnedItems.filter(k => k !== key)
        : [...state.pinnedItems, key];
      try { localStorage.setItem('flashshare_pinned', JSON.stringify(pinned)); } catch {}
      return { ...state, pinnedItems: pinned };
    }
    case 'BULK_PIN': {
      const keys = action.payload.map(p => `${p.name}|${p.size}`);
      const pinned = [...new Set([...state.pinnedItems, ...keys])];
      try { localStorage.setItem('flashshare_pinned', JSON.stringify(pinned)); } catch {}
      return { ...state, pinnedItems: pinned };
    }
    case 'UPDATE_BANDWIDTH':
      return { ...state, bandwidthTotal: { ...state.bandwidthTotal, ...action.payload } };
    case 'SET_PEER_INFO':
      return { ...state, showPeerInfo: action.payload };
    case 'SET_PEER_STATS':
      return { ...state, peerStats: { ...state.peerStats, ...action.payload } };
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.payload };
    case 'RENAME_RECEIVED': {
      const r = state.received.map(item =>
        item.name === action.payload.name && item.size === action.payload.size
          ? { ...item, name: action.payload.newName } : item
      );
      saveHistory(r);
      return { ...state, received: r };
    }
    case 'BULK_RENAME': {
      const updates = new Map(action.payload.map(p => [`${p.name}|${p.size}`, p.newName]));
      const r = state.received.map(item => {
        const key = `${item.name}|${item.size}`;
        return updates.has(key) ? { ...item, name: updates.get(key) } : item;
      });
      saveHistory(r);
      return { ...state, received: r, bulkMode: false, bulkSelected: [] };
    }
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
  const joinTimerRef = useRef(null);

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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addToast('Not connected to server', 'error');
      return false;
    }
    wsRef.current.send(JSON.stringify(msg));
    return true;
  }, [addToast]);

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
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    requestNotification();
  }, [requestNotification]);

  useEffect(() => {
    setSoundEnabled(state.soundEnabled);
  }, [state.soundEnabled]);

  useEffect(() => {
    if (!state.autoTheme) return;
    const hour = new Date().getHours();
    const desired = hour >= 19 || hour < 7 ? 'dark' : 'light';
    if (desired !== state.theme) {
      try { localStorage.setItem('flashshare_theme', desired); } catch {}
      document.documentElement.setAttribute('data-theme', desired);
    }
    const timer = setInterval(() => {
      const h = new Date().getHours();
      const d = h >= 19 || h < 7 ? 'dark' : 'light';
      if (d !== (localStorage.getItem('flashshare_theme') || 'dark')) {
        try { localStorage.setItem('flashshare_theme', d); } catch {}
        document.documentElement.setAttribute('data-theme', d);
        dispatch({ type: 'SET_THEME', payload: d });
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [state.autoTheme]);

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
  }, [dispatch, wsRef]);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.DEV
      ? `${protocol}//${location.hostname}:3000/ws`
      : `${protocol}//${location.host}/ws`;
    let ws;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        dispatch({ type: 'SET_WS_READY', payload: true });
        reconnectAttemptsRef.current = 0;
        if (joinTimerRef.current) { clearTimeout(joinTimerRef.current); joinTimerRef.current = null; }
        const params = new URLSearchParams(location.search);
        const room = params.get('room');
        if (room) {
          const pwd = params.get('p') || '';
          joinTimerRef.current = setTimeout(() => {
            send({ type: 'join', roomId: room.toUpperCase(), password: pwd });
            joinTimerRef.current = null;
          }, 500);
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
      if (reconnectAttemptsRef.current >= 3) {
        addToast('Could not reconnect. Please refresh.', 'error');
        return;
      }
      reconnectAttemptsRef.current++;
      const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
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
      if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    };
  }, []);

  return (
    <AppContext.Provider value={{
      state, dispatch, send, addToast, setConfirm, clearConfirm,
      updatePeers, peersRef, wsRef, subscribe, handleWsMessage,
      toggleTheme, requestNotification, sendBrowserNotification,
      startLatencyCheck, TAG_COLORS,
    }}>
      {children}
    </AppContext.Provider>
  );
}


