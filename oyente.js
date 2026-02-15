// oyente.js

const socket = io();
let peerConnection;
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

// UI Elements
const btnListen = document.getElementById("btnListen");
const statusText = document.getElementById("streamStatus");
const remoteVideo = document.getElementById("remoteVideo");
const overlay = document.getElementById("overlay");
const liveIndicator = document.getElementById("liveIndicator");
const viewersCount = document.getElementById("viewersCount");
const unmuteBtn = document.getElementById("unmuteBtn");

// Chat DOM
const chatBody = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const chatName = document.getElementById("chatName");
const chatSend = document.getElementById("chatSend");

/* =========================
   Lógica WebRTC (Oyente)
========================= */

socket.on("connect", () => {
    socket.emit("watcher");
});

socket.on("offer", (id, description) => {
    peerConnection = new RTCPeerConnection(config);

    peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then(sdp => peerConnection.setLocalDescription(sdp))
        .then(() => {
            socket.emit("answer", id, peerConnection.localDescription);
        });

    peerConnection.ontrack = event => {
        // Asignar stream
        remoteVideo.srcObject = event.streams[0];

        // UI Feedback
        statusText.innerText = "¡Transmisión En Vivo Detectada!";
        liveIndicator.style.display = "flex";

        // Intentar Autoplay Inteligente
        attemptAutoplay();
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("candidate", id, event.candidate);
        }
    };
});

function attemptAutoplay() {
    // 1. Intentar reproducir CON sonido
    remoteVideo.muted = false;
    remoteVideo.play()
        .then(() => {
            // Éxito total (raro en primera carga sin interacción, común si ya hubo)
            hideOverlay();
        })
        .catch(error => {
            console.log("Autoplay con audio bloqueado. Intentando Muted...", error);

            // 2. Intentar reproducir MUTED (generalmente funciona)
            remoteVideo.muted = true;
            remoteVideo.play()
                .then(() => {
                    // Se ve el video pero sin audio. Mostrar botón de "Unmute"
                    hideOverlay();
                    unmuteBtn.style.display = "block";
                })
                .catch(err => {
                    // 3. Falló todo (interacción requerida obligatoria)
                    console.log("Autoplay total bloqueado. Mostrando botón de inicio.", err);
                    btnListen.classList.remove("hidden");
                    statusText.innerText = "Dale Play para ver la transmisión";
                });
        });
}

function hideOverlay() {
    overlay.classList.add("hidden");
    // Esperar transición CSS y ocultar display
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 500);
}

// Botón de Unmute (cuando arranca muted)
unmuteBtn.addEventListener("click", () => {
    remoteVideo.muted = false;
    unmuteBtn.style.display = "none";
});

// Botón "VER Y ESCUCHAR" (cuando falla autoplay total)
btnListen.addEventListener("click", () => {
    remoteVideo.muted = false;
    remoteVideo.play();
    hideOverlay();
    unmuteBtn.style.display = "none";
});


/* =========================
   Eventos Socket 
========================= */
socket.on("candidate", (id, candidate) => {
    peerConnection
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error(e));
});

socket.on("broadcaster", () => {
    socket.emit("watcher");
});

socket.on("broadcaster-left", () => {
    if (peerConnection) peerConnection.close();
    // Reiniciar UI
    statusText.innerText = "Locutor desconectado (Offline)";
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
    btnListen.classList.add("hidden");
    unmuteBtn.style.display = "none";
    liveIndicator.style.display = "none";
    remoteVideo.srcObject = null;
});

socket.on("disconnectPeer", () => {
    if (peerConnection) peerConnection.close();
    statusText.innerText = "Desconectado.";
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
});

/* =========================
   Chat & Viewers Logic
========================= */
socket.on("viewers", (data) => {
    viewersCount.innerText = data.count;
});

const userColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

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
    const name = chatName.value.trim() || "Anónimo";
    if (!text) return;
    socket.emit("chat:send", { name: name, color: userColor, text: text });
    chatInput.value = "";
}
