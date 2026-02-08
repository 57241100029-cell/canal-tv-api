require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Ruta raíz (Render la usa para health check)
app.get("/", (req, res) => {
  res.send("Canal-TV API funcionando ✅");
});

// Endpoint para el frontend
app.get("/api/canal", (req, res) => {
  res.json({
    ok: true,
    canal: "Canal 1",
    live: false,
    streamUrl: "",
    message: "Sin transmisión por ahora"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor escuchando en puerto", PORT);
});
