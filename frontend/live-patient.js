(function () {
  if (typeof io === 'undefined') return;

  const socket = io();
  const patientName = localStorage.getItem('patientName') || `Patient-${Math.floor(Math.random() * 900 + 100)}`;
  localStorage.setItem('patientName', patientName);

  const messages = document.getElementById('patientLiveMessages');
  const panel = document.getElementById('liveSupportPanel');
  const panelToggle = document.getElementById('patientLiveToggle');
  const input = document.getElementById('patientLiveInput');
  const sendBtn = document.getElementById('patientSendLive');
  const urgentBtn = document.getElementById('patientUrgentBtn');
  const videoBtn = document.getElementById('patientVideoBtn');
  const availabilityText = document.getElementById('doctorAvailabilityText');
  const unreadBadge = document.getElementById('patientUnreadBadge');
  const callStatus = document.getElementById('patientCallStatus');
  const endCallBtn = document.getElementById('patientEndCallBtn');
  const videoWrap = document.getElementById('patientVideoOverlay');
  const remoteVideo = document.getElementById('patientRemoteVideo');
  const localVideo = document.getElementById('patientLocalVideo');

  let peer = null;
  let localStream = null;
  let activePeerSocketId = null;
  let unreadCount = 0;
  let currentRole = 'patient';
  let audioContext = null;

  const rtcConfig = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
  };

  function addLine(text) {
    if (!messages) return;
    const line = document.createElement('div');
    line.className = 'live-line';
    line.textContent = text;
    messages.appendChild(line);
    messages.scrollTop = messages.scrollHeight;
  }

  function updateUnreadBadge() {
    if (!unreadBadge) return;
    unreadBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    unreadBadge.textContent = String(unreadCount);
    if (panelToggle) {
      panelToggle.textContent = unreadCount > 0 ? `Live Support (${unreadCount})` : 'Live Support';
    }
  }

  function playAlert() {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.06;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.14);
    } catch (_) {}
  }

  function markRead() {
    unreadCount = 0;
    updateUnreadBadge();
  }

  function setCallStatus(text) {
    if (callStatus) callStatus.textContent = `Call: ${text}`;
  }

  function cleanupCallUi() {
    if (videoWrap) videoWrap.style.display = 'none';
    if (remoteVideo) remoteVideo.srcObject = null;
    if (localVideo) localVideo.srcObject = null;
    if (endCallBtn) endCallBtn.style.display = 'none';
    setCallStatus('Not connected');
  }

  function closePeer() {
    if (peer) {
      try { peer.close(); } catch (_) {}
      peer = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    activePeerSocketId = null;
    cleanupCallUi();
  }

  async function ensureLocalStream() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo) localVideo.srcObject = localStream;
    return localStream;
  }

  function createPeer(remoteSocketId) {
    activePeerSocketId = remoteSocketId;
    peer = new RTCPeerConnection(rtcConfig);

    peer.onicecandidate = (e) => {
      if (e.candidate && activePeerSocketId) {
        socket.emit('webrtc-ice-candidate', { to: activePeerSocketId, candidate: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      if (remoteVideo) remoteVideo.srcObject = e.streams[0];
      if (videoWrap) videoWrap.style.display = 'grid';
      if (endCallBtn) endCallBtn.style.display = 'block';
      setCallStatus('Connected');
    };

    return peer;
  }

  async function startOffer(remoteSocketId) {
    const stream = await ensureLocalStream();
    const pc = createPeer(remoteSocketId);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc-offer', { to: remoteSocketId, offer });
    if (videoWrap) videoWrap.style.display = 'grid';
    addLine('Video call started.');
  }

  socket.emit('register-role', { role: 'patient', name: patientName });

  socket.on('registered', (payload) => {
    currentRole = payload.role || 'patient';
  });

  socket.on('chat-history', (history = []) => {
    if (!messages) return;
    messages.innerHTML = '';
    history.slice(-80).forEach(msg => {
      addLine(`${msg.fromName}: ${msg.text}`);
    });
    markRead();
  });

  socket.on('doctor-availability', ({ available }) => {
    if (availabilityText) availabilityText.textContent = `Doctor availability: ${available ? 'Free now' : 'Busy'}`;
  });

  socket.on('chat-message', (msg) => {
    addLine(`${msg.fromName}: ${msg.text}`);
    const panelOpen = panel && !panel.classList.contains('collapsed');
    if (msg.fromRole && msg.fromRole !== currentRole && !panelOpen) {
      unreadCount += 1;
      updateUnreadBadge();
      playAlert();
    }
  });

  socket.on('video-call-status', (payload) => {
    addLine(payload.message);
  });

  socket.on('video-call-accepted', async (payload) => {
    addLine(`${payload.byName} accepted your video call.`);
    await startOffer(payload.bySocketId);
  });

  socket.on('video-call-active', () => {
    setCallStatus('Connected');
    if (endCallBtn) endCallBtn.style.display = 'block';
  });

  socket.on('video-call-ended', (payload) => {
    addLine(payload.reason || 'Call ended.');
    closePeer();
  });

  socket.on('webrtc-answer', async ({ answer }) => {
    if (!peer) return;
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('webrtc-ice-candidate', async ({ candidate }) => {
    if (!peer || !candidate) return;
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  });

  if (messages) {
    messages.addEventListener('click', markRead);
  }

  if (panelToggle && panel) {
    panelToggle.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      if (!panel.classList.contains('collapsed')) {
        markRead();
      }
    });
  }

  window.addEventListener('focus', markRead);

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const text = (input.value || '').trim();
      if (!text) return;
      socket.emit('chat-message', { text, urgent: false });
      input.value = '';
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && sendBtn) sendBtn.click();
    });
  }

  if (urgentBtn) {
    urgentBtn.addEventListener('click', () => {
      const text = (input.value || '').trim() || 'Urgent help needed';
      socket.emit('urgent-request', { reason: text });
      socket.emit('chat-message', { text: `[URGENT] ${text}`, urgent: true });
      input.value = '';
      addLine('Urgent request sent to admin.');
    });
  }

  if (videoBtn) {
    videoBtn.addEventListener('click', () => {
      socket.emit('video-call-request');
      setCallStatus('Request sent');
    });
  }

  if (endCallBtn) {
    endCallBtn.addEventListener('click', () => {
      socket.emit('end-video-call', { toSocketId: activePeerSocketId });
      closePeer();
    });
  }
})();
