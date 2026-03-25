(function () {
  if (typeof io === 'undefined') return;

  const socket = io();

  const messages = document.getElementById('adminLiveMessages');
  const panel = document.getElementById('adminLivePanel');
  const panelToggle = document.getElementById('adminLiveToggle');
  const urgentList = document.getElementById('adminUrgentList');
  const input = document.getElementById('adminLiveInput');
  const sendBtn = document.getElementById('adminSendLive');
  const freeToggle = document.getElementById('doctorFreeToggle');
  const unreadBadge = document.getElementById('adminUnreadBadge');
  const callStatus = document.getElementById('adminCallStatus');
  const endCallBtn = document.getElementById('adminEndCallBtn');
  const videoWrap = document.getElementById('adminVideoOverlay');
  const remoteVideo = document.getElementById('adminRemoteVideo');
  const localVideo = document.getElementById('adminLocalVideo');

  let localStream = null;
  let peer = null;
  let activePatientSocketId = null;
  let unreadCount = 0;
  let currentRole = 'admin';
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
      oscillator.type = 'triangle';
      oscillator.frequency.value = 980;
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
    activePatientSocketId = null;
    cleanupCallUi();
  }

  async function ensureLocalStream() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo) localVideo.srcObject = localStream;
    return localStream;
  }

  function createPeer(remoteSocketId) {
    activePatientSocketId = remoteSocketId;
    peer = new RTCPeerConnection(rtcConfig);

    peer.onicecandidate = (e) => {
      if (e.candidate && activePatientSocketId) {
        socket.emit('webrtc-ice-candidate', { to: activePatientSocketId, candidate: e.candidate });
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

  async function acceptVideoFromPatient(patientSocketId) {
    await ensureLocalStream();
    createPeer(patientSocketId);
    if (videoWrap) videoWrap.style.display = 'grid';
    socket.emit('video-call-accepted', { toSocketId: patientSocketId });
    addLine('Video call accepted. Waiting for patient stream...');
  }

  socket.emit('register-role', { role: 'admin', name: 'Admin' });

  socket.on('registered', (payload) => {
    currentRole = payload.role || 'admin';
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
    if (freeToggle) freeToggle.checked = !!available;
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

  socket.on('urgent-request', (payload) => {
    if (!urgentList) return;
    const row = document.createElement('div');
    row.className = 'urgent-item';
    row.innerHTML = `<span>${payload.fromName}: ${payload.reason}</span>`;

    const actionWrap = document.createElement('div');
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept Video';
    acceptBtn.addEventListener('click', async () => {
      await acceptVideoFromPatient(payload.fromSocketId);
      row.remove();
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Reject';
    rejectBtn.style.background = '#ef4444';
    rejectBtn.addEventListener('click', () => {
      socket.emit('video-call-rejected', { toSocketId: payload.fromSocketId });
      row.remove();
    });

    actionWrap.appendChild(acceptBtn);
    actionWrap.appendChild(rejectBtn);
    row.appendChild(actionWrap);
    urgentList.appendChild(row);
    unreadCount += 1;
    updateUnreadBadge();
    playAlert();
  });

  socket.on('video-call-request', (payload) => {
    addLine(`${payload.fromName} requested a video call.`);
    if (!urgentList) return;

    const row = document.createElement('div');
    row.className = 'urgent-item';
    row.innerHTML = `<span>${payload.fromName}: Video request</span>`;

    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept Video';
    acceptBtn.addEventListener('click', async () => {
      await acceptVideoFromPatient(payload.fromSocketId);
      row.remove();
    });

    row.appendChild(acceptBtn);
    urgentList.appendChild(row);
    unreadCount += 1;
    updateUnreadBadge();
    playAlert();
  });

  socket.on('video-call-active', () => {
    setCallStatus('Connected');
    if (endCallBtn) endCallBtn.style.display = 'block';
  });

  socket.on('video-call-ended', (payload) => {
    addLine(payload.reason || 'Call ended.');
    closePeer();
  });

  socket.on('webrtc-offer', async ({ from, offer }) => {
    const stream = await ensureLocalStream();
    const pc = createPeer(from);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc-answer', { to: from, answer });
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

  if (freeToggle) {
    freeToggle.addEventListener('change', () => {
      socket.emit('set-doctor-availability', { available: freeToggle.checked });
    });
  }

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

  if (endCallBtn) {
    endCallBtn.addEventListener('click', () => {
      socket.emit('end-video-call', { toSocketId: activePatientSocketId });
      closePeer();
    });
  }
})();
