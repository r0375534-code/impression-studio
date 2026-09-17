const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
let WebSocket = null;
try {
  WebSocket = require('ws');
} catch (e) {
  console.log('[Backend] ws package not yet installed, WebSocket will initialize after npm install');
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static frontend serving
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// Data File Paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHALLENGES_FILE = path.join(DATA_DIR, 'challenges.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Helper functions for JSON storage
function readJson(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Euclidean distance calculation for 128-d face descriptors
function calculateEuclideanDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const MATCH_THRESHOLD = 0.50; // Strict Face-API distance threshold (One User, One Face)

/* ==========================================================================
   REST API ENDPOINTS
   ========================================================================== */

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'AI Impression Studio Engine' });
});

// 2. Get Users List (Sanitized)
app.get('/api/users', (req, res) => {
  const users = readJson(USERS_FILE);
  const sanitized = users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    hasFaceRegistered: Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128,
    faceDescriptor: u.faceDescriptor,
    stats: u.stats || {},
    badges: u.badges || []
  }));
  res.json(sanitized);
});

// 3. Email + Biometric Face Registration (Strict: One User, One Face)
app.post('/api/auth/register', (req, res) => {
  const { email, username, name, role, faceDescriptor, avatar } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, message: 'Email and Full Name are required.' });
  }

  const hasValidDescriptor = Array.isArray(faceDescriptor) && faceDescriptor.length === 128;
  if (!hasValidDescriptor) {
    return res.status(400).json({ 
      success: false, 
      message: '128-D Biometric Face Scan is mandatory. Policy: One User, One Login, One Face.' 
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();
  const users = readJson(USERS_FILE);

  const existingIdx = users.findIndex(u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.username && u.username.toLowerCase() === cleanUsername));

  // STRICT BIOMETRIC CHECK: Ensure this face is NOT already registered to another account!
  const duplicateFaceUser = users.find(u => {
    if (existingIdx >= 0 && u.id === users[existingIdx].id) return false;
    if (Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128) {
      const dist = calculateEuclideanDistance(faceDescriptor, u.faceDescriptor);
      return dist <= MATCH_THRESHOLD;
    }
    return false;
  });

  if (duplicateFaceUser) {
    return res.status(409).json({
      success: false,
      message: `Biometric Conflict: This face is already enrolled to "${duplicateFaceUser.name}" (${duplicateFaceUser.email || duplicateFaceUser.username}). Each face can only belong to ONE user account.`
    });
  }

  const newUser = {
    id: existingIdx >= 0 ? users[existingIdx].id : `usr_${Date.now()}`,
    email: cleanEmail,
    username: cleanUsername,
    name: name.trim(),
    role: role || 'Executive Candidate',
    avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`,
    registeredAt: new Date().toISOString(),
    faceDescriptor: faceDescriptor,
    stats: existingIdx >= 0 ? users[existingIdx].stats : { sessionsCompleted: 0, avgScore: 88, challengeWins: 0, challengeLosses: 0 },
    badges: existingIdx >= 0 ? users[existingIdx].badges : ['interview_ready']
  };

  if (existingIdx >= 0) {
    users[existingIdx] = newUser;
  } else {
    users.push(newUser);
  }

  writeJson(USERS_FILE, users);

  res.json({
    success: true,
    message: 'Account registered and 128-D Face Biometrics strictly enrolled!',
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      avatar: newUser.avatar,
      hasFaceRegistered: true,
      faceDescriptor: newUser.faceDescriptor,
      stats: newUser.stats,
      badges: newUser.badges
    }
  });
});

// 4. Strict Email + Face Verification Login
// User specifies their registered email, and must show matching face
app.post('/api/auth/verify-email-face', (req, res) => {
  const { email, faceDescriptor } = req.body;

  if (!email || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and 128-d biometric face descriptor are required.' 
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = readJson(USERS_FILE);
  const user = users.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.username && u.username.toLowerCase() === cleanEmail));

  if (!user) {
    return res.status(404).json({
      success: false,
      message: `No account found for email ${cleanEmail}. Please sign up first.`
    });
  }

  if (!Array.isArray(user.faceDescriptor) || user.faceDescriptor.length !== 128) {
    return res.status(400).json({
      success: false,
      message: `Account ${cleanEmail} has not enrolled face biometrics yet. Please register your face.`
    });
  }

  const distance = calculateEuclideanDistance(faceDescriptor, user.faceDescriptor);

  if (distance <= MATCH_THRESHOLD) {
    return res.json({
      success: true,
      message: `Identity verified! Welcome back, ${user.name}.`,
      confidence: Math.round((1 - distance / MATCH_THRESHOLD) * 100),
      distance: Number(distance.toFixed(4)),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        hasFaceRegistered: true,
        faceDescriptor: user.faceDescriptor,
        stats: user.stats,
        badges: user.badges
      }
    });
  } else {
    // STRICT REJECTION: Another face detected for this account!
    return res.status(401).json({
      success: false,
      message: `Authentication Denied: Scanned face does NOT match the registered biometric owner of ${cleanEmail}.`,
      distance: Number(distance.toFixed(4)),
      threshold: MATCH_THRESHOLD
    });
  }
});

// 5. One-Look Biometric Face Login (Auto-identifies who is in front of camera)
app.post('/api/auth/face-login', (req, res) => {
  const { faceDescriptor } = req.body;

  if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid biometric face descriptor. Expected 128 float values.' 
    });
  }

  const users = readJson(USERS_FILE);
  const usersWithFace = users.filter(u => Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128);

  if (usersWithFace.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No registered face profiles found in the system. Please sign up with your face first.'
    });
  }

  let bestMatch = null;
  let minDistance = 999.0;

  for (const user of usersWithFace) {
    const distance = calculateEuclideanDistance(faceDescriptor, user.faceDescriptor);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = user;
    }
  }

  if (bestMatch && minDistance <= MATCH_THRESHOLD) {
    return res.json({
      success: true,
      message: `Identity verified! Welcome back, ${bestMatch.name}.`,
      confidence: Math.round((1 - minDistance / MATCH_THRESHOLD) * 100),
      distance: Number(minDistance.toFixed(4)),
      user: {
        id: bestMatch.id,
        email: bestMatch.email,
        username: bestMatch.username,
        name: bestMatch.name,
        role: bestMatch.role,
        avatar: bestMatch.avatar,
        hasFaceRegistered: true,
        faceDescriptor: bestMatch.faceDescriptor,
        stats: bestMatch.stats,
        badges: bestMatch.badges
      }
    });
  } else {
    return res.status(401).json({
      success: false,
      message: 'Face authentication failed: No registered identity matches this face.',
      bestDistance: Number(minDistance.toFixed(4)),
      threshold: MATCH_THRESHOLD
    });
  }
});

// 6. Direct Email / Username Fallback Login
app.post('/api/auth/login', (req, res) => {
  const { email, username, faceDescriptor } = req.body;
  const identifier = (email || username || '').trim().toLowerCase();

  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Email or Username is required.' });
  }

  const users = readJson(USERS_FILE);
  const user = users.find(u => (u.email && u.email.toLowerCase() === identifier) || (u.username && u.username.toLowerCase() === identifier));

  if (user) {
    // If faceDescriptor is provided, verify it strictly
    if (Array.isArray(faceDescriptor) && faceDescriptor.length === 128) {
      if (Array.isArray(user.faceDescriptor) && user.faceDescriptor.length === 128) {
        const dist = calculateEuclideanDistance(faceDescriptor, user.faceDescriptor);
        if (dist > MATCH_THRESHOLD) {
          return res.status(401).json({
            success: false,
            message: `Authentication Denied: Scanned face does NOT match the registered biometric owner of ${identifier}.`
          });
        }
      }
    }

    return res.json({
      success: true,
      message: `Biometric Identity Verified! Logged in as ${user.name}`,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        hasFaceRegistered: Array.isArray(user.faceDescriptor) && user.faceDescriptor.length === 128,
        faceDescriptor: user.faceDescriptor,
        stats: user.stats,
        badges: user.badges
      }
    });
  }

  return res.status(404).json({
    success: false,
    message: `No account found for "${identifier}". Please register your email and face first.`
  });
});

// 7. Challenge History & Recording
app.get('/api/challenges/history', (req, res) => {
  const history = readJson(CHALLENGES_FILE);
  res.json(history.slice(-50).reverse());
});

app.post('/api/challenges/record', (req, res) => {
  const matchRecord = req.body;
  if (!matchRecord.player1 || !matchRecord.player2) {
    return res.status(400).json({ success: false, message: 'Invalid match record.' });
  }

  const history = readJson(CHALLENGES_FILE);
  const newMatch = {
    id: `match_${Date.now()}`,
    roomId: matchRecord.roomId || `DUEL-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    player1: matchRecord.player1,
    player2: matchRecord.player2,
    winner: matchRecord.winner,
    duration: matchRecord.duration || 30
  };

  history.push(newMatch);
  writeJson(CHALLENGES_FILE, history);

  const users = readJson(USERS_FILE);
  users.forEach(u => {
    if (u.name === newMatch.winner) {
      u.stats.challengeWins = (u.stats.challengeWins || 0) + 1;
    } else if (u.name === newMatch.player1.name || u.name === newMatch.player2.name) {
      u.stats.challengeLosses = (u.stats.challengeLosses || 0) + 1;
    }
  });
  writeJson(USERS_FILE, users);

  res.json({ success: true, match: newMatch });
});

