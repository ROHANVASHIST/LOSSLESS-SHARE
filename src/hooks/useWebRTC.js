import { useRef, useCallback, useEffect } from 'react';
import { useApp } from './useApp';
import { CHUNK_SIZE, MAX_BUFFERED, formatBytes, formatSpeed, getFileIcon, getFileType } from '../utils/helpers';
import { playCompleteSound } from '../utils/sound';

const PC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

export function useWebRTC() {
  const { state, dispatch, send, addToast, updatePeers, peersRef, subscribe, sendBrowserNotification } = useApp();
  const incomingFilesRef = useRef(new Map());
  const outgoingFilesRef = useRef(new Map());

  const getActivePeerId = useCallback((preferredId) => {
    if (preferredId) {
      const peer = peersRef.current.get(preferredId);
      if (peer?.channel?.readyState === 'open' && !peer.cancelled) return preferredId;
    }
    for (const [peerId, peer] of peersRef.current) {
      if (peer.channel?.readyState === 'open' && !peer.cancelled) {
        return peerId;
      }
    }
    return null;
  }, [peersRef]);

  const handleDataChannelMessage = useCallback((peerId, data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'file-start') {
        const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const cardId = `recv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const displayName = msg.customName || msg.name;
        const transfer = {
          id: cardId,
          direction: 'receive',
          name: displayName,
          originalName: msg.name,
          size: msg.size,
          mimeType: msg.mimeType,
          fileType: msg.fileType || 'File',
          progress: 0,
          status: 'Receiving...',
          icon: getFileIcon(msg.mimeType, msg.name),
          complete: false,
          error: false,
          note: msg.note || '',
          fromPeer: peerId,
        };
        dispatch({ type: 'ADD_TRANSFER', payload: transfer });
        incomingFilesRef.current.set(fileId, {
          name: msg.name,
          displayName,
          mimeType: msg.mimeType,
          size: msg.size,
          chunks: new Map(),
          received: 0,
          chunkCount: 0,
          cardId,
          fileId,
          peerId,
          startTime: performance.now(),
          speedSamples: [],
          cancelled: false,
          note: msg.note || '',
        });
      } else if (msg.type === 'file-comment') {
        dispatch({
          type: 'ADD_COMMENT',
          payload: {
            name: msg.fileName,
            size: msg.fileSize,
            comment: { text: msg.text, from: msg.from, ts: Date.now() },
          }
        });
        addToast(`Comment on ${msg.fileName}: ${msg.text}`, '');
      } else if (msg.type === 'chat') {
        dispatch({
          type: 'ADD_CHAT_MESSAGE',
          payload: { text: msg.text, from: msg.from, ts: msg.ts || Date.now() },
        });
        dispatch({
          type: 'ADD_ACTIVITY',
          payload: { type: 'chat', text: `💬 ${msg.text}`, peerId: msg.from },
        });
        addToast(`💬 ${msg.from?.slice(0, 6)}: ${msg.text}`, '');
        sendBrowserNotification('FlashShare Chat', `${msg.from?.slice(0, 6)}: ${msg.text}`);
      }
    } catch { }
  }, [dispatch, addToast]);

  const handleBinaryChunk = useCallback((peerId, buffer) => {
    for (const [, fileData] of incomingFilesRef.current) {
      if (fileData.peerId !== peerId) continue;
      if (fileData.received >= fileData.size) continue;
      if (fileData.cancelled) return;

      fileData.chunkCount++;
      fileData.chunks.set(fileData.chunkCount - 1, new Uint8Array(buffer));
      fileData.received += buffer.byteLength;

      const now = performance.now();
      fileData.speedSamples.push({ time: now, bytes: fileData.received });
      const recent = fileData.speedSamples.filter(s => now - s.time < 2000);
      fileData.speedSamples = recent;

      let speedStr = '';
      if (recent.length >= 2) {
        const elapsed = (recent[recent.length - 1].time - recent[0].time) / 1000;
        if (elapsed > 0) {
          const bytesPerSec = (recent[recent.length - 1].bytes - recent[0].bytes) / elapsed;
          speedStr = formatSpeed(bytesPerSec);
        }
      }

      const progress = Math.min((fileData.received / fileData.size) * 100, 100);
      dispatch({
        type: 'UPDATE_TRANSFER',
        payload: {
          id: fileData.cardId,
          progress,
          status: `Receiving... ${formatBytes(fileData.received)} / ${formatBytes(fileData.size)}${speedStr ? ` (${speedStr})` : ''}`,
        }
      });

      if (fileData.received >= fileData.size) {
        assembleFile(fileData);
      }
      return;
    }
  }, [dispatch]);

  const assembleFile = useCallback((fileData) => {
    if (fileData.cancelled) return;
    const blob = new Blob(Array.from(fileData.chunks.values()), { type: fileData.mimeType });
    const url = URL.createObjectURL(blob);

    dispatch({
      type: 'UPDATE_TRANSFER',
      payload: { id: fileData.cardId, progress: 100, status: 'Received', complete: true, downloadUrl: url }
    });

    dispatch({
      type: 'ADD_RECEIVED',
      payload: { name: fileData.displayName || fileData.name, size: fileData.size, mimeType: fileData.mimeType, url, note: fileData.note || '' }
    });

    dispatch({
      type: 'UPDATE_STATS',
      payload: { received: 1, receivedBytes: fileData.size }
    });

    dispatch({
      type: 'ADD_ACTIVITY',
      payload: { type: 'file-received', text: `Received ${fileData.displayName || fileData.name}`, peerId: fileData.peerId }
    });

    dispatch({
      type: 'ADD_TO_SHARED_HISTORY',
      payload: { type: 'received', name: fileData.displayName || fileData.name, size: fileData.size, peerId: fileData.peerId, ts: Date.now() }
    });

    incomingFilesRef.current.delete(fileData.fileId);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    addToast(`Received: ${fileData.displayName || fileData.name}`, 'success');
    sendBrowserNotification('FlashShare', `Received: ${fileData.displayName || fileData.name}`);
    playCompleteSound();
  }, [dispatch, addToast, sendBrowserNotification]);

  const setupDataChannel = useCallback((channel, peerId) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => updatePeers();
    channel.onclose = () => updatePeers();

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        handleDataChannelMessage(peerId, event.data);
      } else {
        handleBinaryChunk(peerId, event.data);
      }
    };
  }, [handleDataChannelMessage, handleBinaryChunk, updatePeers]);

  const createPeerConnection = useCallback((peerId, isInitiator) => {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId).connection;

    const pc = new RTCPeerConnection(PC_CONFIG);
    const peer = { connection: pc, channel: null, cancelled: false };
    peersRef.current.set(peerId, peer);
    updatePeers();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: 'ice-candidate', to: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        updatePeers();
        dispatch({ type: 'ADD_ACTIVITY', payload: { type: 'peer-connected', text: 'Peer connected', peerId } });
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setTimeout(() => {
          const p = peersRef.current.get(peerId);
          if (p) {
            try { p.channel?.close(); } catch {}
            try { p.connection.close(); } catch {}
            peersRef.current.delete(peerId);
          }
          updatePeers();
          dispatch({ type: 'ADD_ACTIVITY', payload: { type: 'peer-disconnected', text: 'Peer disconnected', peerId } });
        }, 2000);
      }
    };

    if (isInitiator) {
      const channel = pc.createDataChannel('file-transfer', { ordered: true });
      peer.channel = channel;
      setupDataChannel(channel, peerId);

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => send({ type: 'offer', to: peerId, sdp: pc.localDescription }))
        .catch(console.error);
    } else {
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        peer.channel = channel;
        setupDataChannel(channel, peerId);
        updatePeers();
      };
    }

    return pc;
  }, [send, setupDataChannel, updatePeers, peersRef, dispatch]);

  const handleOffer = useCallback(async (msg) => {
    const pc = createPeerConnection(msg.from, false);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'answer', to: msg.from, sdp: pc.localDescription });
    } catch (err) {
      console.error('Offer error:', err);
    }
  }, [createPeerConnection, send]);

  const handleAnswer = useCallback(async (msg) => {
    const peer = peersRef.current.get(msg.from);
    if (!peer) return;
    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } catch (err) {
      console.error('Answer error:', err);
    }
  }, [peersRef]);

  const handleIceCandidate = useCallback(async (msg) => {
    const peer = peersRef.current.get(msg.from);
    if (!peer) return;
    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } catch (err) {
      console.error('ICE error:', err);
    }
  }, [peersRef]);

  const calcETA = useCallback((sent, total, speedSamples) => {
    if (speedSamples.length < 2) return '';
    const now = performance.now();
    const recent = speedSamples.filter(s => now - s.time < 2000);
    if (recent.length < 2) return '';
    const elapsed = (recent[recent.length - 1].time - recent[0].time) / 1000;
    if (elapsed <= 0) return '';
    const bytesPerSec = (recent[recent.length - 1].bytes - recent[0].bytes) / elapsed;
    if (bytesPerSec <= 0) return '';
    const remaining = (total - sent) / bytesPerSec;
    if (remaining < 5) return '';
    if (remaining < 60) return `${Math.round(remaining)}s`;
    if (remaining < 3600) return `${Math.floor(remaining / 60)}m ${Math.round(remaining % 60)}s`;
    return `${Math.floor(remaining / 3600)}h`;
  }, []);

  const checkDuplicate = useCallback((fileName) => {
    for (const [, state] of outgoingFilesRef.current) {
      if (state.file.name === fileName) return true;
    }
    return false;
  }, []);

  const startFileSend = useCallback(async (file, targetPeerId, customName, note) => {
    const activePeerId = getActivePeerId(targetPeerId);
    if (!activePeerId) {
      addToast('No peer connected', 'error');
      return;
    }

    const displayName = customName || file.name;

    if (checkDuplicate(displayName)) {
      addToast(`Duplicate: ${displayName} is already being sent`, 'error');
      return;
    }

    const peer = peersRef.current.get(activePeerId);
    if (!peer?.channel || peer.channel.readyState !== 'open') {
      addToast('Connection not ready', 'error');
      return;
    }

    const fileId = `out-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const cardId = `send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const icon = getFileIcon(file.type, file.name);
    const fileType = getFileType(file);

    dispatch({ type: 'SET_PEER_TRANSFERRING', payload: activePeerId });

    dispatch({
      type: 'ADD_TRANSFER',
      payload: {
        id: cardId, direction: 'send', name: displayName, size: file.size,
        mimeType: file.type || 'application/octet-stream', fileType,
        progress: 0, status: 'Starting...', icon, complete: false, error: false,
        targetPeerId, note: note || '',
      }
    });

    const sendState = {
      file, cardId, peerId: activePeerId, sentBytes: 0, displayName,
      cancelled: false, startTime: performance.now(),
      speedSamples: [], fileId, note: note || '',
    };

    outgoingFilesRef.current.set(fileId, sendState);

    try {
      peer.channel.send(JSON.stringify({
        type: 'file-start',
        name: file.name,
        customName: customName || undefined,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        fileType,
        note: note || undefined,
      }));

      dispatch({
        type: 'ADD_ACTIVITY',
        payload: { type: 'file-sent', text: `Sending ${displayName}`, peerId: activePeerId }
      });

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        if (sendState.cancelled) {
          dispatch({ type: 'UPDATE_TRANSFER', payload: { id: cardId, progress: 0, status: 'Cancelled', error: true } });
          addToast(`Cancelled: ${displayName}`, 'error');
          setTimeout(() => dispatch({ type: 'REMOVE_TRANSFER', payload: cardId }), 2000);
          outgoingFilesRef.current.delete(fileId);
          dispatch({ type: 'SET_PEER_IDLE', payload: activePeerId });
          return;
        }

        while (peer.channel.bufferedAmount > MAX_BUFFERED) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const buffer = await file.slice(start, end).arrayBuffer();
        peer.channel.send(buffer);
        sendState.sentBytes = end;

        const now = performance.now();
        sendState.speedSamples.push({ time: now, bytes: end });
        const recent = sendState.speedSamples.filter(s => now - s.time < 2000);
        sendState.speedSamples = recent;

        let speedStr = '';
        if (recent.length >= 2) {
          const elapsed = (recent[recent.length - 1].time - recent[0].time) / 1000;
          if (elapsed > 0) {
            speedStr = formatSpeed((recent[recent.length - 1].bytes - recent[0].bytes) / elapsed);
          }
        }

        const eta = calcETA(end, file.size, sendState.speedSamples);
        dispatch({
          type: 'UPDATE_TRANSFER',
          payload: {
            id: cardId, progress: (end / file.size) * 100,
            status: `Sending... ${formatBytes(end)} / ${formatBytes(file.size)}${speedStr ? ` (${speedStr})` : ''}${eta ? ` - ${eta}` : ''}`,
          }
        });

        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (!sendState.cancelled) {
        dispatch({ type: 'UPDATE_TRANSFER', payload: { id: cardId, progress: 100, status: 'Sent', complete: true } });
        dispatch({ type: 'UPDATE_STATS', payload: { sent: 1, sentBytes: file.size } });
        dispatch({
          type: 'ADD_ACTIVITY',
          payload: { type: 'file-sent', text: `Sent ${displayName}`, peerId: activePeerId }
        });
        dispatch({
          type: 'ADD_TO_SHARED_HISTORY',
          payload: { type: 'sent', name: displayName, size: file.size, peerId: activePeerId, ts: Date.now() }
        });
        addToast(`Sent: ${displayName}`, 'success');
        sendBrowserNotification('FlashShare', `Sent: ${displayName}`);
        playCompleteSound();
        setTimeout(() => dispatch({ type: 'REMOVE_TRANSFER', payload: cardId }), 3000);
      }

      outgoingFilesRef.current.delete(fileId);
      dispatch({ type: 'SET_PEER_IDLE', payload: activePeerId });
    } catch (err) {
      if (!sendState.cancelled) {
        dispatch({ type: 'UPDATE_TRANSFER', payload: { id: cardId, progress: 0, status: `Error: ${err.message}`, error: true } });
        addToast(`Send failed: ${err.message}`, 'error');
      }
      outgoingFilesRef.current.delete(fileId);
      dispatch({ type: 'SET_PEER_IDLE', payload: activePeerId });
    }
  }, [getActivePeerId, dispatch, addToast, peersRef, sendBrowserNotification, calcETA, checkDuplicate]);

  const cancelTransfer = useCallback((transferId) => {
    for (const [, state] of outgoingFilesRef.current) {
      if (state.cardId === transferId) { state.cancelled = true; return; }
    }
    for (const [fileId, state] of incomingFilesRef.current) {
      if (state.cardId === transferId) {
        state.cancelled = true;
        dispatch({ type: 'UPDATE_TRANSFER', payload: { id: transferId, status: 'Cancelled', error: true } });
        incomingFilesRef.current.delete(fileId);
        return;
      }
    }
  }, [dispatch]);

  const sendComment = useCallback((peerId, fileName, fileSize, text) => {
    const peer = peersRef.current.get(peerId);
    if (!peer?.channel || peer.channel.readyState !== 'open') {
      addToast('Peer not connected', 'error');
      return;
    }
    peer.channel.send(JSON.stringify({
      type: 'file-comment', fileName, fileSize, text, from: state.myId,
    }));
    addToast('Comment sent', 'success');
  }, [addToast, peersRef, state.myId]);

  const cleanupAllPeers = useCallback(() => {
    for (const [, peer] of peersRef.current) {
      try { peer.channel?.close(); } catch {}
      try { peer.connection.close(); } catch {}
    }
    peersRef.current.clear();
    updatePeers();
  }, [updatePeers, peersRef]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      switch (msg.type) {
        case 'room-created':
        case 'room-joined':
          dispatch({ type: 'ADD_ACTIVITY', payload: { type: 'room', text: `Joined room ${msg.roomId}` } });
          if (msg.peers?.length > 0) {
            msg.peers.forEach(peerId => createPeerConnection(peerId, true));
          }
          break;
        case 'peer-joined':
          dispatch({ type: 'ADD_ACTIVITY', payload: { type: 'peer-joined', text: 'Peer joined', peerId: msg.id } });
          break;
        case 'peer-left':
          dispatch({ type: 'ADD_ACTIVITY', payload: { type: 'peer-left', text: 'Peer left', peerId: msg.id } });
          const peer = peersRef.current.get(msg.id);
          if (peer) {
            try { peer.channel?.close(); } catch {}
            try { peer.connection.close(); } catch {}
            peersRef.current.delete(msg.id);
          }
          updatePeers();
          break;
        case 'offer':
          handleOffer(msg).catch(console.error);
          break;
        case 'answer':
          handleAnswer(msg).catch(console.error);
          break;
        case 'ice-candidate':
          handleIceCandidate(msg).catch(console.error);
          break;
      }
    });
    return unsub;
  }, [subscribe, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, updatePeers, peersRef, dispatch]);

  const retryFileSend = useCallback(async (transfer) => {
    if (transfer.direction !== 'send') return;
    const file = new File([], transfer.name, { type: transfer.mimeType });
    Object.defineProperty(file, 'size', { value: transfer.size });
    await startFileSend(file, transfer.targetPeerId, transfer.name, transfer.note);
  }, [startFileSend]);

  const sendChat = useCallback((text) => {
    if (!text?.trim() || !state.myId) return;
    const payload = JSON.stringify({ type: 'chat', text: text.trim(), from: state.myId, ts: Date.now() });
    let sent = 0;
    for (const [, peer] of peersRef.current) {
      if (peer.channel?.readyState === 'open' && !peer.cancelled) {
        try { peer.channel.send(payload); sent++; } catch {}
      }
    }
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: { text: text.trim(), from: state.myId, ts: Date.now() },
    });
    if (sent === 0 && peersRef.current.size > 0) {
      addToast('Chat: waiting for peer connection...', '');
    } else if (sent === 0) {
      addToast('No peers connected', 'error');
    }
  }, [peersRef, state.myId, dispatch, addToast]);

  const broadcastToAll = useCallback(async (files) => {
    const connectedPeers = [];
    for (const [peerId, peer] of peersRef.current) {
      if (peer.channel?.readyState === 'open' && !peer.cancelled) {
        connectedPeers.push(peerId);
      }
    }
    if (connectedPeers.length === 0) {
      addToast('No peers connected', 'error');
      return;
    }
    for (const file of files) {
      for (const peerId of connectedPeers) {
        await startFileSend(file, peerId);
      }
    }
  }, [startFileSend, addToast, peersRef]);

  return { startFileSend, cancelTransfer, cleanupAllPeers, retryFileSend, broadcastToAll, sendComment, sendChat };
}
