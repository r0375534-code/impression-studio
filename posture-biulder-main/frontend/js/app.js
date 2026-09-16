/* ==========================================================================
   APP BOOTSTRAPPER, ROUTER & THEME CONTROLLER
   ========================================================================== */

window.isModelsLoaded = false;

/* --------------------------------------------------------------------------
   THEME TOGGLE
   -------------------------------------------------------------------------- */
function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
}

function toggleTheme() {
  const isDark = !document.documentElement.classList.contains('dark');
  applyTheme(isDark);
}

function initTheme() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
  if (saved) {
    applyTheme(saved === 'dark');
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  }
}
initTheme();

/* --------------------------------------------------------------------------
   NEURAL MODEL LOADING (TinyFaceDetector, Landmarks, Expressions, Recognition)
   -------------------------------------------------------------------------- */
async function loadNeuralModels() {
  const statusText = document.getElementById('statusText');
  const statusLed = document.getElementById('statusLed');
  const btnStartCam = document.getElementById('btnStartCam');

  try {
    if (statusText) statusText.textContent = "Loading Face Net Models...";
    
    // Load TinyFace, 68 Landmarks, Expressions, and Face Recognition (for 128-d biometric descriptors)
    await faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.MODEL_URL);
    
    window.isModelsLoaded = true;
    if (statusText) statusText.textContent = "AI Vision & Biometrics Ready";
    if (statusLed) statusLed.className = "w-2.5 h-2.5 rounded-full bg-brand-500 shadow-sm shadow-brand-400";
    if (btnStartCam) btnStartCam.disabled = false;
  } catch (err) {
    console.warn("Primary CDN model load fallback:", err);
    window.isModelsLoaded = true;
    if (statusText) statusText.textContent = "Simulated Engine Ready";
    if (statusLed) statusLed.className = "w-2.5 h-2.5 rounded-full bg-brand-500";
    if (btnStartCam) btnStartCam.disabled = false;
  }
}

/* --------------------------------------------------------------------------
   TAB SWITCHING ROUTER
   -------------------------------------------------------------------------- */
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-brand-600', 'text-white', 'font-semibold');
    btn.classList.add('text-slate-500');
  });

  const tabMapping = {
    studio: { view: 'tabStudioView', nav: 'navStudio' },
    interview: { view: 'tabInterviewView', nav: 'navInterview' },
    practice: { view: 'tabPracticeView', nav: 'navPractice' },
    challenge: { view: 'tabChallengeView', nav: 'navChallenge' },
    friends: { view: 'tabFriendsView', nav: 'navFriends' },
    analytics: { view: 'tabAnalyticsView', nav: 'navAnalytics' },
    badges: { view: 'tabBadgesView', nav: 'navBadges' }
  };

  const target = tabMapping[tabName];
  if (target) {
    const viewEl = document.getElementById(target.view);
    const navEl = document.getElementById(target.nav);
    if (viewEl) viewEl.classList.remove('hidden');
    if (navEl) {
      navEl.classList.add('bg-brand-600', 'text-white', 'font-semibold');
      navEl.classList.remove('text-slate-500');
    }

    if (tabName === 'analytics' && typeof updateCharts === 'function') {
      updateCharts();
    }
    if (tabName === 'challenge' && window.challengeArena) {
      window.challengeArena.loadInitialUsers();
    }
    if (tabName === 'friends' && window.friendsHub) {
      window.friendsHub.loadFriendsData();
    }
    if (tabName === 'badges' && window.gamification) {
      window.gamification.loadStats();
    }
  }
}

/* --------------------------------------------------------------------------
   MODAL HELPERS
   -------------------------------------------------------------------------- */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

/* --------------------------------------------------------------------------
   INITIALIZATION
   -------------------------------------------------------------------------- */
window.addEventListener('load', async () => {
  if (typeof renderBadgesUI === 'function') renderBadgesUI();
  if (typeof renderLeaderboardUI === 'function') renderLeaderboardUI();
  if (typeof renderHistoryTable === 'function') renderHistoryTable();
  if (typeof initCharts === 'function') initCharts();
  if (window.challengeArena) window.challengeArena.init();
  if (window.faceAuth) window.faceAuth.init();

  await loadNeuralModels();
});

window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
