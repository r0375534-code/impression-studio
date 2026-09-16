/* ==========================================================================
   FRIENDS & SOCIAL HUB CONTROLLER
   Followers, Following, Requests (Accept/Reject), Battles, and Leaderboard
   ========================================================================== */

class FriendsHub {
  constructor() {
    this.currentSection = 'discover';
    this.following = [];
    this.followers = [];
    this.requests = [];
    this.discover = [];
    this.leaderboard = [];
    this.activeFilter = 'xp';
  }

  init() {
    this.loadFriendsData();
    this.loadLeaderboard('xp');
  }

  getCurrentUser() {
    return window.faceAuth && window.faceAuth.getUser ? window.faceAuth.getUser() : null;
  }

  switchSection(section) {
    this.currentSection = section;

    // Toggle subtab visibility
    document.querySelectorAll('.friends-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.friends-section-btn').forEach(btn => {
      btn.classList.remove('bg-brand-600', 'text-white', 'font-semibold');
      btn.classList.add('text-slate-500');
    });

    const targetSection = document.getElementById(`fsSection${section.charAt(0).toUpperCase() + section.slice(1)}`);
    const targetBtn = document.getElementById(`fs${section.charAt(0).toUpperCase() + section.slice(1)}`);

    if (targetSection) targetSection.classList.remove('hidden');
    if (targetBtn) {
      targetBtn.classList.add('bg-brand-600', 'text-white', 'font-semibold');
      targetBtn.classList.remove('text-slate-500');
    }

    if (section === 'leaderboard') {
      this.loadLeaderboard(this.activeFilter);
    } else if (section === 'battles') {
      this.populateBattleOpponentSelect();
    }
  }

