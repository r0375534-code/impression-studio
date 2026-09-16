# AI First Impression Analyzer Pro | Vision & Audio Intelligence Studio

A comprehensive, production-grade First Impression & Posture Evaluation platform featuring **Biometric 128-D Face Registration & Face ID Login**, a real-time **2-Member Challenge Arena (1v1 Duel)**, **Behavioral Interview Simulation**, and **Acoustic Voice Diagnostics**.

---

## 📁 Project Architecture & Clean File Separation

```
posture-biulder-main/
├── backend/
│   ├── data/
│   │   ├── users.json          # Registered user profiles with 128-d face descriptors
│   │   ├── challenges.json     # 1v1 Challenge match histories & active rooms
│   │   └── sessions.json       # Past diagnostic sessions & audit logs
│   ├── package.json            # Node.js backend dependencies (express, cors, ws)
│   └── server.js               # REST API & WebSocket Real-time Duel Server
│
├── frontend/
│   ├── css/
│   │   └── style.css           # Preserved Brand Theme (Indigo #6366f1, Violet #8b5cf6, Slate), Glassmorphism, Reticles
│   ├── js/
│   │   ├── config.js           # API and WebSocket endpoint detection
│   │   ├── face-auth.js        # Fixed Face Biometric Registration & Euclidean Distance Face ID Login
│   │   ├── challenge.js        # 2-Member Duel Arena Engine (Local 2-Player & WebSocket Room Duel)
│   │   ├── studio.js           # Vision Lab (TinyFaceDetector, landmarks, expressions, mic FFT)
│   │   ├── interview.js        # Behavioral interview simulator & 30s timer assessment
│   │   ├── practice.js         # Timed speech practice & Auto-PDF generation
│   │   ├── analytics.js        # Chart.js dashboards (trend, radar, doughnut, emotion timeline)
│   │   ├── badges.js           # Achievement badges & local/cloud leaderboard
│   │   └── app.js              # Theme switcher, navigation router, neural model loader
│   └── index.html              # Clean semantic HTML interface
│
├── final project.html          # All-in-one standalone file with full offline fallback
└── README.md                   # Complete documentation
```

---

## 🚀 How to Run the Application

### Option 1: Full Client-Server Mode (Recommended)

1. Open your terminal in the `backend` directory:
   ```bash
   cd backend
   npm install
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   *The backend automatically serves both the REST API, the WebSocket duel engine, and the frontend web app.*

### Option 2: Frontend with Live Server / Direct Browser

- You can open `frontend/index.html` directly in your browser or with VS Code **Live Server**.
- It connects automatically to the backend on `http://localhost:3000` when running, and has **built-in local offline caching** (`localStorage`) for biometric profiles and challenge duels if the backend is not running.

### Option 3: Standalone Single File

- Double-click `final project.html` in any browser. It contains all updated scripts, styles, face biometric registration, and 2-member duel modules embedded self-contained!

---

## 🔑 Key Features & What Was Fixed

### 1. Fixed Face Registration & Biometric Face ID Login
- **What was broken previously**: The previous codebase did not load `faceapi.nets.faceRecognitionNet`, causing facial descriptor extraction (`withFaceDescriptor()`) to fail or return undefined, preventing face registration from capturing face biometric data.
- **How it is fixed**:
  - `faceapi.nets.faceRecognitionNet` is now loaded on startup.
  - Generates real 128-dimensional floating-point biometric facial embedding vectors.
  - Displays a dedicated scanner HUD with an oval alignment guide, dynamic scanning laser, and thumbnail preview.
  - **Face ID Instant Login**: Live camera extracts your face vector and computes Euclidean distance:
    $$\text{distance} = \sqrt{\sum_{i=0}^{127} (d_{\text{live}, i} - d_{\text{saved}, i})^2}$$
    Matches when distance $\le 0.55$, welcoming you by name and loading your stats.
  - Fallback username login and guest login options available.

### 2. Fixed & Completed 2-Member Challenge Arena (1v1 Duel)
- **What was missing previously**: The challenge arena was missing or non-functional.
- **How it is implemented & fixed**:
  - **Local 2-Player Duel**: Allows 2 members to compete on the same device or split rounds (30s, 45s, or 60s).
  - **Online Room Multiplayer Duel**: Member 1 generates a Room Code (`DUEL-XXXX`); Member 2 joins via code. Live metrics stream over WebSocket (`ws://localhost:3000/ws/challenge`) every 250ms!
  - **Real-Time Head-to-Head HUD**:
    - Player 1 Card (Indigo) vs Player 2 Card (Purple/Accent)
    - Center glowing "VS" pulse badge
    - Real-time **Dynamic Tug-of-War Score Lead Bar** shifting dynamically towards whichever player has higher composure, smile, eye contact, and vocal confidence
    - 5-Dimensional Metric Duel: Warmth Smile %, Direct Eye Contact %, Composure / Calmness %, Posture Centering %, Vocal Projection %
    - Match Summary & Victory Overlay with winner crown, confetti celebration, and saved match history.

### 3. Strict Color Theme Preservation
- Retained the exact color palette:
  - **Brand Indigo**: `#6366f1` (500), `#4f46e5` (600), `#818cf8` (400), `#312e81` (900)
  - **Brand Accent (Purple/Violet)**: `#8b5cf6`
  - **Light Mode**: Background `#f7f7fc`, Cards `rgba(255, 255, 255, 0.75)`, Borders `#e2e4f3`
  - **Dark Mode**: Background `#0b0e17`, Cards `#161b2c`, Borders `#2a3150`
  - **Accents**: Amber (`#f59e0b`), Cyan (`#06b6d4`), Rose (`#f43f5e`)

---

## 📊 Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/users` | List registered candidates |
| `POST` | `/api/auth/register` | Register user with 128-d face descriptor vector |
| `POST` | `/api/auth/face-login` | Biometric Face ID matching via Euclidean distance |
| `POST` | `/api/auth/login` | Username/credential fallback login |
| `GET` | `/api/challenges/history` | List recent 1v1 challenge matches |
| `POST` | `/api/challenges/record` | Save completed challenge duel scorecard |
| `WS` | `/ws/challenge` | Real-time WebSocket room duel synchronization |
