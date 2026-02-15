// player.js - NVK TV (FIX)
// ✅ siempre usa el mismo origen (sirve para local + ngrok)

(() => {
  const $ = (id) => document.getElementById(id);

  const video = $("video");
  const playBtn = $("playBtn");
  const muteBtn = $("muteBtn");
  const volSlider = $("volSlider");
  const fsBtn = $("fsBtn");
  const progressBar = $("progressBar");
  const progressFill = $("progressFill");
  const progressLive = $("progressLive");
  const toast = $("toast");

  const audioFill = $("audioFill");
  const audioLabel = $("audioLabel");

  const viewerCount = $("viewerCount");
  const chatList = $("chatList");
  const chatForm = $("chatForm");
  const chatInput = $("chatInput");
  const chatMeta = $("chatMeta");

  const chatSettingsBtn = $("chatSettingsBtn");
  const settingsModal = $("settingsModal");
  const settingsClose = $("settingsClose");
  const usernameInput = $("usernameInput");
  const saveUsername = $("saveUsername");
  const toggleChat = $("toggleChat");
  const toggleChatText = $("toggleChatText");
  const floatingSettingsBtn = $("floatingSettingsBtn");

  const qualityBtn = $("qualityBtn");
  const qualityMenu = $("qualityMenu");

  const LS_NAME = "nvkName";
  const LS_COLOR = "nvkColor";
  const LS_CHAT_VISIBLE = "nvkChatVisible";

  function randomColorStable() {
    const palette = ["#e50914", "#ff4d4f", "#ff6b6b", "#d7263d", "#f03e3e", "#c92a2a"];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  let username = localStorage.getItem(LS_NAME) || "Invitado";
  let userColor = localStorage.getItem(LS_COLOR);
  if (!userColor) {
    userColor = randomColorStable();
    localStorage.setItem(LS_COLOR, userColor);
  }

  let chatVisible = localStorage.getItem(LS_CHAT_VISIBLE);
  chatVisible = (chatVisible === null) ? true : (chatVisible === "true");

  function applyChatVisibility() {
    document.body.classList.toggle("chat-hidden", !chatVisible);
    toggleChatText.textContent = chatVisible ? "Ocultar" : "Mostrar";
  }
  applyChatVisibility();

  let toastT = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  // Quality (UI only)
  function closeQuality() {
    qualityMenu.style.display = "none";
    qualityBtn.setAttribute("aria-expanded", "false");
  }
  function openQuality() {
    qualityMenu.style.display = "block";
    qualityBtn.setAttribute("aria-expanded", "true");
  }
  qualityBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = qualityMenu.style.display === "block";
    open ? closeQuality() : openQuality();
  });
  qualityMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-q]");
    if (!btn) return;
    showToast(`Calidad: ${btn.dataset.q} (UI)`);
    closeQuality();
  });
  document.addEventListener("click", () => closeQuality());

  // Modal
  function openModal() {
    settingsModal.style.display = "flex";
    settingsModal.setAttribute("aria-hidden", "false");
    usernameInput.value = username;
    setTimeout(() => usernameInput.focus(), 30);
  }
  function closeModal() {
    settingsModal.style.display = "none";
    settingsModal.setAttribute("aria-hidden", "true");
  }
  chatSettingsBtn.addEventListener("click", openModal);
  floatingSettingsBtn.addEventListener("click", () => {
    if (!chatVisible) {
      chatVisible = true;
      localStorage.setItem(LS_CHAT_VISIBLE, "true");
      applyChatVisibility();
      showToast("Chat mostrado");
      return;
    }
    openModal();
  });
  settingsClose.addEventListener("click", closeModal);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeModal();
  });
  saveUsername.addEventListener("click", () => {
    const v = (usernameInput.value || "").trim().slice(0, 24);
    username = v || "Invitado";
    localStorage.setItem(LS_NAME, username);
    showToast("Apodo guardado");
    closeModal();
  });
  toggleChat.addEventListener("click", () => {
    chatVisible = !chatVisible;
    localStorage.setItem(LS_CHAT_VISIBLE, String(chatVisible));
    applyChatVisibility();
    showToast(chatVisible ? "Chat mostrado" : "Chat oculto");
  });

  // Socket.IO
  const socket = io();
  socket.on("connect", () => (chatMeta.textContent = "Conectado"));
  socket.on("disconnect", () => (chatMeta.textContent = "Desconectado"));
  socket.on("viewers", ({ count }) => (viewerCount.textContent = String(count ?? 0)));

  function formatTime(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function addMsgToUI(msg, { scroll = true } = {}) {
    const el = document.createElement("div");
    el.className = "msg";

    const top = document.createElement("div");
    top.className = "msgTop";

    const name = document.createElement("div");
    name.className = "msgName";
    name.textContent = msg.name || "Invitado";
    name.style.color = msg.color || "#e50914";

    const time = document.createElement("div");
    time.className = "msgTime";
    time.textContent = formatTime(msg.ts || Date.now());

    top.appendChild(name);
    top.appendChild(time);

    const text = document.createElement("div");
    text.className = "msgText";
    text.textContent = msg.text || "";

    el.appendChild(top);
    el.appendChild(text);
    chatList.appendChild(el);

    if (scroll) chatList.scrollTop = chatList.scrollHeight;
  }

  socket.on("chat:history", (history) => {
    chatList.innerHTML = "";
    (history || []).forEach((m) => addMsgToUI(m, { scroll: false }));
    chatList.scrollTop = chatList.scrollHeight;
  });

  socket.on("chat:msg", (msg) => addMsgToUI(msg, { scroll: true }));

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (chatInput.value || "").trim();
    if (!text) return;

    socket.emit("chat:send", { name: username, color: userColor, text });
    chatInput.value = "";
    chatInput.focus();
  });

  // ✅ STREAM URLS
  const streamUrlFlv = `${window.location.origin}/live/mistream.flv`;
  const streamUrlHls = `${window.location.origin}/hls/mistream.m3u8`;

  let flvPlayer = null;

  function initPlayer() {
    // 1. Intentar FLV (Mejor para PC/Baja latencia)
    if (window.flvjs && flvjs.isSupported()) {
      console.log("[Player] Usando FLV.js");
      flvPlayer = flvjs.createPlayer(
        { type: "flv", url: streamUrlFlv, isLive: true },
        {
          enableStashBuffer: true,
          stashInitialSize: 128,
          lazyLoad: false,
          autoCleanupSourceBuffer: true,
          enableWorker: false,
          isLive: true,
        }
      );
      flvPlayer.attachMediaElement(video);
      flvPlayer.on(flvjs.Events.ERROR, (e) => {
        console.error("FLV Error:", e);
        showToast("Stream no disponible o error en FLV.");
      });
      flvPlayer.load();
      showToast("Modo: FLV (Baja latencia)");
    }
    // 2. Fallback nativo (HLS) para móviles (Safari/iPhone)
    else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      console.log("[Player] Usando HLS Nativo");
      video.src = streamUrlHls;
      showToast("Modo: HLS (Compatibilidad móvil)");
    }
    else {
      showToast("Tu navegador no soporta el reproductor. Usa Chrome o Safari.");
    }
  }

  async function safePlay() {
    try {
      await video.play();
    } catch (err) {
      console.warn("Autoplay blocked:", err);
      showToast("Toca el reproductor para activar el audio y video");
      // Opcional: podrías mostrar un botón gigante de "PLAY" aquí si no lo tienes
      playBtn.textContent = "▶ TAP";
      playBtn.classList.add("pulse");
    }
  }

  // Controls
  function setPlayIcon() {
    playBtn.textContent = video.paused ? "▶" : "❚❚";
  }
  function setMuteIcon() {
    muteBtn.textContent = (video.muted || video.volume === 0) ? "🔇" : "🔊";
  }

  playBtn.addEventListener("click", async () => {
    if (video.paused) await safePlay();
    else video.pause();
  });
  video.addEventListener("click", async () => {
    if (video.paused) await safePlay();
    else video.pause();
  });
  video.addEventListener("play", () => {
    setPlayIcon();
    playBtn.classList.remove("pulse");
  });
  video.addEventListener("pause", setPlayIcon);
  setPlayIcon();

  muteBtn.addEventListener("click", () => {
    video.muted = !video.muted;
    setMuteIcon();
  });
  volSlider.addEventListener("input", () => {
    const v = Number(volSlider.value);
    video.volume = v;
    if (v > 0) video.muted = false;
    setMuteIcon();
  });
  setMuteIcon();

  const videoWrap = document.querySelector(".videoWrap");
  fsBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await videoWrap.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      showToast("Fullscreen no disponible");
    }
  });

  function updateProgressUI() {
    const d = video.duration;
    const t = video.currentTime;
    const seekable = Number.isFinite(d) && d > 0 && Number.isFinite(t);
    if (!seekable) {
      progressFill.style.width = "0%";
      progressBar.style.cursor = "default";
      progressLive.style.display = "block";
      return;
    }
    progressLive.style.display = "none";
    const pct = Math.max(0, Math.min(100, (t / d) * 100));
    progressFill.style.width = `${pct}%`;
    progressBar.style.cursor = "pointer";
  }
  video.addEventListener("timeupdate", updateProgressUI);
  video.addEventListener("durationchange", updateProgressUI);
  updateProgressUI();

  // Audio meter (opcional)
  let audioCtx = null, analyser = null, sourceNode = null, meterRAF = null, meterActive = false;

  function setAudioMeterOff() {
    if (!audioFill || !audioLabel) return;
    audioFill.style.width = "0%";
    audioLabel.textContent = "AUDIO: OFF";
    meterActive = false;
    if (meterRAF) cancelAnimationFrame(meterRAF);
    meterRAF = null;
  }

  function startAudioMeterIfPossible() {
    if (meterActive || !audioFill || !audioLabel || video.paused) return;

    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { });

      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.85;
      }

      if (!sourceNode) {
        sourceNode = audioCtx.createMediaElementSource(video);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
      }

      meterActive = true;
      audioLabel.textContent = "AUDIO: ON";

      const data = new Uint8Array(analyser.fftSize);

      const loop = () => {
        if (!meterActive || video.paused) return setAudioMeterOff();
        analyser.getByteTimeDomainData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const pct = Math.max(0, Math.min(100, Math.round(rms * 200)));
        audioFill.style.width = `${pct}%`;

        meterRAF = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setAudioMeterOff();
    }
  }

  video.addEventListener("play", startAudioMeterIfPossible);
  video.addEventListener("pause", setAudioMeterOff);

  initPlayer();
  showToast(`NVK TV listo. Esperando señal...`);
})();
