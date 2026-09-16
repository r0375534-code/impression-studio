/* ==========================================================================
   ACHIEVEMENT BADGES & LEADERBOARD ENGINE
   ========================================================================== */

const BADGES_DEF = [
  { id: 'interview_ready', title: 'Interview Ready', icon: 'fa-user-tie', color: 'text-amber-400', desc: 'Achieve overall score ≥ 85 pts' },
  { id: 'eye_contact_master', title: 'Laser Eye Contact', icon: 'fa-eye', color: 'text-cyan-400', desc: 'Maintain ≥ 85% eye contact' },
  { id: 'radiant_smile', title: 'Radiant Smile', icon: 'fa-face-smile', color: 'text-amber-400', desc: 'Reach ≥ 80% warmth smile score' },
  { id: 'iron_composure', title: 'Iron Composure', icon: 'fa-shield-halved', color: 'text-brand-500', desc: 'Hold ≥ 90% steady composure' },
  { id: 'silver_tongue', title: 'Silver Tongue', icon: 'fa-microphone', color: 'text-amber-500', desc: 'Achieve ≥ 80% voice confidence' },
  { id: 'perfect_posture', title: 'Commanding Posture', icon: 'fa-anchor', color: 'text-brand-accent', desc: 'Hold centered alignment' }
];

let unlockedBadgesHistory = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.UNLOCKED_BADGES) || '[]');
let leaderboardData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LEADERBOARD) || '[]');

if (leaderboardData.length === 0) {
  leaderboardData = [
    { name: 'Alex Vance', score: 94, date: '2026-08-01' },
    { name: 'Elena Rostova', score: 91, date: '2026-08-02' },
    { name: 'Marcus Chen', score: 87, date: '2026-08-03' }
  ];
  localStorage.setItem(CONFIG.STORAGE_KEYS.LEADERBOARD, JSON.stringify(leaderboardData));
}

function fireExecutiveCelebration() {
  if (typeof confetti !== 'function') return;
  var duration = 3 * 1000;
  var animationEnd = Date.now() + duration;
  var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  var interval = setInterval(function() {
    var timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    var particleCount = 50 * (timeLeft / duration);
    confetti(Object.assign({}, defaults, { 
      particleCount, 
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#b07d52', '#c9a07a', '#7c502b', '#dec3a4'] 
    }));
    confetti(Object.assign({}, defaults, { 
      particleCount, 
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#b07d52', '#c9a07a', '#7c502b', '#dec3a4'] 
    }));
  }, 250);
}

function checkBadgeUnlocked(id) {
  const m = window.studio ? window.studio.getCurrentMetrics() : {};
  if (id === 'interview_ready') return (m.overall || 0) >= 85;
  if (id === 'eye_contact_master') return (m.eyeContact || 0) >= 85;
  if (id === 'radiant_smile') return (m.smile || 0) >= 80;
  if (id === 'iron_composure') return (m.composure || 0) >= 90;
  if (id === 'silver_tongue') return (m.voiceConfidence || 0) >= 80;
  if (id === 'perfect_posture') return (m.posture || 0) >= 90;
  return false;
}

function checkAndUnlockBadges() {
  let newlyUnlocked = false;
  BADGES_DEF.forEach(b => {
    if (checkBadgeUnlocked(b.id) && !unlockedBadgesHistory.includes(b.id)) {
      unlockedBadgesHistory.push(b.id);
      newlyUnlocked = true;
    }
  });

  if (newlyUnlocked) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.UNLOCKED_BADGES, JSON.stringify(unlockedBadgesHistory));
    renderBadgesUI();
    fireExecutiveCelebration();
  }
}

function renderBadgesUI() {
  const container = document.getElementById('badgesGrid');
  if (!container) return;

  container.innerHTML = BADGES_DEF.map(b => {
    const isUnlocked = checkBadgeUnlocked(b.id) || unlockedBadgesHistory.includes(b.id);
    return `
      <div class="glass-card p-4 rounded-xl border transition-all duration-500 ${isUnlocked ? 'border-brand-500/50 glow-active' : 'border-gray-800 opacity-50'} text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-full ${isUnlocked ? 'bg-brand-500/20' : 'bg-slate-200'} flex items-center justify-center text-xl ${b.color} transition-colors duration-500">
          <i class="fa-solid ${b.icon}"></i>
        </div>
        <h4 class="font-display font-bold text-xs text-slate-800">${b.title}</h4>
        <p class="text-[10px] text-slate-500 font-mono leading-tight">${b.desc}</p>
        <span class="inline-block px-2 py-0.5 rounded text-[9px] font-mono transition-colors duration-500 ${isUnlocked ? 'bg-brand-500/20 text-brand-600' : 'bg-slate-200 text-slate-400'}">
          ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}
        </span>
      </div>
    `;
  }).join('');
}

function renderLeaderboardUI() {
  const list = document.getElementById('leaderboardList');
  if (!list) return;

  leaderboardData.sort((a,b) => b.score - a.score);
  list.innerHTML = leaderboardData.map((item, idx) => `
    <div class="bg-brand-cardBg p-3 rounded-xl border border-brand-border flex items-center justify-between hover:border-brand-500/50 transition-colors cursor-default">
      <div class="flex items-center gap-3">
        <span class="w-6 h-6 rounded-full ${idx === 0 ? 'bg-amber-400 text-black font-bold shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-xs">
          #${idx+1}
        </span>
        <div>
          <div class="text-slate-800 font-semibold">${item.name}</div>
          <div class="text-[10px] text-slate-500">${item.date}</div>
        </div>
      </div>
      <div class="font-display font-bold text-base text-brand-accent">${item.score} PTS</div>
    </div>
  `).join('');
}

function promptAddLeaderboardEntry() {
  const current = window.studio ? window.studio.getCurrentMetrics() : {};
  const defaultName = window.faceAuth && window.faceAuth.getUser() ? window.faceAuth.getUser().name : "Candidate";
  const name = prompt("Enter your name for the local leaderboard:", defaultName);
  if (name) {
    leaderboardData.push({
      name: name,
      score: current.overall || 88,
      date: new Date().toISOString().split('T')[0]
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.LEADERBOARD, JSON.stringify(leaderboardData));
    renderLeaderboardUI();
  }
}

window.renderBadgesUI = renderBadgesUI;
window.renderLeaderboardUI = renderLeaderboardUI;
window.checkAndUnlockBadges = checkAndUnlockBadges;
window.fireExecutiveCelebration = fireExecutiveCelebration;
window.promptAddLeaderboardEntry = promptAddLeaderboardEntry;
window.testConfetti = fireExecutiveCelebration;
