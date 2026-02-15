// server.js - NVK TV (WebRTC Audio Only)
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

/* =========================
   Configuración
========================= */
const PORT = process.env.PORT || 3000;
const CHAT_FILE = path.join(__dirname, "chat_history.json");

/* =========================
   Express + Socket.IO
========================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir acceso desde cualquier origen (útil para desarrollo/Render)
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos
app.use(express.static(__dirname));

// Rutas dedicadas
app.get("/locutor", (req, res) => {
  res.sendFile(path.join(__dirname, "locutor.html"));
});

// Por defecto index.html (Oyente)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   Estado Global
========================= */
let viewers = 0;
let broadcasterSocketId = null; // ID del socket del locutor actual
let chatHistory = [];
const MAX_HISTORY = 100;

/* =========================
   Cargar Historial Chat
========================= */
if (fs.existsSync(CHAT_FILE)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    console.log(`[Chat] Cargados ${chatHistory.length} mensajes previos.`);
  } catch (e) {
    console.error("[Chat] Error cargando historial:", e);
    chatHistory = [];
  }
}

function saveChat() {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chatHistory, null, 2));
  } catch (e) {
    console.error("[Chat] Error guardando historial:", e);
  }
}

/* =========================
   Socket.IO Logic
========================= */
io.on("connection", (socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  // Actualizar contador de viewers (solo si no es el broadcaster, o simplificado: todos son conexiones)
  // Para ser más precisos, podríamos contar solo los que se unen como 'viewer'.
  // Por simplicidad, incrementamos al conectar y decrementamos al desconectar, 
  // pero luego ajustaremos si es broadcaster.
  viewers++;
  io.emit("viewers", { count: viewers });

  // Enviar historial de chat
  socket.emit("chat:history", chatHistory);

  // --- CHAT ---
  socket.on("chat:send", (payload) => {
    if (!payload || typeof payload.text !== "string") return;
    const text = payload.text.trim();
    if (!text) return;

    const msg = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: typeof payload.name === "string" ? payload.name.slice(0, 24) : "Invitado",
      color: typeof payload.color === "string" ? payload.color : "#e50914",
      text: text.slice(0, 300),
      ts: Date.now(),
    };

    chatHistory.push(msg);
    if (chatHistory.length > MAX_HISTORY) chatHistory.shift(); // Optimizado: shift es O(N) pero array es pequeño

    saveChat();
    io.emit("chat:msg", msg);
  });

  // --- WEBRTC SIGNALING ---

  // 1. Locutor se identifica
  socket.on("broadcaster", () => {
    broadcasterSocketId = socket.id;
    socket.broadcast.emit("broadcaster"); // Avisar a los oyentes que hay un locutor (opcional)
    console.log(`[WebRTC] Locutor registrado: ${socket.id}`);
  });

  // 2. Oyente (Viewer) quiere ver/escuchar
  socket.on("watcher", () => {
    if (broadcasterSocketId) {
      // Le decimos al locutor que un nuevo visualizador quiere conectarse
      console.log(`[WebRTC] Nuevo oyente ${socket.id} solicitando stream al locutor ${broadcasterSocketId}`);
      io.to(broadcasterSocketId).emit("watcher", socket.id);
    } else {
      console.warn(`[WebRTC] Oyente ${socket.id} intentó conectar pero no hay locutor.`);
    }
  });

  // 3. Intercambio de SDP (Offer/Answer) y ICE Candidates
  socket.on("offer", (id, message) => {
    // Locutor envía Offer al Oyente específico (id)
    io.to(id).emit("offer", socket.id, message);
  });

  socket.on("answer", (id, message) => {
    // Oyente envía Answer al Locutor (id)
    io.to(id).emit("answer", socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    // ICE candidates entre peers
    io.to(id).emit("candidate", socket.id, message);
  });

  // --- DESCONEXIÓN ---
  socket.on("disconnect", () => {
    console.log(`[Socket] Desconectado: ${socket.id}`);

    // Si se va el locutor
    if (socket.id === broadcasterSocketId) {
      broadcasterSocketId = null;
      socket.broadcast.emit("broadcaster-left"); // Avisar a oyentes para que limpien o muestren "Offline"
      console.log(`[WebRTC] El locutor se ha desconectado.`);
    } else {
      // Es un oyente, avisar al locutor para que cierre esa PeerConnection y libere memoria
      if (broadcasterSocketId) {
        io.to(broadcasterSocketId).emit("disconnectPeer", socket.id);
      }
    }

    viewers = Math.max(0, viewers - 1);
    io.emit("viewers", { count: viewers });
  });
});

/* =========================
   Iniciar Servidor
========================= */
server.listen(PORT, () => {
  console.log("==================================");
  console.log(" 🎙️  NVK RADIO (WebRTC) CORRIENDO");
  console.log(` 🏠 Local:   http://localhost:${PORT}`);
  console.log(` 📻 Locutor: http://localhost:${PORT}/locutor`);
  console.log("==================================");
});