  async loadFriendsData() {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'usr_alex_vance';

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/friends/list/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.following = data.following || [];
          this.followers = data.followers || [];
          this.requests = data.requests || [];
          this.discover = data.discover || [];
          this.renderAll();
          return;
        }
      }
    } catch (e) {
      console.warn('[Friends] Network error, loading fallback:', e);
    }

    // Mock fallback
    this.following = [
      { id: 'usr_elena_rostova', name: 'Elena Rostova', username: 'elenarostova', role: 'Product Director', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=elena', gamification: { xp: 1850, level: 4, currentStreak: 5, coins: 240 } },
      { id: 'usr_marcus_chen', name: 'Marcus Chen', username: 'marcuschen', role: 'Tech Lead', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=marcus', gamification: { xp: 1200, level: 3, currentStreak: 3, coins: 150 } }
    ];
    this.followers = [
      { id: 'usr_elena_rostova', name: 'Elena Rostova', username: 'elenarostova', role: 'Product Director', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=elena', gamification: { xp: 1850, level: 4, currentStreak: 5, coins: 240 } },
      { id: 'usr_sarah_jenkins', name: 'Sarah Jenkins', username: 'sarahjenkins', role: 'Managing Partner', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarah', gamification: { xp: 1720, level: 4, currentStreak: 6, coins: 260 } }
    ];
    this.requests = [
      { id: 'freq_1', fromId: 'usr_david_kim', fromName: 'David Kim', fromAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=david', fromRole: 'VP of Strategy', timestamp: new Date().toISOString() }
    ];
    this.discover = [
      { id: 'usr_sarah_jenkins', name: 'Sarah Jenkins', username: 'sarahjenkins', role: 'Managing Partner', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarah', gamification: { xp: 1720, level: 4, currentStreak: 6, coins: 260 } },
      { id: 'usr_david_kim', name: 'David Kim', username: 'davidkim', role: 'VP of Strategy', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=david', gamification: { xp: 820, level: 2, currentStreak: 2, coins: 95 } }
    ];
    this.renderAll();
  }

  renderAll() {
    this.renderBadgeCounts();
    this.renderFollowing();
    this.renderFollowers();
    this.renderRequests();
    this.renderDiscover();
    this.populateBattleOpponentSelect();
  }

  renderBadgeCounts() {
    const count = this.requests.length;
    const badge1 = document.getElementById('pendingReqCount');
    const badge2 = document.getElementById('followersCountBadge');

    if (badge1) {
      if (count > 0) {
        badge1.textContent = count;
        badge1.classList.remove('hidden');
      } else {
        badge1.classList.add('hidden');
      }
    }

    if (badge2) {
      badge2.textContent = this.followers.length;
    }
  }

  renderFollowing() {
    const list = document.getElementById('followingList');
    if (!list) return;

    if (this.following.length === 0) {
      list.innerHTML = `
        <div class="text-center py-8 font-mono text-xs text-slate-400">
          <i class="fa-solid fa-user-plus block text-2xl mb-2 opacity-30"></i>
          You are not following anyone yet. Discover executive peers in the Discover tab.
        </div>
      `;
      return;
    }

    list.innerHTML = this.following.map(u => `
      <div class="p-3.5 rounded-xl border border-brand-border bg-brand-cardBg flex items-center justify-between hover:border-brand-500/40 transition-all">
        <div class="flex items-center gap-3">
          <img src="${u.avatar}" class="w-10 h-10 rounded-full border border-brand-border object-cover" alt="${u.name}"/>
          <div>
            <div class="font-display font-semibold text-xs text-slate-800 flex items-center gap-2">
              ${u.name}
              <span class="text-[9px] font-mono px-2 py-0.2 rounded-full bg-brand-500/10 text-brand-600 font-bold">Lvl ${u.gamification ? u.gamification.level : 1}</span>
            </div>
            <div class="text-[10px] font-mono text-slate-400">${u.role || 'Executive Candidate'} &bull; @${u.username}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.friendsHub.startDuelWith('${u.name}')" class="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-mono text-xs rounded-lg border border-amber-500/30 flex items-center gap-1 transition-all">
            <i class="fa-solid fa-bolt text-xs"></i> 1v1 Battle
          </button>
          <button onclick="window.friendsHub.unfollowUser('${u.id}')" class="px-3 py-1.5 bg-slate-200 hover:bg-red-500/10 hover:text-red-500 text-slate-500 font-mono text-xs rounded-lg transition-all">
            Unfollow
          </button>
        </div>
      </div>
    `).join('');
  }

  renderFollowers() {
    const list = document.getElementById('followersList');
    if (!list) return;

    if (this.followers.length === 0) {
      list.innerHTML = `
        <div class="text-center py-8 font-mono text-xs text-slate-400">
          <i class="fa-solid fa-user-group block text-2xl mb-2 opacity-30"></i>
          No followers yet. Share your high score to gain executive followers.
        </div>
      `;
      return;
    }

    list.innerHTML = this.followers.map(u => {
      const isMutual = this.following.some(f => f.id === u.id);
      return `
        <div class="p-3.5 rounded-xl border border-brand-border bg-brand-cardBg flex items-center justify-between hover:border-brand-500/40 transition-all">
          <div class="flex items-center gap-3">
            <img src="${u.avatar}" class="w-10 h-10 rounded-full border border-brand-border object-cover" alt="${u.name}"/>
            <div>
              <div class="font-display font-semibold text-xs text-slate-800 flex items-center gap-2">
                ${u.name}
                ${isMutual ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-brand-500/10 text-brand-600">Mutual</span>' : ''}
              </div>
              <div class="text-[10px] font-mono text-slate-400">${u.role || 'Executive Candidate'} &bull; @${u.username}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${!isMutual ? `
              <button onclick="window.friendsHub.followUser('${u.id}', '${u.name}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-mono text-xs rounded-lg shadow-sm transition-all">
                + Follow Back
              </button>
            ` : `
              <button onclick="window.friendsHub.startDuelWith('${u.name}')" class="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-mono text-xs rounded-lg border border-amber-500/30 flex items-center gap-1 transition-all">
                <i class="fa-solid fa-bolt text-xs"></i> 1v1 Battle
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  renderRequests() {
    const list = document.getElementById('followRequestsList');
    if (!list) return;

    if (this.requests.length === 0) {
      list.innerHTML = `
        <div class="text-center py-8 font-mono text-xs text-slate-400">
          <i class="fa-solid fa-inbox block text-2xl mb-2 opacity-30"></i>
          No pending incoming requests. All caught up!
        </div>
      `;
      return;
    }

    list.innerHTML = this.requests.map(r => `
      <div class="p-3.5 rounded-xl border border-brand-border bg-brand-cardBg flex items-center justify-between hover:border-brand-500/40 transition-all">
        <div class="flex items-center gap-3">
          <img src="${r.fromAvatar}" class="w-10 h-10 rounded-full border border-brand-border object-cover" alt="${r.fromName}"/>
          <div>
            <div class="font-display font-semibold text-xs text-slate-800">${r.fromName}</div>
            <div class="text-[10px] font-mono text-slate-400">${r.fromRole || 'Executive Candidate'} &bull; Wants to connect</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.friendsHub.respondToRequest('${r.id}', 'accept')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-mono text-xs font-semibold rounded-lg shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all">
            <i class="fa-solid fa-check text-xs"></i> Accept
          </button>
          <button onclick="window.friendsHub.respondToRequest('${r.id}', 'reject')" class="px-3 py-1.5 bg-slate-200 hover:bg-red-500/10 hover:text-red-500 text-slate-600 font-mono text-xs rounded-lg border border-slate-300 transition-all">
            <i class="fa-solid fa-xmark text-xs"></i> Decline
          </button>
        </div>
      </div>
    `).join('');
  }

  renderDiscover() {
    const list = document.getElementById('suggestedUsersList');
    if (!list) return;

    if (this.discover.length === 0) {
      list.innerHTML = `
        <div class="text-center py-6 font-mono text-xs text-slate-400">
          No suggested users found. You are connected with everyone in the directory!
        </div>
      `;
      return;
    }

    list.innerHTML = this.discover.map(u => `
      <div class="p-3.5 rounded-xl border border-brand-border bg-brand-cardBg flex items-center justify-between hover:border-brand-500/40 transition-all">
        <div class="flex items-center gap-3">
          <img src="${u.avatar}" class="w-10 h-10 rounded-full border border-brand-border object-cover" alt="${u.name}"/>
          <div>
            <div class="font-display font-semibold text-xs text-slate-800 flex items-center gap-2">
              ${u.name}
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-brand-500/10 text-brand-600 font-bold">Lvl ${u.gamification ? u.gamification.level : 1}</span>
            </div>
            <div class="text-[10px] font-mono text-slate-400">${u.role || 'Executive Candidate'} &bull; @${u.username}</div>
          </div>
        </div>
        <div>
          <button onclick="window.friendsHub.followUser('${u.id}', '${u.name}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-mono text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-user-plus text-xs"></i> Follow
          </button>
        </div>
      </div>
    `).join('');
  }

  searchUsers(query) {
    const clean = (query || '').trim().toLowerCase();
    const resultsContainer = document.getElementById('searchResultsList');
    if (!resultsContainer) return;

    if (!clean) {
      resultsContainer.innerHTML = `
        <div class="text-center py-4 font-mono text-xs text-slate-400">
          <i class="fa-solid fa-magnifying-glass block text-xl mb-1 opacity-30"></i>
          Search by name, role, or @username.
        </div>
      `;
      return;
    }

    const all = [...this.discover, ...this.following, ...this.followers];
    const uniqueMap = new Map();
    all.forEach(u => { if (!uniqueMap.has(u.id)) uniqueMap.set(u.id, u); });

    const matched = Array.from(uniqueMap.values()).filter(u => 
      (u.name && u.name.toLowerCase().includes(clean)) ||
      (u.username && u.username.toLowerCase().includes(clean)) ||
      (u.role && u.role.toLowerCase().includes(clean))
    );

    if (matched.length === 0) {
      resultsContainer.innerHTML = `
        <div class="text-center py-4 font-mono text-xs text-slate-400">
          No executive profiles found matching "${query}".
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = matched.map(u => {
      const isFollowing = this.following.some(f => f.id === u.id);
      return `
        <div class="p-3 rounded-xl border border-brand-border bg-brand-cardBg flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-brand-border object-cover" alt="${u.name}"/>
            <div>
              <div class="font-display font-semibold text-xs text-slate-800">${u.name}</div>
              <div class="text-[10px] font-mono text-slate-400">@${u.username} &bull; ${u.role}</div>
            </div>
          </div>
          <div>
            ${isFollowing ? `
              <span class="text-[10px] font-mono text-brand-600 font-bold bg-brand-500/10 px-2.5 py-1 rounded-lg">Following</span>
            ` : `
              <button onclick="window.friendsHub.followUser('${u.id}', '${u.name}')" class="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white font-mono text-xs rounded-lg">
                Follow
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  async followUser(targetId, targetName) {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'usr_alex_vance';

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/friends/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (window.gamification) window.gamification.showToast(data.message || `Following ${targetName}!`);
          this.loadFriendsData();
          return;
        }
      }
    } catch (e) {
      console.warn('[Friends] Follow fallback:', e);
    }

    // Local state fallback
    const targetObj = this.discover.find(u => u.id === targetId);
    if (targetObj) {
      this.following.push(targetObj);
      this.discover = this.discover.filter(u => u.id !== targetId);
      this.renderAll();
      if (window.gamification) window.gamification.showToast(`Followed ${targetName}!`);
    }
  }

  async unfollowUser(targetId) {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'usr_alex_vance';

    try {
      await fetch(`${CONFIG.API_URL}/api/friends/unfollow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId })
      });
    } catch (e) {}

    this.following = this.following.filter(u => u.id !== targetId);
    this.renderAll();
    if (window.gamification) window.gamification.showToast('Unfollowed peer.');
  }

  async respondToRequest(requestId, action) {
    const user = this.getCurrentUser();
    const userId = user ? (user.id || user.email) : 'usr_alex_vance';

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/friends/respond-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, requestId, action })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (window.gamification) {
            window.gamification.showToast(data.message || (action === 'accept' ? 'Connection Accepted!' : 'Request Declined'));
            if (action === 'accept' && typeof fireExecutiveCelebration === 'function') fireExecutiveCelebration();
          }
          this.loadFriendsData();
          return;
        }
      }
    } catch (e) {
      console.warn('[Friends] Respond request fallback:', e);
    }

    // Local fallback
    const req = this.requests.find(r => r.id === requestId);
    this.requests = this.requests.filter(r => r.id !== requestId);

    if (action === 'accept' && req) {
      this.followers.push({
        id: req.fromId,
        name: req.fromName,
        username: req.fromName.toLowerCase().replace(/\s+/g, ''),
        role: req.fromRole,
        avatar: req.fromAvatar,
        gamification: { xp: 820, level: 2, currentStreak: 2, coins: 95 }
      });
      this.following.push({
        id: req.fromId,
        name: req.fromName,
        username: req.fromName.toLowerCase().replace(/\s+/g, ''),
        role: req.fromRole,
        avatar: req.fromAvatar,
        gamification: { xp: 820, level: 2, currentStreak: 2, coins: 95 }
      });
      if (window.gamification) {
        window.gamification.showToast(`Connected with ${req.fromName}!`);
        if (typeof fireExecutiveCelebration === 'function') fireExecutiveCelebration();
      }
    } else {
      if (window.gamification) window.gamification.showToast('Request declined.');
    }
    this.renderAll();
  }

  populateBattleOpponentSelect() {
    const select = document.getElementById('battleOpponentSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose from following --</option>';
    this.following.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = `${u.name} (Lvl ${u.gamification ? u.gamification.level : 1} - ${u.role || 'Executive'})`;
      select.appendChild(opt);
    });
  }

  startDuelWith(opponentName) {
    if (typeof switchTab === 'function') switchTab('challenge');
    const input = document.getElementById('opponentName');
    if (input) input.value = opponentName;
    if (window.gamification) window.gamification.showToast(`Ready to challenge ${opponentName}!`);
  }

  sendBattleChallenge() {
    const select = document.getElementById('battleOpponentSelect');
    const opponent = select ? select.value : '';
    if (!opponent) {
      alert('Please select an opponent from your followed connections.');
      return;
    }
    this.startDuelWith(opponent);
  }

  async loadLeaderboard(filter = 'xp') {
    this.activeFilter = filter;
    const list = document.getElementById('globalLeaderboardList');
    if (!list) return;

    list.innerHTML = `<div class="text-center py-6 font-mono text-xs text-slate-400"><i class="fa-solid fa-circle-notch animate-spin mr-2"></i>Loading leaderboard...</div>`;

    try {
      const res = await fetch(`${CONFIG.API_URL}/api/gamification/leaderboard?filter=${encodeURIComponent(filter)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.leaderboard = data.leaderboard || [];
          this.renderLeaderboardUI(this.leaderboard, filter);
          return;
        }
      }
    } catch (e) {
      console.warn('[Friends] Leaderboard fallback:', e);
    }

    // Local fallback
    const fallbackList = [
      { name: 'Alex Vance', role: 'Senior Executive', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex', xp: 2450, level: 5, streak: 7, bestScore: 94, challengeWins: 12 },
      { name: 'Elena Rostova', role: 'Product Director', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=elena', xp: 1850, level: 4, streak: 5, bestScore: 91, challengeWins: 11 },
      { name: 'Sarah Jenkins', role: 'Managing Partner', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarah', xp: 1720, level: 4, streak: 6, bestScore: 93, challengeWins: 9 },
      { name: 'Marcus Chen', role: 'Tech Lead', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=marcus', xp: 1200, level: 3, streak: 3, bestScore: 88, challengeWins: 7 },
      { name: 'David Kim', role: 'VP of Strategy', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=david', xp: 820, level: 2, streak: 2, bestScore: 86, challengeWins: 4 }
    ];
    this.renderLeaderboardUI(fallbackList, filter);
  }

  renderLeaderboardUI(items, filter) {
    const list = document.getElementById('globalLeaderboardList');
    if (!list) return;

    list.innerHTML = items.map((u, idx) => {
      let metricValue = '';
      if (filter === 'score') metricValue = `${u.bestScore} PTS`;
      else if (filter === 'streak') metricValue = `🔥 ${u.streak} Days`;
      else if (filter === 'battles') metricValue = `⚔️ ${u.challengeWins} Wins`;
      else metricValue = `${u.xp.toLocaleString()} XP (Lvl ${u.level})`;

      const rankBadge = idx === 0 ? 'bg-amber-400 text-slate-900 font-extrabold shadow-md shadow-amber-400/30' :
                        idx === 1 ? 'bg-slate-300 text-slate-800 font-bold' :
                        idx === 2 ? 'bg-amber-700 text-white font-bold' :
                        'bg-slate-200 text-slate-500';

      return `
        <div class="p-3.5 rounded-xl border border-brand-border bg-brand-cardBg flex items-center justify-between hover:border-brand-500/40 transition-all">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-full ${rankBadge} flex items-center justify-center font-mono text-xs">
              #${idx + 1}
            </span>
            <img src="${u.avatar}" class="w-9 h-9 rounded-full border border-brand-border object-cover" alt="${u.name}"/>
            <div>
              <div class="font-display font-semibold text-xs text-slate-800">${u.name}</div>
              <div class="text-[10px] font-mono text-slate-400">${u.role || 'Executive'}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-display font-bold text-sm text-brand-accent">${metricValue}</div>
            <div class="text-[9px] font-mono text-slate-400">Global Rank</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.friendsHub = new FriendsHub();
window.addEventListener('DOMContentLoaded', () => {
  window.friendsHub.init();
});
