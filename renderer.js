// Movie Watch Together - Renderer Process
class MovieWatchApp {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.call = null;
        this.localStream = null; // This will hold ONLY the user's camera/mic
        this.remoteStream = null;
        this.screenStream = null; // This will hold ONLY the screen/system audio
        this.isHost = false;
        this.roomId = null;
        this.selectedScreenSource = null;
        this.isConnected = false;
        this.isMuted = false;
        this.isVideoEnabled = true;

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // ... (No changes in this function) ...
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.createRoomScreen = document.getElementById('createRoomScreen');
        this.joinRoomScreen = document.getElementById('joinRoomScreen');
        this.streamingScreen = document.getElementById('streamingScreen');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.backFromCreate = document.getElementById('backFromCreate');
        this.backFromJoin = document.getElementById('backFromJoin');
        this.selectScreenBtn = document.getElementById('selectScreenBtn');
        this.startSharingBtn = document.getElementById('startSharingBtn');
        this.connectBtn = document.getElementById('connectBtn');
        this.copyRoomId = document.getElementById('copyRoomId');
        this.closeScreenSelect = document.getElementById('closeScreenSelect');
        this.confirmScreenSelect = document.getElementById('confirmScreenSelect');
        this.toggleMute = document.getElementById('toggleMute');
        this.toggleVideo = document.getElementById('toggleVideo');
        this.endCall = document.getElementById('endCall');
        this.generatedRoomId = document.getElementById('generatedRoomId');
        this.roomIdInput = document.getElementById('roomIdInput');
        this.hostStatus = document.getElementById('hostStatus');
        this.joinStatus = document.getElementById('joinStatus');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.screenSelectModal = document.getElementById('screenSelectModal');
        this.screenSources = document.getElementById('screenSources');
        this.toast = document.getElementById('toast');
    }

    attachEventListeners() {
        // ... (No changes in this function) ...
        this.createRoomBtn.addEventListener('click', () => this.showCreateRoom());
        this.joinRoomBtn.addEventListener('click', () => this.showJoinRoom());
        this.backFromCreate.addEventListener('click', () => this.showWelcome());
        this.backFromJoin.addEventListener('click', () => this.showWelcome());
        this.selectScreenBtn.addEventListener('click', () => this.showScreenSelection());
        this.startSharingBtn.addEventListener('click', () => this.startScreenSharing());
        this.connectBtn.addEventListener('click', () => this.joinRoom());
        this.copyRoomId.addEventListener('click', () => this.copyRoomIdToClipboard());
        this.closeScreenSelect.addEventListener('click', () => this.hideScreenSelection());
        this.confirmScreenSelect.addEventListener('click', () => this.confirmScreenSelection());
        this.toggleMute.addEventListener('click', () => this.toggleMuteAudio());
        this.toggleVideo.addEventListener('click', () => this.toggleVideoEnabled());
        this.endCall.addEventListener('click', () => this.endCall());
        this.roomIdInput.addEventListener('input', (e) => {
            this.connectBtn.disabled = !e.target.value.trim();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.connectBtn.disabled) {
                this.joinRoom();
            }
        });
    }

    setupPeerEventHandlers() {
        // ... (No changes in this function) ...
        if (!this.peer) return;
        this.peer.on('connection', (conn) => this.handleIncomingConnection(conn));
        this.peer.on('call', (call) => this.handleIncomingCall(call));
        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.showToast('Disconnected from server - attempting reconnect...', 'warning');
            setTimeout(() => {
                if (this.peer && !this.peer.destroyed) this.peer.reconnect();
            }, 3000);
        });
        this.peer.on('close', () => {
            console.log('Peer connection closed');
            this.showToast('Connection closed', 'warning');
        });
    }

    // --- FIX 1: This function is now more robust. It uses a predictable ID for the host. ---
    async showCreateRoom() {
        this.isHost = true;
        this.roomId = this.generateSecureRoomId();
        this.generatedRoomId.value = this.roomId;

        try {
            const hostPeerId = await this.generateHostPeerId(this.roomId);
            console.log('HOST IS REGISTERING WITH PEER ID:', hostPeerId);

            this.peer = new Peer(hostPeerId, {
                host: '0.peerjs.com', port: 443, path: '/', secure: true,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });

            this.setupPeerEventHandlers();
            this.showScreen('createRoomScreen');
            this.hostStatus.textContent = 'Waiting for friend to join...';
            this.showToast('Room created! Share the ID.', 'success');
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showToast('Error creating room. Please try again.', 'error');
            this.showWelcome();
        }
    }
    
    // --- FIX 2: This function now correctly initializes the viewer's peer connection. ---
    async joinRoom() {
        const inputRoomId = this.roomIdInput.value.trim();
        if (!this.validateRoomId(inputRoomId)) {
            return this.showToast('Please enter a valid Room ID', 'warning');
        }

        try {
            this.joinStatus.textContent = 'Connecting...';
            this.connectBtn.disabled = true;

            if (!this.peer) {
                this.peer = new Peer(undefined, {
                    host: '0.peerjs.com', port: 443, path: '/', secure: true,
                    config: {
                        'iceServers': [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' }
                        ]
                    }
                });
                this.setupPeerEventHandlers();
            }

            await new Promise((resolve, reject) => {
                if (this.peer.open) return resolve();
                this.peer.on('open', resolve);
                this.peer.on('error', reject);
                setTimeout(() => reject(new Error("Signaling server timeout")), 10000);
            });

            this.showToast('Connecting to room...', 'info');
            const hostPeerId = await this.generateHostPeerId(inputRoomId);
            console.log('VIEWER IS TRYING TO CONNECT TO PEER ID:', hostPeerId);
            
            this.connection = this.peer.connect(hostPeerId, { reliable: true });

            this.connection.on('open', () => {
                this.isConnected = true;
                this.joinStatus.textContent = 'Connected! Waiting for host to start sharing...';
                this.showToast('Successfully joined room!', 'success');
                this.setupLocalMedia(); // --- FIX 3: Get camera/mic as soon as we connect. ---
            });
            // ... (rest of the connection handlers remain the same)
             const connectionTimeout = setTimeout(() => {
                if (this.connection && !this.connection.open) {
                    this.connection.close();
                    this.showToast('Connection timeout - room may not exist', 'error');
                    this.connectBtn.disabled = false;
                    this.joinStatus.textContent = 'Connection failed';
                }
            }, 15000);

            this.connection.on('open', () => {
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.joinStatus.textContent = 'Connected! Waiting for host to start sharing...';
                this.showToast('Successfully joined room!', 'success');
                this.setupLocalMedia();
            });

            this.connection.on('error', (error) => {
                clearTimeout(connectionTimeout);
                console.error('Connection error:', error);
                this.showToast(`Failed to connect: ${error.message}`, 'error');
                this.connectBtn.disabled = false;
                this.joinStatus.textContent = 'Connection failed';
            });

            this.connection.on('close', () => {
                clearTimeout(connectionTimeout);
                this.showToast('Host disconnected', 'warning');
                this.cleanup();
            });

        } catch (error) {
            console.error('Failed to join room:', error);
            this.showToast(`Join failed: ${error.message}`, 'error');
            this.connectBtn.disabled = false;
            this.joinStatus.textContent = 'Join failed';
        }
    }

    // --- FIX 4: This NEW function gets the user's camera/mic. It fixes the mute/video buttons. ---
    async setupLocalMedia() {
        try {
            this.showToast('Setting up camera and microphone...', 'info');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            this.localStream = stream;
            this.localVideo.srcObject = stream;
            this.showScreen('streamingScreen');
            this.showToast('Camera and mic ready!', 'success');
        } catch (error) {
            console.error('Failed to get user media:', error);
            if (error.name === 'NotAllowedError') {
                this.showToast('Please allow camera and microphone access.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showToast('No camera or microphone found.', 'warning');
            } else {
                this.showToast('Could not access camera/mic.', 'error');
            }
            // Still go to the streaming screen even if media fails
            this.showScreen('streamingScreen');
        }
    }

    // --- FIX 5: This function is completely rewritten to be modern and reliable. ---
    async startScreenSharing() {
        if (!this.selectedScreenSource) {
            return this.showToast('Please select a screen first', 'warning');
        }

        try {
            this.showToast('Starting screen capture...', 'info');

            // 1. Get the screen video stream
            const screenVideoStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: this.selectedScreenSource.id,
                        maxWidth: 1920,
                        maxHeight: 1080
                    }
                }
            });

            // 2. Try to get system audio stream
            let systemAudioStream = null;
            try {
                systemAudioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: this.selectedScreenSource.id,
                        }
                    },
                    video: false
                });
            } catch (e) {
                console.warn("Could not get system audio. This is normal if you're sharing a window that has no audio.");
                this.showToast("Sharing without system audio.", "info");
            }
            
            // 3. We should already have the microphone from localStream
            const micAudioStream = this.localStream;
            
            // 4. Mix audio if we have it
            const finalAudioTrack = this.mixAudio(systemAudioStream, micAudioStream);
            
            // 5. Combine screen video and mixed audio into the final stream
            this.screenStream = new MediaStream([
                screenVideoStream.getVideoTracks()[0],
                ...(finalAudioTrack ? [finalAudioTrack] : [])
            ]);

            this.showToast('Screen sharing started!', 'success');

            // 6. Start the call to the other user
            if (this.connection && this.connection.open) {
                this.startCall(this.screenStream); // Call with the screen stream
            }
        } catch (error) {
            console.error('Failed to start screen sharing:', error);
            this.showToast(`Screen sharing failed: ${error.message}`, 'error');
        }
    }
    
    // --- FIX 6: This NEW helper function handles audio mixing. ---
    mixAudio(systemStream, micStream) {
        if (!systemStream && !micStream) return null;
        if (systemStream && !micStream) return systemStream.getAudioTracks()[0];
        if (!systemStream && micStream) return micStream.getAudioTracks()[0];

        try {
            const audioContext = new AudioContext();
            const systemSource = audioContext.createMediaStreamSource(systemStream);
            const micSource = audioContext.createMediaStreamSource(micStream);
            const destination = audioContext.createMediaStreamDestination();

            const systemGain = audioContext.createGain();
            const micGain = audioContext.createGain();
            systemGain.gain.value = 0.9; // System audio at 90%
            micGain.gain.value = 1.0; // Mic at 100%

            systemSource.connect(systemGain).connect(destination);
            micSource.connect(micGain).connect(destination);
            
            this.showToast("Mixed system audio + microphone", "success");
            return destination.stream.getAudioTracks()[0];
        } catch(e) {
            console.error("Audio mixing failed:", e);
            this.showToast("Audio mixing failed, using mic only", "warning");
            return micStream.getAudioTracks()[0];
        }
    }
    
    // --- FIX 7: The call logic is now simpler and more direct. ---
    startCall(streamToSend) {
        if (!this.connection || !this.connection.open || !streamToSend) {
            return this.showToast('Cannot start call: Not connected or no media.', 'error');
        }

        // Host calls Viewer with the screen stream.
        // Viewer calls Host with their local camera/mic stream.
        this.call = this.peer.call(this.connection.peer, streamToSend);

        this.call.on('stream', (remoteStream) => {
            this.remoteStream = remoteStream;
            this.remoteVideo.srcObject = remoteStream;
            this.showToast('Receiving video stream!', 'success');
        });

        this.call.on('close', () => this.cleanup());
        this.call.on('error', (e) => {
            console.error("Call error:", e);
            this.showToast("Call error.", "error");
        });
    }

    handleIncomingConnection(conn) {
        this.connection = conn;
        conn.on('open', () => {
            this.isConnected = true;
            this.hostStatus.textContent = 'Friend connected! You can now start sharing.';
            document.getElementById('hostControls').style.display = 'block';
            this.showToast('Friend joined the room!', 'success');
            // Host also needs to get their camera/mic ready
            this.setupLocalMedia();
        });
        conn.on('close', () => this.cleanup());
        conn.on('error', (e) => console.error("Connection error:", e));
    }

    handleIncomingCall(call) {
        this.call = call;
        // Answer the call with our local camera/mic stream
        call.answer(this.localStream);

        call.on('stream', (remoteStream) => {
            this.remoteStream = remoteStream;
            this.remoteVideo.srcObject = remoteStream;
        });
        call.on('close', () => this.cleanup());
        call.on('error', (e) => console.error("Incoming call error:", e));
    }

    // --- FIX 8: All media control buttons will now work correctly. ---
    toggleMuteAudio() {
        if (this.localStream && this.localStream.getAudioTracks().length > 0) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            this.toggleMute.innerHTML = this.isMuted ? '🔇' : '🎤';
            this.showToast(this.isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
        }
    }

    toggleVideoEnabled() {
        if (this.localStream && this.localStream.getVideoTracks().length > 0) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            this.isVideoEnabled = videoTrack.enabled;
            this.toggleVideo.innerHTML = this.isVideoEnabled ? '📹' : '📷';
            this.localVideo.style.visibility = this.isVideoEnabled ? 'visible' : 'hidden';
            this.showToast(this.isVideoEnabled ? 'Camera enabled' : 'Camera disabled', 'info');
        }
    }

    endCall() {
        this.showToast('Call ended', 'info');
        this.cleanup();
        this.showWelcome();
    }
    
    cleanup() {
        // ... (Cleanup is now more robust) ...
        try {
            if (this.call) this.call.close();
            if (this.connection) this.connection.close();
            if (this.peer) this.peer.destroy();
            
            [this.localStream, this.remoteStream, this.screenStream].forEach(stream => {
                stream?.getTracks().forEach(track => track.stop());
            });

            this.localVideo.srcObject = null;
            this.remoteVideo.srcObject = null;
            
            // Reset all state variables
            this.peer = this.connection = this.call = this.localStream = this.remoteStream = this.screenStream = this.roomId = this.selectedScreenSource = null;
            this.isHost = this.isConnected = this.isMuted = false;
            this.isVideoEnabled = true;

            // Reset UI
            this.selectScreenBtn.textContent = 'Select Screen to Share';
            this.startSharingBtn.disabled = true;
            this.toggleMute.innerHTML = '🎤';
            this.toggleVideo.innerHTML = '📹';
            document.getElementById('hostControls').style.display = 'none';

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    
    // --- Other functions with minor or no changes ---
    confirmScreenSelection() {
        if (this.selectedScreenSource) {
            const selectedSourceName = this.selectedScreenSource.name;
            this.hideScreenSelection(); 
            this.selectScreenBtn.textContent = `Selected: ${selectedSourceName}`;
            this.startSharingBtn.disabled = false;
            this.showToast('Screen selected. Ready to start sharing!', 'success');
        }
    }

    async showScreenSelection() {
        try {
            const sources = await window.electronAPI.getDesktopSources();
            this.populateScreenSources(sources);
            this.screenSelectModal.style.display = 'flex';
        } catch (error) {
            console.error('Failed to get screen sources:', error);
            this.showToast('Failed to get available screens', 'error');
        }
    }
    
    // ... (The rest of the utility functions like populateScreenSources, showToast, etc., are fine) ...
    generateSecureRoomId() { const t=Date.now().toString(36),r=Math.random().toString(36).substr(2,6);return`ROOM-${t}-${r}`.toUpperCase() }
    validateRoomId(r){if(!r||"string"!=typeof r)return!1;const t=r.trim();return!(t.length<5||t.length>50)&&/^[A-Z0-9\-_]+$/i.test(t)}
    showJoinRoom() { this.isHost = false; this.showScreen('joinRoomScreen'); this.roomIdInput.focus(); }
    showWelcome() { this.showScreen('welcomeScreen'); this.cleanup(); }
    showScreen(e){document.querySelectorAll(".screen").forEach(e=>{e.classList.remove("active")}),document.getElementById(e).classList.add("active")}
    async copyRoomIdToClipboard(){try{await navigator.clipboard.writeText(this.roomId),this.showToast("Room ID copied to clipboard!","success"),this.copyRoomId.textContent="Copied!",setTimeout(()=>{this.copyRoomId.textContent="Copy"},2e3)}catch(e){console.error("Failed to copy:",e),this.showToast("Failed to copy Room ID","error")}}
    populateScreenSources(e){this.screenSources.innerHTML="",e.forEach((e,t)=>{const o=document.createElement("div");o.className="screen-source",o.dataset.sourceId=e.id,o.innerHTML=`\n                <img src="${e.thumbnail.toDataURL()}" alt="${e.name}">\n                <div class="source-info">\n                    <div class="source-name">${e.name}</div>\n                    <div class="source-type">${e.id.startsWith("screen")?"Screen":"Window"}</div>\n                </div>\n            `,o.addEventListener("click",()=>{document.querySelectorAll(".screen-source").forEach(e=>e.classList.remove("selected")),o.classList.add("selected"),this.selectedScreenSource=e,this.confirmScreenSelect.disabled=!1}),this.screenSources.appendChild(o)})}
    hideScreenSelection(){this.screenSelectModal.style.display="none",this.selectedScreenSource=null,this.confirmScreenSelect.disabled=!0}
    async generateHostPeerId(e){const t=await this.simpleHash(e);return`moviewatch-host-${t}`}
    async simpleHash(e){let t=0;for(let o=0;o<e.length;o++){const n=e.charCodeAt(o);t=(t<<5)-t+n,t&=t}return Math.abs(t).toString(36)}
    showToast(e,t="info"){this.toast.textContent=e,this.toast.className=`toast ${t} show`,setTimeout(()=>{this.toast.classList.remove("show")},3e3)}
}

document.addEventListener('DOMContentLoaded', () => {
    window.movieWatchApp = new MovieWatchApp();
});

