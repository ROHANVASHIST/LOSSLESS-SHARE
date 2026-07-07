# FlashShare — Lossless P2P File Sharing

**FlashShare** is a peer-to-peer file sharing application that transfers files directly between browsers using WebRTC. Files never touch a server — they go directly from sender to receiver with zero quality loss.

---

## Features

- **Direct P2P transfers** — Files stream directly between peers via WebRTC. No intermediate server stores your data.
- **Lossless quality** — Original files are transferred bit-for-bit. Images, videos, audio, documents — nothing is compressed or re-encoded.
- **Room-based sharing** — Create a room and share the 6-character code. Others join and can send files instantly.
- **Any file type** — No restrictions. Send photos, videos, archives, code, PDFs — anything.
- **Drag-and-drop** — Drop files directly into the browser or click to browse.
- **Real-time progress** — See upload/download speed, percentage, and estimated completion.
- **No sign-up required** — Open the app, create/join a room, and start sharing immediately.
- **End-to-end encrypted** — WebRTC uses DTLS-SRTP for encryption. Your files are private.
- **Responsive design** — Works on desktop and mobile browsers.
- **Auto-reconnect** — Automatically reconnects to the signaling server if the connection drops.

---

## How It Works

```
Sender                    Signaling Server              Receiver
   |                            |                          |
   |--- create room ----------->|                          |
   |                            |                          |
   |                            |<--- join room -----------|
   |<-- peer-joined ------------|                          |
   |                            |                          |
   |--- WebRTC offer ---------->|-----> WebRTC offer ----->|
   |<-- WebRTC answer ----------|<----- WebRTC answer -----|
   |<-- ICE candidates ---------|<----- ICE candidates ----|
   |                            |                          |
   |========== P2P Data Channel (direct) =================>|
   |                            |                          |
   |--- file chunks (binary) =============================>|
   |                            |                          |
```

The signaling server is used only to exchange connection metadata (room management, WebRTC offers/answers, ICE candidates). Once the P2P connection is established, all file data flows directly between peers.

---

## Tech Stack

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Frontend       | React 19 + Vite 8                  |
| Styling        | CSS (custom, dark theme)           |
| Signaling      | Node.js + ws (WebSocket)           |
| P2P Transport  | WebRTC (RTCPeerConnection + DataChannel) |
| Build Tool     | Vite + Rolldown                    |
| Bundler Plugin | @vitejs/plugin-react               |

---

## Project Structure

```
flashshare/
├── server.js                 # WebSocket signaling server (Node.js)
├── vite.config.js            # Vite configuration with dev proxy
├── package.json
├── index.html                # Vite entry point
├── public/                   # Static assets (fallback)
├── dist/                     # Production build output
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Root component with screen routing
│   ├── context/
│   │   └── AppContext.jsx    # Global state (WebSocket, peers, transfers)
│   ├── hooks/
│   │   └── useWebRTC.js      # WebRTC peer connection logic
│   ├── components/
│   │   ├── Landing.jsx       # Create/Join room screen
│   │   ├── RoomView.jsx      # Main room UI (upload, transfers, peers)
│   │   ├── FileUpload.jsx    # Drag-and-drop file upload area
│   │   ├── PeerList.jsx      # Connected peers sidebar
│   │   ├── TransferList.jsx  # Active/completed file transfers
│   │   ├── ReceivedList.jsx  # Received files list
│   │   ├── Toast.jsx         # Toast notifications
│   │   └── ConfirmDialog.jsx # Confirmation modal
│   ├── utils/
│   │   └── helpers.js        # Formatting, icons, chunk constants
│   └── styles/
│       └── index.css         # Complete application styles
```

---

## Getting Started

### Prerequisites

- Node.js >= 16

### Install

```bash
npm install
```

### Development Mode

Runs both the signaling server and Vite dev server concurrently:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Signaling server: ws://localhost:3000/ws

Vite proxies `/ws` requests to the signaling server automatically.

### Production Build

```bash
npm run build
```

### Production Start

```bash
npm start
```

Serves the built static files and WebSocket server on port 3000.

---

## API (WebSocket Signaling Protocol)

### Client → Server

| Type           | Fields                       | Description                        |
| -------------- | ---------------------------- | ---------------------------------- |
| `create`       | `roomId?: string`            | Create a new room (optional 6-char code) |
| `join`         | `roomId: string`             | Join an existing room by code       |
| `offer`        | `to: string, sdp: object`    | Relay WebRTC offer to a peer        |
| `answer`       | `to: string, sdp: object`    | Relay WebRTC answer to a peer       |
| `ice-candidate`| `to: string, candidate`      | Relay ICE candidate to a peer       |
| `file-chunk`   | `fileId, index, data, done`  | Relay file chunk to all peers       |
| `leave`        | —                            | Leave the current room              |

### Server → Client

| Type           | Fields                       | Description                        |
| -------------- | ---------------------------- | ---------------------------------- |
| `connected`    | `id: string`                 | Assigned client ID                  |
| `room-created` | `roomId: string`             | Room was created successfully       |
| `room-joined`  | `roomId, peers: string[]`    | Joined room with list of peer IDs   |
| `peer-joined`  | `id: string`                 | A new peer joined the room          |
| `peer-left`    | `id: string`                 | A peer left the room                |
| `room-closed`  | `reason: string`             | Room was closed (expired)           |
| `error`        | `message: string`            | Error message                       |

---

## Configuration

| Environment Variable | Default | Description                |
| ------------------- | ------- | -------------------------- |
| `PORT`              | `3000`  | Signaling server port      |

### Server Constants

| Constant               | Value    | Description                          |
| ---------------------- | -------- | ------------------------------------ |
| `MAX_ROOM_AGE`         | 15 min   | Rooms auto-expire after inactivity   |
| `MAX_PARTICIPANTS`     | 10       | Maximum peers per room               |
| `ROOM_CLEANUP_INTERVAL`| 60s      | Stale room cleanup frequency         |
| `CHUNK_SIZE`           | 64 KB    | File chunk size for P2P transfer     |
| `MAX_BUFFERED`         | 1 MB     | Max buffered amount before backpressure |

---

## Security

- **Rate limiting** — 30 actions per 60-second window per IP
- **Path traversal protection** — Static file serving is restricted to the `dist`/`public` directory
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`
- **WebRTC encryption** — DTLS-SRTP encrypts all P2P data channels
- **No data persistence** — Files are never stored on the server; rooms are ephemeral

---

## Browser Support

WebRTC is supported in all modern browsers:
- Chrome/Edge (desktop & Android)
- Firefox
- Safari (desktop & iOS)
- Opera
- Samsung Internet

---

## License

MIT