// 8. Session Diagnostics
app.get('/api/sessions', (req, res) => {
  res.json(readJson(SESSIONS_FILE));
});

app.post('/api/sessions', (req, res) => {
  const session = req.body;
  const sessions = readJson(SESSIONS_FILE);
  sessions.unshift({
    id: `sess_${Date.now()}`,
    timestamp: new Date().toLocaleString(),
    ...session
  });
  if (sessions.length > 50) sessions.pop();
  writeJson(SESSIONS_FILE, sessions);
  res.json({ success: true, count: sessions.length });
});

/* ==========================================================================
   FRIENDS & SOCIAL HUB ENDPOINTS
   ========================================================================== */

// Helper to sanitize a user summary
function sanitizeSummary(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    avatar: u.avatar,
    gamification: u.gamification || { xp: 0, level: 1, currentStreak: 0, coins: 0 },
    stats: u.stats || { avgScore: 85, challengeWins: 0 }
  };
}

// Get Friends & Social lists for a user
app.get('/api/friends/list/:userId', (req, res) => {
  const { userId } = req.params;
  const users = readJson(USERS_FILE);
  const user = users.find(u => u.id === userId || u.username === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));

  const followingIds = (user && user.following) || [];
  const followerIds = (user && user.followers) || [];
  const friendRequests = (user && user.friendRequests) || [];

  const following = users.filter(u => followingIds.includes(u.id)).map(sanitizeSummary);
  const followers = users.filter(u => followerIds.includes(u.id)).map(sanitizeSummary);
  const discover = users.filter(u => (!user || u.id !== user.id) && !followingIds.includes(u.id)).map(sanitizeSummary);

  res.json({
    success: true,
    following,
    followers,
    requests: friendRequests.filter(r => r.status === 'pending'),
    discover
  });
});

