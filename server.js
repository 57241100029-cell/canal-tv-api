const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ CONFIGURA AQUÍ TU CANAL (lo único que debes cambiar)
const CHANNEL_1 = {
  canal: 1,
  nombre: "Canal 1",
  descripcion: "Transmisión en vivo",
  live: true,

  // Pega aquí el VIDEO ID de tu LIVE de YouTube (NO el link completo)
  // Ejemplo: si tu link es https://www.youtube.com/watch?v=AbCdEf12345
  // entonces videoId = "AbCdEf12345"
  videoId: "TU_VIDEO_ID_AQUI"
};

// healthcheck
app.get("/", (req, res) => {
  res.send("Canal-TV API funcionando ✅");
});

// Endpoint del canal
app.get("/api/canal/1", (req, res) => {
  res.json(CHANNEL_1);
});

// (Opcional) cambiar live on/off rápido desde navegador con ?live=0 o ?live=1
app.get("/api/canal/1/toggle", (req, res) => {
  const live = req.query.live;
  if (live === "1") CHANNEL_1.live = true;
  if (live === "0") CHANNEL_1.live = false;
  res.json({ ok: true, live: CHANNEL_1.live });
});

// Render usa PORT automático
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API listening on", PORT));
