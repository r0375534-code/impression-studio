/* ==========================================================================
   GAMIFICATION ENGINE: STREAKS, DAILY TASKS ("DAILY ASK"), LEVELS, XP & COINS
   ========================================================================== */

const ACHIEVEMENTS_DEF = [
  { code: 'first_session', title: 'First Step', icon: 'fa-shoe-prints', desc: 'Complete your first diagnostic session' },
  { code: 'sessions_5', title: 'Getting Serious', icon: 'fa-clipboard-check', desc: 'Complete 5 sessions' },
  { code: 'sessions_10', title: 'Dedicated Executive', icon: 'fa-layer-group', desc: 'Complete 10 sessions' },
  { code: 'streak_3', title: 'On A Roll', icon: 'fa-fire', desc: 'Reach a 3-day daily streak' },
  { code: 'streak_7', title: 'Consistency Champ', icon: 'fa-fire-flame-curved', desc: 'Reach a 7-day daily streak' },
  { code: 'streak_30', title: 'Unstoppable Titan', icon: 'fa-crown', desc: 'Reach a 30-day streak' },
  { code: 'high_scorer', title: 'Executive Ready', icon: 'fa-user-tie', desc: 'Score 90+ in a session' },
  { code: 'level_5', title: 'Rising Star', icon: 'fa-star', desc: 'Reach Level 5 rank' },
  { code: 'level_10', title: 'Elite Performer', icon: 'fa-trophy', desc: 'Reach Level 10 rank' }
];

const LEVEL_TITLES = [
  "Novice Candidate",
  "Apprentice Speaker",
  "Executive Presenter",
  "Senior Director",
  "Charismatic Leader",
  "Distinguished Orator",
  "Diplomatic Master",
  "Visionary Titan"
];

class GamificationEngine {
  constructor() {
    this.XP_PER_LEVEL = 500;
    this.stats = {
      xp: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: null,
      coins: 0,
      unlockedAchievements: [],
      dailyTasks: []
    };
  }

  init() {
    this.loadStats();
  }

  getCurrentUser() {
    return window.faceAuth && window.faceAuth.getUser ? window.faceAuth.getUser() : null;
  }

  getLevelTitle(level) {
    const idx = Math.min(Math.max(1, level) - 1, LEVEL_TITLES.length - 1);
    return LEVEL_TITLES[idx];
  }

