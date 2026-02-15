# NVK Radio - WebRTC Audio Streaming

Este proyecto permite transmitir audio en vivo desde el navegador (Locutor) a múltiples oyentes (Oyentes) usando WebRTC y Socket.IO.
Diseñado para funcionar en **Render** (o cualquier hosting que soporte Node.js y Websockets en un solo puerto HTTPS).

## Estructura

- `server.js`: Servidor Express + Socket.IO. Maneja la señalización WebRTC y el chat.
- `locutor.html` / `locutor.js`: Interfaz para transmitir (obtiene micrófono).
- `index.html` / `oyente.js`: Interfaz para escuchar.
- `styles.css`: Estilos visuales.
- `chat_history.json`: Persistencia del chat.

## Instalar Dependencias

```bash
npm install
```

## Prueba Local

1. Iniciar el servidor:
   ```bash
   node server.js
   ```
2. Abrir **Locutor** en una pestaña (Chrome/Firefox):
   - Ir a `http://localhost:3000/locutor`
   - Dar permiso al micrófono.
   - Click en **INICIAR TRANSMISIÓN**.
3. Abrir **Oyente** en otra pestaña/navegador:
   - Ir a `http://localhost:3000`
   - Click en **ESCUCHAR** (necesario por políticas de autoplay).
   - Deberías escuchar el audio del locutor.
4. Probar Chat:
   - Escribir mensajes en ambas ventanas.

## Desplegar en Render

1. Subir este código a un repositorio de **GitHub**.
2. En Render.com:
   - Crear **New Web Service**.
   - Conectar tu repo.
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
3. ¡Listo! Render te dará una URL (ej: `https://mi-radio.onrender.com`).
   - Locutor: `https://mi-radio.onrender.com/locutor`
   - Oyentes: `https://mi-radio.onrender.com`

## Notas Importantes

- **HTTPS**: WebRTC requiere HTTPS para acceder al micrófono si no es localhost. Render provee HTTPS automáticamente.
- **Autoplay**: Los navegadores bloquean el audio automático. Por eso el oyente debe hacer click en "ESCUCHAR" al menos una vez.
