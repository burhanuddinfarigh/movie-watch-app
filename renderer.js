class MovieWatchApp {
    constructor() {
        // State properties
        this.peer = null;
        this.connection = null;
        this.call = null;
        this.localStream = null;
        this.remoteStream = null;
        this.screenStream = null;
        this.isHost = false;
        this.roomId = null;
        this.selectedScreenSource = null;
        this.isConnected = false;
        this.isMuted = false;
        this.isVideoEnabled = true;
        this.isSharingScreen = false;

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.createRoomScreen = document.getElementById('createRoomScreen');
        this.joinRoomScreen = document.getElementById('joinRoomScreen');
        this.streamingScreen = document.getElementById('streamingScreen');
        
        // Buttons
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.backFromCreate = document.getElementById('backFromCreate');
        this.backFromJoin = document.getElementById('backFromJoin');
        this.connectBtn = document.getElementById('connectBtn');
        this.copyRoomId = document.getElementById('copyRoomId');
        this.closeScreenSelect = document.getElementById('closeScreenSelect');
        this.confirmScreenSelect = document.getElementById('confirmScreenSelect');
        
        // Controls
        this.toggleMute = document.getElementById('toggleMute');
        this.toggleVideo = document.getElementById('toggleVideo');
        this.toggleScreenShareBtn = document.getElementById('toggleScreenShare');
        this.endCallBtn = document.getElementById('endCall');
        
        // Inputs and displays
        this.generatedRoomId = document.getElementById('generatedRoomId');
        this.roomIdInput = document.getElementById('roomIdInput');
        this.hostStatus = document.getElementById('hostStatus');
        this.joinStatus = document.getElementById('joinStatus');
        
        // Video elements
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        
        // Modal
        this.screenSelectModal = document.getElementById('screenSelectModal');
        this.screenSources = document.getElementById('screenSources');
        
        // Toast
        this.toast = document.getElementById('toast');
    }

    attachEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.showCreateRoom());
        this.joinRoomBtn.addEventListener('click', () => this.showJoinRoom());
        this.backFromCreate.addEventListener('click', () => this.showWelcome());
        this.backFromJoin.addEventListener('click', () => this.showWelcome());
        this.connectBtn.addEventListener('click', () => this.joinRoom());
        this.copyRoomId.addEventListener('click', () => this.copyRoomIdToClipboard());
        this.closeScreenSelect.addEventListener('click', () => this.hideScreenSelection());
        this.confirmScreenSelect.addEventListener('click', () => this.confirmScreenSelection());
        this.toggleMute.addEventListener('click', () => this.toggleMuteAudio());
        this.toggleVideo.addEventListener('click', () => this.toggleVideoEnabled());
        this.toggleScreenShareBtn.addEventListener('click', () => this.handleScreenShareToggle());
        this.endCallBtn.addEventListener('click', () => this.endCall());
        this.roomIdInput.addEventListener('input', (e) => {
            this.connectBtn.disabled = !e.target.value.trim();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.connectBtn.disabled) this.joinRoom();
        });
    }

    setupPeerEventHandlers() {
        if (!this.peer) return;
        this.peer.on('connection', (conn) => this.handleIncomingConnection(conn));
        this.peer.on('call', (call) => this.handleIncomingCall(call));
    }

    async showCreateRoom() {
        this.isHost = true;
        this.roomId = this.generateSecureRoomId();
        this.generatedRoomId.value = this.roomId;
        try {
            const hostPeerId = await this.generateHostPeerId(this.roomId);
            this.peer = new Peer(hostPeerId, {
                host: '0.peerjs.com', port: 443, path: '/', secure: true,
                config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
            });
            this.setupPeerEventHandlers();
            this.showScreen('createRoomScreen');
            this.hostStatus.textContent = 'Waiting for friend to join...';
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showToast('Error creating room. Please try again.', 'error');
            this.showWelcome();
        }
    }
    
    async joinRoom() {
        const inputRoomId = this.roomIdInput.value.trim();
        if (!this.validateRoomId(inputRoomId)) {
            return this.showToast('Please enter a valid Room ID', 'warning');
        }
        try {
            this.connectBtn.disabled = true;
            if (!this.peer) {
                this.peer = new Peer(undefined, {
                    host: '0.peerjs.com', port: 443, path: '/', secure: true,
                    config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
                });
                this.setupPeerEventHandlers();
            }
            await new Promise((resolve, reject) => {
                if (this.peer.open) return resolve();
                this.peer.on('open', resolve);
                this.peer.on('error', reject);
                setTimeout(() => reject(new Error("Signaling server timeout")), 10000);
            });
            const hostPeerId = await this.generateHostPeerId(inputRoomId);
            this.connection = this.peer.connect(hostPeerId, { reliable: true });
            this.connection.on('open', () => this.setupLocalMedia());
            this.connection.on('close', () => this.cleanup());
        } catch (error) {
            this.showToast(`Join failed: ${error.message}`, 'error');
            this.connectBtn.disabled = false;
        }
    }

    async setupLocalMedia() {
    try {
        this.showToast('Setting up camera and microphone...', 'info');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: { echoCancellation: true, noiseSuppression: true }
        });
        this.localStream = stream;
        this.localVideo.srcObject = stream;

        if (this.isHost) {
            this.toggleScreenShareBtn.style.display = 'flex';
        } else {
            this.toggleScreenShareBtn.style.display = 'none';
        }

        this.showScreen('streamingScreen');
        this.showToast('Camera and mic ready!', 'success');

        // --- THIS IS THE FINAL LOGIC FIX ---
        // The HOST is now responsible for starting the call.
        // This ensures `this.call` is always correctly set for the host.
        if (this.isHost && this.connection && this.connection.open) {
            this.startCall(this.localStream);
        }
        // The viewer no longer starts the call; they will just wait to receive it.
        // --- END OF FIX ---

    } catch (error) {
        console.error('Failed to get user media:', error);
        this.showToast('Could not access camera/mic.', 'error');
        this.showScreen('streamingScreen');
    }
}

    handleIncomingConnection(conn) {
        if (this.connection && this.connection.open) {
            conn.close();
            return;
        }
        this.connection = conn;
        conn.on('open', () => this.setupLocalMedia()); 
        conn.on('close', () => this.cleanup());
    }
    
    handleIncomingCall(call) {
        this.call = call;
        call.answer(this.localStream);
        call.on('stream', (remoteStream) => {
            this.remoteVideo.srcObject = remoteStream;
        });
        call.on('close', () => this.cleanup());
    }

    startCall(streamToSend) {
        this.call = this.peer.call(this.connection.peer, streamToSend);
        this.call.on('stream', (remoteStream) => {
            this.remoteVideo.srcObject = remoteStream;
        });
    }
    
    handleScreenShareToggle() {
        if (!this.isHost) return this.showToast("Only the host can share.", "warning");
        if (this.isSharingScreen) this.stopScreenSharing();
        else this.showScreenSelection();
    }

    async showScreenSelection() {
        try {
            const sources = await window.electronAPI.getDesktopSources();
            this.populateScreenSources(sources);
            this.screenSelectModal.style.display = 'flex';
        } catch (error) {
            this.showToast('Failed to get screens', 'error');
        }
    }

    confirmScreenSelection() {
    if (this.selectedScreenSource) {
        // First, save the screen source to a temporary variable
        const sourceToShare = this.selectedScreenSource;
        
        // NOW, hide the selection window (which erases the original)
        this.hideScreenSelection();
        
        // Finally, start the sharing process using the saved variable
        this.startScreenSharing(sourceToShare);
    }
}

    async startScreenSharing(source) {
    console.log("HOST DEBUG: Attempting to start screen sharing...");
    if (!source) {
        return this.showToast('Screen selection was lost.', 'error');
    }
    try {
        const screenVideoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id,
                    maxWidth: 1280,
                    maxHeight: 720,
                    maxFrameRate: 24 
                }
            }
        });
        this.screenStream = screenVideoStream;

        // This is the critical check. Is the call object ready?
        if (this.call && this.call.open) {
            console.log("HOST DEBUG: Active call found! Replacing video track now.");
            const sender = this.call.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(this.screenStream.getVideoTracks()[0]);
                this.isSharingScreen = true;
                this.toggleScreenShareBtn.classList.add('active');
                this.showToast('Screen sharing started!', 'success');
            } else {
                console.error("HOST DEBUG: Could not find a video sender to replace.");
                this.showToast('Error: Could not find video track to replace.', 'error');
            }
        } else {
            // This is the message we expect to see
            console.error("HOST DEBUG: FAILED to find an active call (this.call is null or not open). Cannot share screen.");
            this.showToast('Error: No active call to share screen on.', 'error');
        }
    } catch (error) {
        console.error("SCREEN SHARE FAILED with an error:", error);
        this.showToast('Screen sharing failed.', 'error');
    }
}
    stopScreenSharing() {
        if (this.call?.open && this.localStream) {
            const sender = this.call.peerConnection.getSenders().find(s => s.track.kind === 'video');
            sender.replaceTrack(this.localStream.getVideoTracks()[0]);
            this.screenStream?.getTracks().forEach(track => track.stop());
            this.screenStream = null;
            this.isSharingScreen = false;
            this.toggleScreenShareBtn.classList.remove('active');
        }
    }

    toggleMuteAudio() {
        if (this.localStream?.getAudioTracks().length > 0) {
            const track = this.localStream.getAudioTracks()[0];
            track.enabled = !track.enabled;
            this.isMuted = !track.enabled;
            this.toggleMute.innerHTML = this.isMuted ? '🔇' : '🎤';
        }
    }

    toggleVideoEnabled() {
        if (this.localStream?.getVideoTracks().length > 0) {
            const track = this.localStream.getVideoTracks()[0];
            track.enabled = !track.enabled;
            this.isVideoEnabled = track.enabled;
            this.toggleVideo.innerHTML = this.isVideoEnabled ? '📹' : '📷';
            this.localVideo.style.visibility = this.isVideoEnabled ? 'visible' : 'hidden';
        }
    }

    endCall() {
        this.cleanup();
        this.showWelcome();
    }
    
    cleanup() {
        this.call?.close();
        this.connection?.close();
        this.peer?.destroy();
        [this.localStream, this.remoteStream, this.screenStream].forEach(s => s?.getTracks().forEach(t => t.stop()));
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        Object.assign(this, { peer: null, connection: null, call: null, localStream: null, remoteStream: null, screenStream: null, roomId: null, selectedScreenSource: null, isHost: false, isConnected: false, isMuted: false, isSharingScreen: false, isVideoEnabled: true });
        this.toggleScreenShareBtn.classList.remove('active');
    }
    
    // Helper Functions
    generateSecureRoomId() { const t=Date.now().toString(36),r=Math.random().toString(36).substr(2,6);return`ROOM-${t}-${r}`.toUpperCase() }
    validateRoomId(r){if(!r||"string"!=typeof r)return!1;const t=r.trim();return!(t.length<5||t.length>50)&&/^[A-Z0-9\-_]+$/i.test(t)}
    showJoinRoom() { this.isHost = false; this.showScreen('joinRoomScreen'); this.roomIdInput.focus(); }
    showWelcome() { this.showScreen('welcomeScreen'); this.cleanup(); }
    showScreen(e){document.querySelectorAll(".screen").forEach(e=>e.classList.remove("active"));document.getElementById(e).classList.add("active")}
    async copyRoomIdToClipboard(){try{await navigator.clipboard.writeText(this.roomId)}catch(e){}}
    populateScreenSources(e){this.screenSources.innerHTML="";e.forEach(e=>{const t=document.createElement("div");t.className="screen-source",t.dataset.sourceId=e.id,t.innerHTML=`<img src="${e.thumbnail.toDataURL()}" alt="${e.name}"><div>${e.name}</div>`,t.addEventListener("click",()=>{document.querySelectorAll(".screen-source").forEach(e=>e.classList.remove("selected")),t.classList.add("selected"),this.selectedScreenSource=e,this.confirmScreenSelect.disabled=!1}),this.screenSources.appendChild(t)})}
    hideScreenSelection(){this.screenSelectModal.style.display="none",this.selectedScreenSource=null,this.confirmScreenSelect.disabled=!0}
    async generateHostPeerId(e){const t=await this.simpleHash(e);return`moviewatch-host-${t}`}
    async simpleHash(e){let t=0;for(let o=0;o<e.length;o++){const n=e.charCodeAt(o);t=(t<<5)-t+n,t&=t}return Math.abs(t).toString(36)}
    showToast(e,t="info"){this.toast.textContent=e,this.toast.className=`toast ${t} show`,setTimeout(()=>{this.toast.classList.remove("show")},3e3)}
}

document.addEventListener('DOMContentLoaded', () => {
    window.movieWatchApp = new MovieWatchApp();
});