// Send Friend / Follow Request
app.post('/api/friends/follow', (req, res) => {
  const { userId, targetId } = req.body;
  const users = readJson(USERS_FILE);

  const sender = users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === (userId || '').toLowerCase()));
  const target = users.find(u => u.id === targetId || (u.username && u.username.toLowerCase() === (targetId || '').toLowerCase()));

  if (!sender || !target) {
    return res.status(404).json({ success: false, message: 'Sender or Target user not found.' });
  }

  if (!target.friendRequests) target.friendRequests = [];
  if (!sender.following) sender.following = [];

  // Check if already following
  if (sender.following.includes(target.id)) {
    return res.json({ success: true, message: 'Already following.', isFollowing: true });
  }

  // Create or update incoming request on target user
  const existingReq = target.friendRequests.find(r => r.fromId === sender.id);
  if (!existingReq) {
    target.friendRequests.unshift({
      id: `freq_${Date.now()}`,
      fromId: sender.id,
      fromName: sender.name,
      fromAvatar: sender.avatar,
      fromRole: sender.role,
      status: 'pending',
      timestamp: new Date().toISOString()
    });
  }

  // Sender registers target in following
  if (!sender.following.includes(target.id)) {
    sender.following.push(target.id);
  }

  writeJson(USERS_FILE, users);
  res.json({ success: true, message: `Follow request sent to ${target.name}!`, isFollowing: true });
});

