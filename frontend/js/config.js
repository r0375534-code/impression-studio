/* ==========================================================================
   CONFIG & CONSTANTS
   ========================================================================== */

const CONFIG = {
  // Face API model weights CDN URL
  MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model',

  // Auto-detect whether running from backend or file/Live Server
  get API_BASE() {
    if (window.location.protocol.startsWith('http')) {
      // If served by backend (port 3000 or same port)
      if (window.location.port === '3000') {
        return window.location.origin;
      }
      // If served by Live Server (e.g. 5500), connect to backend on 3000
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    // File protocol fallback to local backend port
    return 'http://localhost:3000';
  },

  get WS_BASE() {
    const host = window.location.hostname || 'localhost';
    const port = '3000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}:${port}/ws/challenge`;
  },

  STORAGE_KEYS: {
    USER: 'ai_impression_current_user',
    LOCAL_USERS: 'ai_impression_registered_users',
    SESSIONS: 'ai_impression_sessions',
    LEADERBOARD: 'ai_impression_leaderboard',
    UNLOCKED_BADGES: 'ai_impression_unlocked_badges',
    THEME: 'ai_impression_theme',
    CHALLENGE_MATCHES: 'ai_impression_challenge_matches'
  }
};

window.CONFIG = CONFIG;