  async loadStats() {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'guest';

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/gamification/stats/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.gamification) {
          this.stats = data.gamification;
          localStorage.setItem('aura_gamification_stats', JSON.stringify(this.stats));
          this.renderUI();
          return;
        }
      }
    } catch (e) {
      console.warn('[Gamification] Network fetch fallback to local cache:', e);
    }

    const cached = localStorage.getItem('aura_gamification_stats');
    if (cached) {
      try {
        this.stats = JSON.parse(cached);
      } catch (err) {}
    } else {
      this.stats = {
        xp: 250,
        level: 1,
        currentStreak: 2,
        longestStreak: 4,
        lastSessionDate: new Date().toISOString().split('T')[0],
        coins: 45,
        unlockedAchievements: ['first_session'],
        dailyTasks: [
          { id: 'task_calib', title: 'Diagnostic Calibration', desc: 'Complete 1 camera & posture calibration', xpReward: 50, coinsReward: 10, completed: true, claimed: false },
          { id: 'task_smile', title: 'Executive Warmth', desc: 'Hold ≥ 75% smile warmth for 15 seconds', xpReward: 75, coinsReward: 15, completed: false, claimed: false },
          { id: 'task_eye', title: 'Laser Eye Contact', desc: 'Maintain ≥ 80% direct eye contact in session', xpReward: 75, coinsReward: 15, completed: false, claimed: false },
          { id: 'task_voice', title: 'Vocal Presence', desc: 'Complete speech analysis with pace 110-160 wpm', xpReward: 100, coinsReward: 20, completed: false, claimed: false },
          { id: 'task_duel', title: 'Arena Contender', desc: 'Challenge or compete in a 1v1 battle duel', xpReward: 150, coinsReward: 30, completed: false, claimed: false }
        ]
      };
    }
    this.renderUI();
  }

  renderUI() {
    this.renderProgressionPanel();
    this.renderDailyTasks();
    this.renderAchievementsGrid();
  }

  renderProgressionPanel() {
    const loggedOutEl = document.getElementById('progressionLoggedOut');
    const contentEl = document.getElementById('progressionContent');
    const subLabelEl = document.getElementById('progressionSubLabel');

    if (loggedOutEl) loggedOutEl.classList.add('hidden');
    if (contentEl) {
      contentEl.classList.remove('hidden');
      contentEl.classList.add('grid');
    }
    if (subLabelEl) subLabelEl.textContent = 'ACTIVE';

    const levelBadgeCircle = document.getElementById('levelBadgeCircle');
    const levelLabel = document.getElementById('levelLabel');
    const levelTitle = document.getElementById('levelTitle');
    const xpLabel = document.getElementById('xpLabel');
    const streakCount = document.getElementById('streakCount');
    const longestStreak = document.getElementById('longestStreak');
    const coinsDisplay = document.getElementById('coinsDisplay');
    const xpProgressBar = document.getElementById('xpProgressBar');
    const xpToNextLabel = document.getElementById('xpToNextLabel');

    const curLevel = this.stats.level || 1;
    const curXp = this.stats.xp || 0;
    const levelFloor = (curLevel - 1) * this.XP_PER_LEVEL;
    const xpIntoLevel = Math.max(0, curXp - levelFloor);
    const pct = Math.min(100, Math.round((xpIntoLevel / this.XP_PER_LEVEL) * 100));

    if (levelBadgeCircle) levelBadgeCircle.textContent = curLevel;
    if (levelLabel) levelLabel.textContent = `Level ${curLevel}`;
    if (levelTitle) levelTitle.textContent = this.getLevelTitle(curLevel);
    if (xpLabel) xpLabel.textContent = `${curXp.toLocaleString()} Total XP`;
    if (streakCount) streakCount.textContent = this.stats.currentStreak || 0;
    if (longestStreak) longestStreak.textContent = this.stats.longestStreak || 0;
    if (coinsDisplay) coinsDisplay.textContent = (this.stats.coins || 0).toLocaleString();
    if (xpProgressBar) xpProgressBar.style.width = `${pct}%`;
    if (xpToNextLabel) xpToNextLabel.textContent = `${xpIntoLevel} / ${this.XP_PER_LEVEL} XP`;
  }

  renderDailyTasks() {
    const list = document.getElementById('dailyTasksList');
    if (!list) return;

    const tasks = this.stats.dailyTasks || [];
    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const barEl = document.getElementById('dailyTasksProgressBar');
    const textEl = document.getElementById('dailyTasksProgressText');
    if (barEl) barEl.style.width = `${pct}%`;
    if (textEl) textEl.textContent = `${completedCount} of ${totalCount} Completed (${pct}%)`;

    list.innerHTML = tasks.map(t => {
      const isDone = t.completed;
      const isClaimed = t.claimed;

      return `
        <div class="p-3.5 rounded-xl border transition-all ${isDone ? 'bg-brand-500/10 border-brand-500/30' : 'bg-brand-cardBg border-brand-border'} flex items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5 ${isDone ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30' : 'bg-slate-200 text-slate-400'}">
              <i class="fa-solid ${isDone ? 'fa-check' : 'fa-circle-dot'}"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-display font-semibold text-xs text-slate-800">${t.title}</span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-darkBg border border-brand-border text-brand-accent font-bold">
                  +${t.xpReward} XP
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold">
                  <i class="fa-solid fa-coins text-[9px] mr-0.5"></i>+${t.coinsReward}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">${t.desc}</p>
            </div>
          </div>

          <div>
            ${isClaimed ? `
              <span class="text-[10px] font-mono font-bold text-slate-400 bg-slate-200 px-3 py-1 rounded-lg">
                CLAIMED
              </span>
            ` : isDone ? `
              <button onclick="window.gamification.claimDailyTask('${t.id}')" class="px-3 py-1.5 bg-gradient-to-r from-brand-600 to-brand-accent hover:opacity-90 text-white font-mono text-[11px] font-bold rounded-lg shadow-sm shadow-brand-500/30 flex items-center gap-1.5 transition-all animate-pulse">
                <i class="fa-solid fa-gift text-xs"></i> Claim
              </button>
            ` : `
              <span class="text-[10px] font-mono text-slate-400 border border-slate-300 px-2.5 py-1 rounded-lg">
                In Progress
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  renderAchievementsGrid() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;

    const unlocked = this.stats.unlockedAchievements || [];
    grid.innerHTML = ACHIEVEMENTS_DEF.map(a => {
      const isUnlocked = unlocked.includes(a.code);
      return `
        <div class="p-3 rounded-xl border text-center transition-all ${isUnlocked ? 'bg-brand-cardBg border-brand-500/40 shadow-sm' : 'bg-brand-cardBg/50 border-brand-border opacity-40'}">
          <div class="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-base mb-2 ${isUnlocked ? 'bg-gradient-to-tr from-brand-600 to-brand-accent text-white shadow-md shadow-brand-500/20' : 'bg-slate-200 text-slate-400'}">
            <i class="fa-solid ${a.icon}"></i>
          </div>
          <div class="font-display font-bold text-xs text-slate-800">${a.title}</div>
          <div class="font-mono text-[9px] text-slate-500 mt-0.5 leading-tight">${a.desc}</div>
        </div>
      `;
    }).join('');
  }

  async recordSession(sessionMetrics) {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'guest';

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/gamification/record-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionMetrics })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const prevLevel = this.stats.level || 1;
          this.stats = data.gamification;
          localStorage.setItem('aura_gamification_stats', JSON.stringify(this.stats));
          this.renderUI();

          // Check if level-up or new achievement
          if (this.stats.level > prevLevel) {
            this.showToast(`🎉 Level Up! You reached Level ${this.stats.level} (${this.getLevelTitle(this.stats.level)})!`);
            if (typeof fireExecutiveCelebration === 'function') fireExecutiveCelebration();
          } else if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
            this.showToast(`🏆 New Achievement Unlocked!`);
            if (typeof fireExecutiveCelebration === 'function') fireExecutiveCelebration();
          }
          return;
        }
      }
    } catch (e) {
      console.warn('[Gamification] Record session offline fallback:', e);
    }

    // Offline fallback
    const overall = (sessionMetrics && sessionMetrics.overall) || 75;
    const earnedXp = 50 + Math.round(overall / 2);
    const earnedCoins = 10 + (overall >= 90 ? 20 : overall >= 80 ? 10 : 5);
    this.stats.xp = (this.stats.xp || 0) + earnedXp;
    this.stats.coins = (this.stats.coins || 0) + earnedCoins;
    this.stats.level = Math.floor(this.stats.xp / this.XP_PER_LEVEL) + 1;
    this.stats.currentStreak = (this.stats.currentStreak || 1) + 1;

    // Check daily tasks in memory
    (this.stats.dailyTasks || []).forEach(t => {
      if (t.id === 'task_calib') t.completed = true;
      if (t.id === 'task_smile' && (sessionMetrics.smile || 0) >= 75) t.completed = true;
      if (t.id === 'task_eye' && (sessionMetrics.eyeContact || 0) >= 80) t.completed = true;
      if (t.id === 'task_voice' && (sessionMetrics.voiceConfidence || 0) >= 70) t.completed = true;
    });

    localStorage.setItem('aura_gamification_stats', JSON.stringify(this.stats));
    this.renderUI();
  }

  async claimDailyTask(taskId) {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'guest';

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/gamification/claim-daily-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.stats = data.gamification;
          localStorage.setItem('aura_gamification_stats', JSON.stringify(this.stats));
          this.renderUI();
          this.showToast(data.message || 'Reward claimed!');
          if (typeof fireExecutiveCelebration === 'function') fireExecutiveCelebration();
          return;
        }
      }
    } catch (e) {
      console.warn('[Gamification] Claim task fallback:', e);
    }

    // Offline claim
    const task = (this.stats.dailyTasks || []).find(t => t.id === taskId);
    if (task && task.completed && !task.claimed) {
      task.claimed = true;
      this.stats.xp += task.xpReward;
      this.stats.coins += task.coinsReward;
      this.stats.level = Math.floor(this.stats.xp / this.XP_PER_LEVEL) + 1;
      localStorage.setItem('aura_gamification_stats', JSON.stringify(this.stats));
      this.renderUI();
      this.showToast(`Reward Claimed: +${task.xpReward} XP & +${task.coinsReward} Coins!`);
      if (typeof fireExecutiveCelebration === 'function') fireExecutiveCelebration();
    }
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 z-50 bg-brand-darkBg/95 border border-brand-500 text-slate-800 dark:text-white px-5 py-3 rounded-2xl shadow-xl backdrop-blur-md font-display font-semibold text-xs flex items-center gap-2.5 transition-all transform translate-y-4 opacity-0';
    toast.innerHTML = `<i class="fa-solid fa-crown text-amber-400 text-sm"></i><span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
    }, 50);

    setTimeout(() => {
      toast.classList.add('translate-y-4', 'opacity-0');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
}

window.gamification = new GamificationEngine();
window.addEventListener('DOMContentLoaded', () => {
  window.gamification.init();
});