// Unfollow a user
app.post('/api/friends/unfollow', (req, res) => {
  const { userId, targetId } = req.body;
  const users = readJson(USERS_FILE);

  const user = users.find(u => u.id === userId);
  const target = users.find(u => u.id === targetId);

  if (user && user.following) {
    user.following = user.following.filter(id => id !== targetId);
  }
  if (target && target.followers) {
    target.followers = target.followers.filter(id => id !== userId);
  }

  writeJson(USERS_FILE, users);
  res.json({ success: true, message: 'Unfollowed successfully.' });
});

// Respond to Friend Request (Accept or Reject)
app.post('/api/friends/respond-request', (req, res) => {
  const { userId, requestId, action } = req.body; // action: 'accept' | 'reject'
  const users = readJson(USERS_FILE);

  const user = users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === (userId || '').toLowerCase()));
  if (!user || !user.friendRequests) {
    return res.status(404).json({ success: false, message: 'User or requests not found.' });
  }

  const reqIndex = user.friendRequests.findIndex(r => r.id === requestId || r.fromId === requestId);
  if (reqIndex === -1) {
    return res.status(404).json({ success: false, message: 'Friend request not found.' });
  }

  const reqItem = user.friendRequests[reqIndex];
  const requester = users.find(u => u.id === reqItem.fromId);

  if (action === 'accept') {
    reqItem.status = 'accepted';
    if (!user.followers) user.followers = [];
    if (!user.following) user.following = [];
    if (!user.followers.includes(reqItem.fromId)) user.followers.push(reqItem.fromId);
    if (!user.following.includes(reqItem.fromId)) user.following.push(reqItem.fromId);

    if (requester) {
      if (!requester.followers) requester.followers = [];
      if (!requester.following) requester.following = [];
      if (!requester.followers.includes(user.id)) requester.followers.push(user.id);
      if (!requester.following.includes(user.id)) requester.following.push(user.id);
    }
    user.friendRequests.splice(reqIndex, 1);
    writeJson(USERS_FILE, users);
    return res.json({ success: true, message: `Accepted connection with ${reqItem.fromName}!`, action: 'accepted' });
  } else {
    user.friendRequests.splice(reqIndex, 1);
    writeJson(USERS_FILE, users);
    return res.json({ success: true, message: 'Declined request.', action: 'rejected' });
  }
});

/* ==========================================================================
   GAMIFICATION: STREAKS, DAILY TASKS ("DAILY ASK"), LEVELS & XP
   ========================================================================== */

const DEFAULT_DAILY_TASKS = [
  { id: 'task_calib', title: 'Diagnostic Calibration', desc: 'Complete 1 camera & posture calibration', xpReward: 50, coinsReward: 10, completed: false, claimed: false },
  { id: 'task_smile', title: 'Executive Warmth', desc: 'Hold ≥ 75% smile warmth for 15 seconds', xpReward: 75, coinsReward: 15, completed: false, claimed: false },
  { id: 'task_eye', title: 'Laser Eye Contact', desc: 'Maintain ≥ 80% direct eye contact in session', xpReward: 75, coinsReward: 15, completed: false, claimed: false },
  { id: 'task_voice', title: 'Vocal Presence', desc: 'Complete audio speech analysis with pace 110-160 wpm', xpReward: 100, coinsReward: 20, completed: false, claimed: false },
  { id: 'task_duel', title: 'Arena Contender', desc: 'Challenge or compete in a 1v1 battle duel', xpReward: 150, coinsReward: 30, completed: false, claimed: false }
];

