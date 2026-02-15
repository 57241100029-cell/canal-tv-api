// locutor.js

const socket = io();
const peerConnections = {}; // Map: socketId -> RTCPeerConnection
let localStream = null;
let audioContext = null;
let analyser = null;
let microphoneSource = null;
let animationId = null;

// Configuración WebRTC
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

// Elementos del DOM
const btnStart = document.getElementById("btnStart");
const btnToggleMic = document.getElementById("btnToggleMic");
const statusText = document.getElementById("statusText");
const localVideo = document.getElementById("localVideo");
const viewersCount = document.getElementById("viewersCount");
const micStatusIndicator = document.getElementById("micStatusIndicator");
const micSelect = document.getElementById("micSelect");
const volumeMeter = document.getElementById("volumeMeter");

// Chat DOM
const chatBody = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

micStatusIndicator.style.display = 'none';

/* =========================
   Inicialización Dispositivos
========================= */
async function getDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); // Pedir permiso primero para listar labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        micSelect.innerHTML = "";
        audioInputs.forEach(device => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.text = device.label || `Micrófono ${micSelect.length + 1}`;
            micSelect.appendChild(option);
        });
    } catch (e) {
        console.error("Error listando dispositivos:", e);
    }
}
getDevices();

/* =========================
   Lógica de Transmisión
========================= */

btnStart.addEventListener("click", async () => {
    if (localStream) {
        stopBroadcast();
    } else {
        startBroadcast();
    }
});

btnToggleMic.addEventListener("click", () => {
    if (!localStream) return;
    toggleMic();
});

async function startBroadcast() {
    try {
        statusText.innerText = "Conectando...";
        const audioSource = micSelect.value;

        // Constraints con selector de dispositivo
        const constraints = {
            audio: {
                deviceId: audioSource ? { exact: audioSource } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: { width: 1280, height: 720, frameRate: 30 }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream;

        // Preview
        localVideo.srcObject = stream;

        // INICIAR MONITOR DE AUDIO (VISUALIZADOR)
        startAudioMonitor(stream);

        // UI Update
        btnStart.innerText = "DETENER";
        btnStart.className = "btnGhost";
        btnStart.style.backgroundColor = "#cc0000";
        btnStart.style.color = "#fff";
        statusText.innerText = "Transmitiendo (En el Aire)";
        micSelect.disabled = true;

        btnToggleMic.disabled = false;
        updateMicUI();
        micStatusIndicator.style.display = 'flex';

        // Avisar al servidor
        socket.emit("broadcaster");

    } catch (error) {
        console.error("Error al iniciar:", error);
        statusText.innerText = "Error: " + error.message;
    }
}

function stopBroadcast() {
    stopAudioMonitor();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }

    Object.keys(peerConnections).forEach(id => {
        peerConnections[id].close();
        delete peerConnections[id];
    });

    // UI Update
    btnStart.innerText = "INICIAR TRANSMISIÓN";
    btnStart.className = "btnPrimary";
    btnStart.style.backgroundColor = "";
    btnStart.style.color = "";
    statusText.innerText = "Desconectado";
    micSelect.disabled = false;

    btnToggleMic.disabled = true;
    micStatusIndicator.style.display = 'none';
    volumeMeter.style.width = "0%";
}

function toggleMic() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        updateMicUI();
    }
}

function updateMicUI() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack && audioTrack.enabled) {
        btnToggleMic.innerText = "🎙️ Silenciar Mic";
        micStatusIndicator.innerHTML = "🎙️ ON";
        micStatusIndicator.style.color = "#0f0";
    } else {
        btnToggleMic.innerText = "🔇 Activar Mic";
        micStatusIndicator.innerHTML = "🔇 OFF";
        micStatusIndicator.style.color = "#e50914";
        volumeMeter.style.width = "0%"; // Forzar barra a 0 visualmente
    }
}

/* =========================
   Monitor de Audio (Visualizador)
========================= */
function startAudioMonitor(stream) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    microphoneSource = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    microphoneSource.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
        if (!localStream) return;

        // Si el track está deshabilitado por el botón mute, no mostrar volumen
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack || !audioTrack.enabled) {
            volumeMeter.style.width = "0%";
            animationId = requestAnimationFrame(draw);
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Escalar 0-255 a porcentaje (aprox)
        const volume = Math.min(100, average * 2);
        volumeMeter.style.width = volume + "%";

        // Color cambia si satura
        volumeMeter.style.backgroundColor = volume > 80 ? "red" : "limegreen";

        animationId = requestAnimationFrame(draw);
    }
    draw();
}

function stopAudioMonitor() {
    if (animationId) cancelAnimationFrame(animationId);
    if (microphoneSource) microphoneSource.disconnect();
    if (analyser) analyser.disconnect();
    // No cerramos audioContext para reusarlo
}

/* =========================
   WebRTC Signaling Events
========================= */
socket.on("watcher", id => {
    if (!localStream) return;
    const peerConnection = new RTCPeerConnection(config);
    peerConnections[id] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("candidate", id, event.candidate);
        }
    };

    peerConnection
        .createOffer()
        .then(sdp => peerConnection.setLocalDescription(sdp))
        .then(() => {
            socket.emit("offer", id, peerConnection.localDescription);
        })
        .catch(e => console.error(e));
});

socket.on("answer", (id, description) => {
    if (peerConnections[id]) {
        peerConnections[id].setRemoteDescription(description);
    }
});

socket.on("candidate", (id, candidate) => {
    if (peerConnections[id]) {
        peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
    }
});

socket.on("disconnectPeer", id => {
    if (peerConnections[id]) {
        peerConnections[id].close();
        delete peerConnections[id];
    }
});

/* =========================
   Chat & Viewers Logic
========================= */
socket.on("viewers", (data) => {
    viewersCount.innerText = data.count;
});

const myName = "Locutor";
const myColor = "#e50914";

function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `
    <div class="msgTop">
      <span class="msgName" style="color:${msg.color}">${msg.name}</span>
      <span class="msgTime">${new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="msgText">${msg.text}</div>
  `;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}

socket.on("chat:history", (history) => {
    chatBody.innerHTML = "";
    history.forEach(appendMessage);
});

socket.on("chat:msg", (msg) => {
    appendMessage(msg);
});

chatSend.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    socket.emit("chat:send", { name: myName, color: myColor, text: text });
    chatInput.value = "";
}
