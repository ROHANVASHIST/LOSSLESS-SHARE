import { useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CHUNK_SIZE, MAX_BUFFERED, formatBytes, formatSpeed, getFileIcon, getFileType } from '../utils/helpers';

const PC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

export function useWebRTC() {
  const { dispatch, send, addToast, updatePeers, peersRef, subscribe } = useApp();
  const incomingFilesRef = useRef(new Map());
  const outgoingFilesRef = useRef(new Map());

  const getActivePeerId = useCallback(() => {
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
        const transfer = {
          id: cardId,
          direction: 'receive',
          name: msg.name,
          size: msg.size,
          mimeType: msg.mimeType,
          fileType: msg.fileType || 'File',
          progress: 0,
          status: 'Receiving...',
          icon: getFileIcon(msg.mimeType, msg.name),
          complete: false,
          error: false,
        };
        dispatch({ type: 'ADD_TRANSFER', payload: transfer });
        incomingFilesRef.current.set(fileId, {
          name: msg.name,
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
        });
      }
    } catch { }
  }, [dispatch]);

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
      payload: { name: fileData.name, size: fileData.size, mimeType: fileData.mimeType, url }
    });

    incomingFilesRef.current.delete(fileData.fileId);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    addToast(`Received: ${fileData.name}`, 'success');
  }, [dispatch, addToast]);

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

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: 'ice-candidate', to: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        updatePeers();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setTimeout(() => {
          const p = peersRef.current.get(peerId);
          if (p) {
            try { p.channel?.close(); } catch {}
            try { p.connection.close(); } catch {}
            peersRef.current.delete(peerId);
          }
          updatePeers();
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
      };
    }

    return pc;
  }, [send, setupDataChannel, updatePeers, peersRef]);

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

  const startFileSend = useCallback(async (file) => {
    const activePeerId = getActivePeerId();
    if (!activePeerId) {
      addToast('No peer connected', 'error');
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

    dispatch({
      type: 'ADD_TRANSFER',
      payload: {
        id: cardId, direction: 'send', name: file.name, size: file.size,
        mimeType: file.type || 'application/octet-stream', fileType,
        progress: 0, status: 'Starting...', icon, complete: false, error: false,
      }
    });

    const sendState = {
      file, cardId, peerId: activePeerId, sentBytes: 0,
      cancelled: false, startTime: performance.now(),
      speedSamples: [], fileId,
    };

    outgoingFilesRef.current.set(fileId, sendState);

    try {
      peer.channel.send(JSON.stringify({
        type: 'file-start', name: file.name, size: file.size,
        mimeType: file.type || 'application/octet-stream', fileType,
      }));

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        if (sendState.cancelled) {
          dispatch({ type: 'UPDATE_TRANSFER', payload: { id: cardId, progress: 0, status: 'Cancelled', error: true } });
          addToast(`Cancelled: ${file.name}`, 'error');
          setTimeout(() => dispatch({ type: 'REMOVE_TRANSFER', payload: cardId }), 2000);
          outgoingFilesRef.current.delete(fileId);
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

        dispatch({
          type: 'UPDATE_TRANSFER',
          payload: {
            id: cardId, progress: (end / file.size) * 100,
            status: `Sending... ${formatBytes(end)} / ${formatBytes(file.size)}${speedStr ? ` (${speedStr})` : ''}`,
          }
        });

        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (!sendState.cancelled) {
        dispatch({ type: 'UPDATE_TRANSFER', payload: { id: cardId, progress: 100, status: 'Sent', complete: true } });
        addToast(`Sent: ${file.name}`, 'success');
        setTimeout(() => dispatch({ type: 'REMOVE_TRANSFER', payload: cardId }), 3000);
      }

      outgoingFilesRef.current.delete(fileId);
    } catch (err) {
      if (!sendState.cancelled) {
        dispatch({ type: 'UPDATE_TRANSFER', payload: { id: cardId, progress: 0, status: `Error: ${err.message}`, error: true } });
        addToast(`Send failed: ${err.message}`, 'error');
      }
      outgoingFilesRef.current.delete(fileId);
    }
  }, [getActivePeerId, dispatch, addToast, peersRef]);

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
          if (msg.peers?.length > 0) {
            msg.peers.forEach(peerId => createPeerConnection(peerId, true));
          }
          break;
        case 'peer-joined':
          createPeerConnection(msg.id, true);
          break;
        case 'peer-left':
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
  }, [subscribe, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, updatePeers, peersRef]);

  return { startFileSend, cancelTransfer, cleanupAllPeers };
}