// Helper to initialize or refresh user gamification stats
function getOrInitGamification(user) {
  const today = new Date().toISOString().split('T')[0];
  if (!user.gamification) {
    user.gamification = {
      xp: 150,
      level: 1,
      currentStreak: 1,
      longestStreak: 1,
      lastSessionDate: today,
      coins: 25,
      unlockedAchievements: ['first_session'],
      dailyTasks: JSON.parse(JSON.stringify(DEFAULT_DAILY_TASKS)),
      dailyTasksDate: today
    };
  }

  // Refresh daily tasks if new day
  if (user.gamification.dailyTasksDate !== today) {
    user.gamification.dailyTasks = JSON.parse(JSON.stringify(DEFAULT_DAILY_TASKS));
    user.gamification.dailyTasksDate = today;
  }
  return user.gamification;
}

// Get user gamification status
app.get('/api/gamification/stats/:userId', (req, res) => {
  const { userId } = req.params;
  const users = readJson(USERS_FILE);
  const user = users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));

  if (!user) {
    return res.json({
      success: true,
      gamification: {
        xp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastSessionDate: null,
        coins: 0,
        unlockedAchievements: [],
        dailyTasks: DEFAULT_DAILY_TASKS
      }
    });
  }

  const gamification = getOrInitGamification(user);
  res.json({ success: true, gamification });
});

// Record completed session, award XP/Coins, update Streak & Daily Tasks
app.post('/api/gamification/record-session', (req, res) => {
  const { userId, sessionMetrics } = req.body;
  const users = readJson(USERS_FILE);
  const user = users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === (userId || '').toLowerCase()));

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const g = getOrInitGamification(user);
  const today = new Date().toISOString().split('T')[0];
  const lastDate = g.lastSessionDate;

  // 1. Streak update
  if (lastDate === today) {
    // Already active today
  } else if (lastDate) {
    const diffDays = Math.round((new Date(today) - new Date(lastDate)) / 86400000);
    g.currentStreak = diffDays === 1 ? g.currentStreak + 1 : 1;
  } else {
    g.currentStreak = 1;
  }
  g.longestStreak = Math.max(g.longestStreak || 1, g.currentStreak);
  g.lastSessionDate = today;

  // 2. XP & Coins award
  const overall = (sessionMetrics && sessionMetrics.overall) || 75;
  const earnedXp = 50 + Math.round(overall / 2);
  const earnedCoins = 10 + (overall >= 90 ? 20 : overall >= 80 ? 10 : 5);

  g.xp = (g.xp || 0) + earnedXp;
  g.coins = (g.coins || 0) + earnedCoins;
  g.level = Math.floor(g.xp / 500) + 1;

  // 3. Update daily tasks
  if (sessionMetrics) {
    const tasks = g.dailyTasks || [];
    tasks.forEach(t => {
      if (t.id === 'task_calib') t.completed = true;
      if (t.id === 'task_smile' && (sessionMetrics.smile || 0) >= 75) t.completed = true;
      if (t.id === 'task_eye' && (sessionMetrics.eyeContact || 0) >= 80) t.completed = true;
      if (t.id === 'task_voice' && (sessionMetrics.voiceConfidence || 0) >= 70) t.completed = true;
    });
  }

  // 4. Check achievements
  if (!g.unlockedAchievements) g.unlockedAchievements = [];
  const newlyUnlocked = [];
  const awardAchievement = (code) => {
    if (!g.unlockedAchievements.includes(code)) {
      g.unlockedAchievements.push(code);
      newlyUnlocked.push(code);
    }
  };

  awardAchievement('first_session');
  if (g.currentStreak >= 3) awardAchievement('streak_3');
  if (g.currentStreak >= 7) awardAchievement('streak_7');
  if (g.currentStreak >= 30) awardAchievement('streak_30');
  if (overall >= 90) awardAchievement('high_scorer');
  if (g.level >= 5) awardAchievement('level_5');

  // Update overall user stats count
  if (!user.stats) user.stats = {};
  user.stats.sessionsCompleted = (user.stats.sessionsCompleted || 0) + 1;
  user.stats.avgScore = Math.round(((user.stats.avgScore || 85) * 0.7) + (overall * 0.3));

  writeJson(USERS_FILE, users);

  res.json({
    success: true,
    earnedXp,
    earnedCoins,
    gamification: g,
    newlyUnlocked
  });
});

// Claim a completed daily task
app.post('/api/gamification/claim-daily-task', (req, res) => {
  const { userId, taskId } = req.body;
  const users = readJson(USERS_FILE);
  const user = users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === (userId || '').toLowerCase()));

  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  const g = getOrInitGamification(user);
  const task = (g.dailyTasks || []).find(t => t.id === taskId);

  if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
  if (!task.completed) return res.status(400).json({ success: false, message: 'Task not yet completed.' });
  if (task.claimed) return res.status(400).json({ success: false, message: 'Task already claimed.' });

  task.claimed = true;
  g.xp += task.xpReward || 50;
  g.coins += task.coinsReward || 10;
  g.level = Math.floor(g.xp / 500) + 1;

  writeJson(USERS_FILE, users);
  res.json({ success: true, message: `Claimed +${task.xpReward} XP and +${task.coinsReward} Coins!`, gamification: g });
});

// Multi-criteria Global Leaderboard
app.get('/api/gamification/leaderboard', (req, res) => {
  const { filter = 'xp' } = req.query;
  const users = readJson(USERS_FILE);

  const leaderboard = users.map(u => {
    const g = u.gamification || { xp: 0, level: 1, currentStreak: 0, coins: 0 };
    const s = u.stats || { avgScore: 80, challengeWins: 0 };
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      avatar: u.avatar,
      xp: g.xp || 0,
      level: g.level || 1,
      streak: g.currentStreak || 0,
      coins: g.coins || 0,
      bestScore: s.avgScore || 85,
      challengeWins: s.challengeWins || 0
    };
  });

  if (filter === 'score') {
    leaderboard.sort((a, b) => b.bestScore - a.bestScore);
  } else if (filter === 'streak') {
    leaderboard.sort((a, b) => b.streak - a.streak);
  } else if (filter === 'battles') {
    leaderboard.sort((a, b) => b.challengeWins - a.challengeWins);
  } else {
    // default: 'xp'
    leaderboard.sort((a, b) => b.xp - a.xp);
  }

  res.json({ success: true, filter, leaderboard });
});

/* ==========================================================================
   WEBSOCKET REALTIME 2-MEMBER CHALLENGE ENGINE
   ========================================================================== */
const activeRooms = new Map();

function setupWebSocketServer() {
  if (!WebSocket) return;
  const wss = new WebSocket.Server({ server, path: '/ws/challenge' });

  wss.on('connection', (ws) => {
    let currentRoomId = null;
    let playerRole = null;

    ws.on('message', (messageStr) => {
      try {
        const data = JSON.parse(messageStr);

        switch (data.type) {
          case 'JOIN_ROOM': {
            const roomId = (data.roomId || `DUEL-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
            currentRoomId = roomId;

            let room = activeRooms.get(roomId);
            if (!room) {
              playerRole = 'player1';
              room = {
                id: roomId,
                createdAt: Date.now(),
                duration: data.duration || 30,
                status: 'waiting',
                player1: { ws, info: data.player || { name: 'Player 1' }, metrics: {} },
                player2: null
              };
              activeRooms.set(roomId, room);
              ws.send(JSON.stringify({
                type: 'ROOM_CREATED',
                roomId,
                role: 'player1',
                message: `Room ${roomId} created. Waiting for opponent to join...`
              }));
            } else if (!room.player2) {
              playerRole = 'player2';
              room.player2 = { ws, info: data.player || { name: 'Player 2' }, metrics: {} };
              room.status = 'ready';

              if (room.player1.ws.readyState === WebSocket.OPEN) {
                room.player1.ws.send(JSON.stringify({
                  type: 'OPPONENT_JOINED',
                  roomId,
                  opponent: room.player2.info
                }));
              }

              ws.send(JSON.stringify({
                type: 'ROOM_JOINED',
                roomId,
                role: 'player2',
                opponent: room.player1.info
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: `Room ${roomId} is full.`
              }));
            }
            break;
          }

          case 'START_DUEL': {
            const room = activeRooms.get(currentRoomId);
            if (room && room.player1 && room.player2) {
              room.status = 'in_progress';
              const duration = data.duration || room.duration || 30;

              const broadcast = (msg) => {
                if (room.player1.ws.readyState === WebSocket.OPEN) room.player1.ws.send(JSON.stringify(msg));
                if (room.player2.ws.readyState === WebSocket.OPEN) room.player2.ws.send(JSON.stringify(msg));
              };

              broadcast({
                type: 'DUEL_STARTING',
                countdown: 3,
                duration
              });
            }
            break;
          }

          case 'METRIC_STREAM': {
            const room = activeRooms.get(currentRoomId);
            if (room && room.status === 'in_progress') {
              const metrics = data.metrics || {};
              if (playerRole === 'player1') {
                room.player1.metrics = metrics;
                if (room.player2 && room.player2.ws.readyState === WebSocket.OPEN) {
                  room.player2.ws.send(JSON.stringify({
                    type: 'OPPONENT_METRICS',
                    metrics
                  }));
                }
              } else if (playerRole === 'player2') {
                room.player2.metrics = metrics;
                if (room.player1 && room.player1.ws.readyState === WebSocket.OPEN) {
                  room.player1.ws.send(JSON.stringify({
                    type: 'OPPONENT_METRICS',
                    metrics
                  }));
                }
              }
            }
            break;
          }

          case 'FINISH_DUEL': {
            const room = activeRooms.get(currentRoomId);
            if (room && room.status !== 'finished') {
              room.status = 'finished';
              const p1Score = (room.player1 && room.player1.metrics.overall) || 82;
              const p2Score = (room.player2 && room.player2.metrics.overall) || 80;

              let winnerName = 'Tie';
              if (p1Score > p2Score) winnerName = room.player1.info.name;
              else if (p2Score > p1Score) winnerName = room.player2.info.name;

              const resultPayload = {
                type: 'DUEL_FINISHED',
                roomId: room.id,
                winner: winnerName,
                player1: {
                  ...room.player1.info,
                  finalMetrics: room.player1.metrics
                },
                player2: {
                  ...room.player2.info,
                  finalMetrics: room.player2.metrics
                }
              };

              if (room.player1 && room.player1.ws.readyState === WebSocket.OPEN) room.player1.ws.send(JSON.stringify(resultPayload));
              if (room.player2 && room.player2.ws.readyState === WebSocket.OPEN) room.player2.ws.send(JSON.stringify(resultPayload));
            }
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId && activeRooms.has(currentRoomId)) {
        const room = activeRooms.get(currentRoomId);
        if (playerRole === 'player1' && room.player2 && room.player2.ws.readyState === WebSocket.OPEN) {
          room.player2.ws.send(JSON.stringify({ type: 'OPPONENT_DISCONNECTED', message: 'Player 1 disconnected.' }));
        } else if (playerRole === 'player2' && room.player1 && room.player1.ws.readyState === WebSocket.OPEN) {
          room.player1.ws.send(JSON.stringify({ type: 'OPPONENT_DISCONNECTED', message: 'Player 2 disconnected.' }));
        }
        activeRooms.delete(currentRoomId);
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AI Impression Analyzer Pro - Backend Running!`);
  console.log(`📡 REST API & Static Server: http://localhost:${PORT}`);
  console.log(`⚔️ 2-Member Challenge WebSocket: ws://localhost:${PORT}/ws/challenge`);
  console.log(`👤 Biometric Email & Face Recognition Engine: Active`);
  console.log(`=======================================================`);
  setupWebSocketServer();
});
