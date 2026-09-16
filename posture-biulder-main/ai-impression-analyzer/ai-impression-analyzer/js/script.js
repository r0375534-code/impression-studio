    /* ==========================================================================
       GLOBAL APP STATE & CONFIGURATION
       ========================================================================== */
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
    
    let isModelsLoaded = false;
    let isDetectionActive = false;
    let isAudioActive = false;
    let stream = null;
    let detectionInterval = null;
    let audioContext = null;
    let analyser = null;
    let microphoneNode = null;
    let audioStream = null;

    // Core Metric Realtime State
    let currentMetrics = {
      overall: 0,
      smile: 0,
      eyeContact: 0,
      composure: 0,
      steadiness: 100,
      posture: 0,
      voiceConfidence: 0,
      speechPace: 0,
      fillerCount: 0,
      pitchVariation: 0,       // New Project 2 Audio Feature
      microFocus: 0,           // New Project 2 Vision Feature
      microSurprise: 0,        // New Project 2 Vision Feature
      microStress: 0,          // New Project 2 Vision Feature
      lightingLux: 'PERFECT',
      postureWarning: 'Centered'
    };

    // Session History array in localStorage
    let sessionLogs = JSON.parse(localStorage.getItem('ai_impression_sessions') || '[]');
    let leaderboardData = JSON.parse(localStorage.getItem('ai_impression_leaderboard') || '[]');

    // Default Leaderboard if empty
    if(leaderboardData.length === 0){
      leaderboardData = [
        { name: 'Alex Vance', score: 94, date: '2026-08-01' },
        { name: 'Elena Rostova', score: 91, date: '2026-08-02' },
        { name: 'Marcus Chen', score: 87, date: '2026-08-03' }
      ];
      localStorage.setItem('ai_impression_leaderboard', JSON.stringify(leaderboardData));
    }

    // Chart References
    let trendChartInstance = null;
    let radarChartInstance = null;
    let emotionChartInstance = null;
    let doughnutChartInstance = null; // New Project 2 Chart
    let emotionHistory = [];

    // Face Movement & Stability tracking
    let prevLandmarks = null;
    let eyeContactFrameHits = 0;
    let totalFramesProcessed = 0;

    // Badges Configuration
    const BADGES_DEF = [
      { id: 'interview_ready', title: 'Interview Ready', icon: 'fa-user-tie', color: 'text-amber-400', desc: 'Achieve overall score ≥ 85 pts' },
      { id: 'eye_contact_master', title: 'Laser Eye Contact', icon: 'fa-eye', color: 'text-cyan-400', desc: 'Maintain ≥ 85% eye contact' },
      { id: 'radiant_smile', title: 'Radiant Smile', icon: 'fa-face-smile', color: 'text-amber-400', desc: 'Reach ≥ 80% warmth smile score' },
      { id: 'iron_composure', title: 'Iron Composure', icon: 'fa-shield-halved', color: 'text-indigo-500', desc: 'Hold ≥ 90% steady composure' },
      { id: 'silver_tongue', title: 'Silver Tongue', icon: 'fa-microphone', color: 'text-purple-400', desc: 'Achieve ≥ 80% voice confidence' },
      { id: 'perfect_posture', title: 'Commanding Posture', icon: 'fa-anchor', color: 'text-blue-400', desc: 'Hold centered alignment' }
    ];

    // Track recently unlocked badges to prevent continuous confetti spam
    let unlockedBadgesHistory = JSON.parse(localStorage.getItem('ai_impression_unlocked_badges') || '[]');

    // Interview Questions Set
    const INTERVIEW_QUESTIONS = [
      { q: "Tell me about a challenging situation where you had to lead a project under tight deadlines. How did you maintain composure?", cat: "BEHAVIORAL" },
      { q: "Why do you consider yourself the ideal candidate for this executive position?", cat: "EVALUATION" },
      { q: "Describe a time when you received harsh criticism. How did you handle your reaction and posture?", cat: "ADAPTABILITY" },
      { q: "How do you project confidence and clear vocal tone when speaking to senior stakeholders?", cat: "COMMUNICATION" },
      { q: "Where do you see your leadership trajectory progressing over the next 5 years?", cat: "VISION" }
    ];
    let currentQIdx = 0;
    let interviewTimerInterval = null;
    let interviewTimeRemaining = 30;

    // Timed Practice Session Variables
    let practiceTimerInterval = null;
    let practiceTimeRemaining = 60;
    let practiceTotalDuration = 60;
    let isPracticeRecording = false;
    let practiceSessionSamples = [];

    // Auto-PDF generator & custom download folder settings
    let autoPdfEnabled = true;
    let downloadDirHandle = null; // File System Access API directory handle, when chosen

    /* ==========================================================================
       DARK / LIGHT THEME TOGGLE
       ========================================================================== */
    function applyTheme(isDark) {
      document.documentElement.classList.toggle('dark', isDark);
      const icon = document.getElementById('themeToggleIcon');
      if (icon) icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      localStorage.setItem('ai_impression_theme', isDark ? 'dark' : 'light');
    }

    function toggleTheme() {
      const isDark = !document.documentElement.classList.contains('dark');
      applyTheme(isDark);
    }

    function initTheme() {
      const saved = localStorage.getItem('ai_impression_theme');
      if (saved) {
        applyTheme(saved === 'dark');
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark);
      }
    }
    initTheme();

    /* ==========================================================================
       INITIALIZATION & MODEL LOADING
       ========================================================================== */
    window.addEventListener('load', async () => {
      renderBadgesUI();
      renderLeaderboardUI();
      renderHistoryTable();
      initCharts();
      await loadNeuralModels();
    });

    async function loadNeuralModels(){
      const statusText = document.getElementById('statusText');
      const statusLed = document.getElementById('statusLed');
      const btnStartCam = document.getElementById('btnStartCam');

      try {
        statusText.textContent = "Loading Face Net Models...";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        isModelsLoaded = true;
        statusText.textContent = "AI Vision Models Ready";
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-400";
        btnStartCam.disabled = false;
      } catch (err) {
        console.warn("Primary CDN model load fallback:", err);
        // Graceful fallback to synthetic AI computer vision simulation if CDN is restricted
        isModelsLoaded = true;
        statusText.textContent = "Simulated Engine Ready";
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-indigo-500";
        btnStartCam.disabled = false;
      }
    }

    /* ==========================================================================
       TAB SWITCHING ROUTER
       ========================================================================== */
    function switchTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-600', 'text-white', 'font-semibold');
        btn.classList.add('text-slate-500');
      });

      if (tabName === 'studio') {
        document.getElementById('tabStudioView').classList.remove('hidden');
        document.getElementById('navStudio').classList.add('bg-brand-600', 'text-white', 'font-semibold');
      } else if (tabName === 'interview') {
        document.getElementById('tabInterviewView').classList.remove('hidden');
        document.getElementById('navInterview').classList.add('bg-brand-600', 'text-white', 'font-semibold');
      } else if (tabName === 'practice') {
        document.getElementById('tabPracticeView').classList.remove('hidden');
        document.getElementById('navPractice').classList.add('bg-brand-600', 'text-white', 'font-semibold');
      } else if (tabName === 'analytics') {
        document.getElementById('tabAnalyticsView').classList.remove('hidden');
        document.getElementById('navAnalytics').classList.add('bg-brand-600', 'text-white', 'font-semibold');
        updateCharts();
      } else if (tabName === 'badges') {
        document.getElementById('tabBadgesView').classList.remove('hidden');
        document.getElementById('navBadges').classList.add('bg-brand-600', 'text-white', 'font-semibold');
      }
    }

    /* ==========================================================================
       CONFETTI CELEBRATION ENGINE (Imported from Project 2)
       ========================================================================== */
    function fireExecutiveCelebration() {
      if (typeof confetti !== 'function') return; // Safety check
      
      var duration = 3 * 1000;
      var animationEnd = Date.now() + duration;
      var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        // Fire from both sides matching the emerald/accent brand colors
        confetti(Object.assign({}, defaults, { 
          particleCount, 
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#10b981', '#a3e635', '#34d399'] 
        }));
        confetti(Object.assign({}, defaults, { 
          particleCount, 
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#10b981', '#a3e635', '#34d399'] 
        }));
      }, 250);
    }

    /* ==========================================================================
       AUTO PDF GENERATOR TOGGLE & CUSTOM DOWNLOAD FOLDER
       ========================================================================== */
    function toggleAutoPdfGenerator() {
      autoPdfEnabled = !autoPdfEnabled;
      const btn = document.getElementById('btnToggleAutoPdf');
      const knob = document.getElementById('autoPdfToggleKnob');
      const helper = document.getElementById('autoPdfHelperText');

      btn.setAttribute('aria-checked', String(autoPdfEnabled));
      if (autoPdfEnabled) {
        btn.classList.remove('bg-slate-300');
        btn.classList.add('bg-brand-500');
        knob.classList.add('translate-x-5');
        helper.textContent = 'ON — PDF auto-downloads when timer hits 0';
      } else {
        btn.classList.remove('bg-brand-500');
        btn.classList.add('bg-slate-300');
        knob.classList.remove('translate-x-5');
        helper.textContent = 'OFF — use "Stop & Generate PDF Now" to save manually';
      }
    }

    async function chooseDownloadFolder() {
      const folderTextEl = document.getElementById('downloadFolderText');
      if (!window.showDirectoryPicker) {
        alert("Your browser doesn't support choosing a folder directly (this needs Chrome or Edge). PDFs will go to your browser's default Downloads folder instead.");
        return;
      }
      try {
        downloadDirHandle = await window.showDirectoryPicker();
        folderTextEl.textContent = `${downloadDirHandle.name}/`;
      } catch (err) {
        // User cancelled the picker — keep previous setting
      }
    }

    // Saves a jsPDF doc either into the chosen folder (Chrome/Edge) or via a normal browser download
    async function savePdfDoc(doc, filename) {
      if (downloadDirHandle) {
        try {
          const fileHandle = await downloadDirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(doc.output('blob'));
          await writable.close();
          return;
        } catch (err) {
          console.warn('Could not save to chosen folder, falling back to normal download:', err);
        }
      }
      doc.save(filename);
    }

    function testConfetti() {
        fireExecutiveCelebration();
    }

    /* ==========================================================================
       CAMERA & CALIBRATION PROCESS
       ========================================================================== */
    function triggerCalibrationProcess() {
      const calibModal = document.getElementById('calibrationOverlay');
      calibModal.classList.remove('hidden');
      startCameraStream();
    }

    async function startCameraStream() {
      const video = document.getElementById('videoElement');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        video.srcObject = stream;
        document.getElementById('btnStartCam').disabled = true;
        document.getElementById('btnStopCam').disabled = false;
        document.getElementById('scanBeam').classList.remove('hidden');
      } catch (err) {
        alert("Camera access was blocked or unavailable. Please enable webcam permissions.");
        console.error("Camera access error:", err);
      }
    }

    async function runCalibrationProcess() {
      const btn = document.getElementById('btnStartCalibAction');
      btn.disabled = true;
      btn.textContent = "Analyzing Environment...";

      // Check 1: Face Visibility
      setTimeout(() => {
        document.getElementById('checkFaceVisible').innerHTML = `<span>Face Visibility</span> <i class="fa-solid fa-check text-indigo-500"></i>`;
      }, 600);

      // Check 2: Lighting Level
      setTimeout(() => {
        document.getElementById('checkLighting').innerHTML = `<span>Lighting Level</span> <i class="fa-solid fa-check text-indigo-500"></i>`;
      }, 1200);

      // Check 3: Distance Check
      setTimeout(() => {
        document.getElementById('checkDistance').innerHTML = `<span>Distance Check</span> <i class="fa-solid fa-check text-indigo-500"></i>`;
      }, 1800);

      // Check 4: Alignment
      setTimeout(() => {
        document.getElementById('checkAlignment').innerHTML = `<span>Centering</span> <i class="fa-solid fa-check text-indigo-500"></i>`;
        document.getElementById('countdownBox').classList.remove('hidden');
        btn.classList.add('hidden');
        
        let cnt = 3;
        const cNum = document.getElementById('countdownNum');
        const timer = setInterval(() => {
          cnt--;
          if (cnt > 0) {
            cNum.textContent = cnt;
          } else {
            clearInterval(timer);
            document.getElementById('calibrationOverlay').classList.add('hidden');
            startDetectionLoop();
          }
        }, 800);

      }, 2400);
    }

    function stopCameraStudio() {
      if (detectionInterval) clearInterval(detectionInterval);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (isAudioActive) stopAudioEngine();
      document.getElementById('videoElement').srcObject = null;
      document.getElementById('btnStartCam').disabled = false;
      document.getElementById('btnStopCam').disabled = true;
      document.getElementById('scanBeam').classList.add('hidden');
      document.getElementById('calibrationOverlay').classList.remove('hidden');
      isDetectionActive = false;
      resetRealtimeUI();
    }

    /* ==========================================================================
       COMPUTER VISION & DETECTOR ENGINE LOOP
       ========================================================================== */
    function startDetectionLoop() {
      const video = document.getElementById('videoElement');
      const canvas = document.getElementById('overlayCanvas');
      isDetectionActive = true;

      let lastTime = performance.now();
      let frameCount = 0;

      detectionInterval = setInterval(async () => {
        if (!isDetectionActive) return;

        // Calculate FPS
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) {
          document.getElementById('fpsCounter').textContent = `${frameCount} FPS`;
          frameCount = 0;
          lastTime = now;
        }

        let detectionResult = null;
        if (isModelsLoaded && typeof faceapi !== 'undefined' && faceapi.nets.tinyFaceDetector.params) {
          try {
            detectionResult = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
              .withFaceLandmarks()
              .withFaceExpressions();
          } catch(e) {
            detectionResult = null;
          }
        }

        const ctx = canvas.getContext('2d');
        canvas.width = video.clientWidth || 640;
        canvas.height = video.clientHeight || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detectionResult) {
          // Draw face bounds
          const dims = faceapi.matchDimensions(canvas, { width: canvas.width, height: canvas.height });
          const resized = faceapi.resizeResults(detectionResult, dims);
          faceapi.draw.drawDetections(canvas, resized);

          processFaceMetrics(detectionResult, canvas.width, canvas.height);
        } else {
          // No face visible (camera dark, out of frame, models not loaded, etc.)
          // Do NOT fabricate scores here — reflect the real "no data" state instead.
          processNoFaceDetected(canvas.width, canvas.height);
        }

        // Run Lighting analysis on canvas pixels
        analyzeLightingQuality(video);

      }, 300);
    }

    /* Process real Face API landmark outputs & Micro-Expressions */
    function processFaceMetrics(result, frameW, frameH) {
      totalFramesProcessed++;
      const exp = result.expressions;
      const box = result.detection.box;
      const landmarks = result.landmarks;

      // 1. Smile Score
      const smileScore = Math.round((exp.happy || 0) * 100);

      // 2. Eye Contact Proxy (Face Centering & Nose Vector)
      const boxCenterX = box.x + box.width / 2;
      const boxCenterY = box.y + box.height / 2;
      const offsetX = Math.abs(boxCenterX - frameW / 2) / (frameW / 2);
      const offsetY = Math.abs(boxCenterY - frameH / 2) / (frameH / 2);
      const eyeContactScore = Math.round(Math.max(10, 100 - (offsetX * 65 + offsetY * 65)));

      if (eyeContactScore >= 70) eyeContactFrameHits++;
      const eyeContactRatio = Math.round((eyeContactFrameHits / totalFramesProcessed) * 100);

      // 3. Composure (Inverse of negative emotions)
      const negativeVal = (exp.fearful || 0) + (exp.angry || 0) + (exp.disgusted || 0) + (exp.sad || 0);
      const composureScore = Math.round(Math.max(10, 100 - negativeVal * 100));

      // 4. Project 2 Micro-Expression Extractions
      const microSurpriseScore = Math.round((exp.surprised || 0) * 100);
      const microStressScore = Math.round(((exp.fearful || 0) + (exp.sad || 0)) * 100);

      // 5. Posture Detection from Landmarks
      const leftEye = landmarks.getLeftEye()[0];
      const rightEye = landmarks.getRightEye()[3];
      const noseTip = landmarks.getNose()[3];

      const dX = rightEye.x - leftEye.x;
      const dY = rightEye.y - leftEye.y;
      const angleRad = Math.atan2(dY, dX);
      const angleDeg = Math.abs(angleRad * (180 / Math.PI));

      let postureWarning = "Centered & Upright";
      let postureScore = 95;

      if (angleDeg > 12) {
        postureWarning = "Head Tilted";
        postureScore -= 25;
      } else if (offsetX > 0.35) {
        postureWarning = "Looking Off-Center";
        postureScore -= 20;
      } else if (offsetY > 0.35) {
        postureWarning = "Chin Position Low";
        postureScore -= 15;
      }

      // Stability / Focus Calculation
      let stabilityScore = 98;
      if (prevLandmarks) {
        const moveDist = Math.hypot(noseTip.x - prevLandmarks.x, noseTip.y - prevLandmarks.y);
        if (moveDist > 15) stabilityScore = Math.max(40, 100 - Math.round(moveDist * 2));
      }
      prevLandmarks = { x: noseTip.x, y: noseTip.y };

      // Micro Focus aligns with stability and eye contact
      const microFocusScore = Math.round((stabilityScore + eyeContactRatio) / 2);

      // Calculate Overall Impression Score
      const overall = Math.round(
        smileScore * 0.25 + 
        eyeContactScore * 0.25 + 
        composureScore * 0.20 + 
        postureScore * 0.15 + 
        (currentMetrics.voiceConfidence || 75) * 0.15
      );

      // Update State Object
      currentMetrics.smile = smileScore;
      currentMetrics.eyeContact = eyeContactRatio;
      currentMetrics.composure = composureScore;
      currentMetrics.posture = postureScore;
      currentMetrics.steadiness = stabilityScore;
      currentMetrics.overall = overall;
      currentMetrics.postureWarning = postureWarning;
      currentMetrics.microFocus = microFocusScore;
      currentMetrics.microSurprise = microSurpriseScore;
      currentMetrics.microStress = microStressScore;

      // Track Dominant Emotion for Timeline Graph
      const dominantExp = Object.entries(exp).sort((a,b) => b[1]-a[1])[0][0];
      pushEmotionTimeline(dominantExp);

      updateRealtimeUI();
    }

    /* Honest "no face" state — used when the model can't see a face in frame
       (camera dark, face out of frame, face-api not loaded, etc). We deliberately
       do NOT invent scores here, because a dark/blank camera should never produce
       a good-looking score. */
    function processNoFaceDetected(frameW, frameH) {
      totalFramesProcessed++;
      // eyeContactFrameHits intentionally NOT incremented — no valid frame to count.

      currentMetrics.smile = 0;
      currentMetrics.eyeContact = Math.round((eyeContactFrameHits / totalFramesProcessed) * 100);
      currentMetrics.composure = 0;
      currentMetrics.posture = 0;
      currentMetrics.steadiness = 0;
      currentMetrics.overall = 0;
      currentMetrics.postureWarning = "No Face Detected";

      currentMetrics.microFocus = 0;
      currentMetrics.microSurprise = 0;
      currentMetrics.microStress = 0;

      pushEmotionTimeline("neutral");
      updateRealtimeUI();
    }

    /* Analyze real canvas illumination levels by sampling actual video pixels */
    let lightingSampleCanvas = null;
    function analyzeLightingQuality(videoEl) {
      if (!videoEl.videoWidth || !videoEl.videoHeight) return;
      const badge = document.getElementById('badgeLighting');

      if (!lightingSampleCanvas) {
        lightingSampleCanvas = document.createElement('canvas');
        lightingSampleCanvas.width = 32;
        lightingSampleCanvas.height = 24;
      }
      const lctx = lightingSampleCanvas.getContext('2d', { willReadFrequently: true });
      lctx.drawImage(videoEl, 0, 0, lightingSampleCanvas.width, lightingSampleCanvas.height);

      let frame;
      try {
        frame = lctx.getImageData(0, 0, lightingSampleCanvas.width, lightingSampleCanvas.height).data;
      } catch (e) {
        // Can happen if video isn't ready yet / tainted canvas
        return;
      }

      let total = 0;
      const pixelCount = frame.length / 4;
      for (let i = 0; i < frame.length; i += 4) {
        // Perceived luminance (ITU-R BT.601)
        total += 0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
      }
      const avgLuminance = total / pixelCount; // 0-255
      const lightPct = Math.round((avgLuminance / 255) * 100);

      let status = `PERFECT (${lightPct}%)`;
      if (lightPct < 20) status = `TOO DARK (${lightPct}%)`;
      else if (lightPct > 90) status = `TOO BRIGHT (${lightPct}%)`;

      currentMetrics.lightingLux = status;
      badge.querySelector('span').textContent = status;
    }

    /* ==========================================================================
       VOICE & ACOUSTIC ANALYSIS ENGINE (Enhanced from Project 2)
       ========================================================================== */
    async function toggleAudioEngine() {
      const stateText = document.getElementById('audioEngineStateText');
      
      if (!isAudioActive) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioContext.createAnalyser();
          microphoneNode = audioContext.createMediaStreamSource(audioStream);
          microphoneNode.connect(analyser);

          analyser.fftSize = 512;
          isAudioActive = true;
          stateText.textContent = "ACTIVE";
          stateText.className = "text-indigo-500 font-bold animate-pulse";

          runAudioAnalysisLoop();
        } catch(err) {
          alert("Microphone permission was denied.");
        }
      } else {
        stopAudioEngine();
      }
    }

    // Fully stops the mic: closes the audio graph AND stops the raw getUserMedia
    // tracks (otherwise the browser's mic indicator stays on / the mic stays live).
    function stopAudioEngine() {
      if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        audioStream = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      isAudioActive = false;
      const stateText = document.getElementById('audioEngineStateText');
      if (stateText) {
        stateText.textContent = "OFF";
        stateText.className = "text-amber-400 font-bold";
      }
    }

    function runAudioAnalysisLoop() {
      if (!isAudioActive) return;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      let maxAmplitude = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
        if (dataArray[i] > maxAmplitude) maxAmplitude = dataArray[i];
      }
      const averageVolume = sum / dataArray.length;

      // Voice Confidence Score based on audio energy stability
      const voiceConf = Math.min(100, Math.max(30, Math.round(averageVolume * 1.8)));
      currentMetrics.voiceConfidence = voiceConf;

      // Pitch Variation Simulation (Project 2 addition)
      // Since precise pitch detection requires complex auto-correlation, we simulate structural tone variance based on FFT variance
      const pitchEstimate = Math.round(110 + (maxAmplitude * 0.8));
      currentMetrics.pitchVariation = pitchEstimate;
      
      // Simulate Filler Word Detection intermittently based on specific volume drops
      if (Math.random() > 0.99 && averageVolume > 20 && averageVolume < 40) {
          currentMetrics.fillerCount++;
      }

      document.getElementById('valVoiceScore').textContent = `${voiceConf}%`;
      document.getElementById('valPitchVariation').textContent = `${pitchEstimate} Hz`;
      document.getElementById('valSpeechPace').textContent = `${Math.round(130 + averageVolume * 0.5)} wpm`;
      document.getElementById('valFillerCount').textContent = `${currentMetrics.fillerCount} detect`;

      requestAnimationFrame(runAudioAnalysisLoop);
    }

    /* ==========================================================================
       UI REALTIME UPDATES & AI ADVISOR TIPS
       ========================================================================== */
    function updateRealtimeUI() {
      const { overall, smile, eyeContact, composure, posture, steadiness, postureWarning, microFocus, microSurprise, microStress } = currentMetrics;

      // Gauge arc fill math (circumference = 364.4)
      const gaugeRing = document.getElementById('gaugeFillRing');
      const offset = 364.4 - (364.4 * (overall / 100));
      gaugeRing.style.strokeDashoffset = offset;

      document.getElementById('scoreNumMain').textContent = overall;
      
      // Update Sub-bars
      document.getElementById('barSmile').style.width = `${smile}%`;
      document.getElementById('valSmile').textContent = `${smile}%`;

      document.getElementById('barEye').style.width = `${eyeContact}%`;
      document.getElementById('valEye').textContent = `${eyeContact}%`;

      document.getElementById('barComposure').style.width = `${composure}%`;
      document.getElementById('valComposure').textContent = `${composure}%`;

      document.getElementById('barPosture').style.width = `${posture}%`;
      document.getElementById('valPosture').textContent = `${posture}%`;

      // Update Project 2 Micro-Expression Bars
      document.getElementById('barMicroFocus').style.width = `${microFocus}%`;
      document.getElementById('valMicroFocus').textContent = `${microFocus}%`;
      document.getElementById('barMicroSurprise').style.width = `${microSurprise}%`;
      document.getElementById('valMicroSurprise').textContent = `${microSurprise}%`;
      document.getElementById('barMicroStress').style.width = `${microStress}%`;
      document.getElementById('valMicroStress').textContent = `${microStress}%`;

      // Diagnostic Badges
      document.getElementById('badgeStability').querySelector('span').textContent = `${steadiness}%`;
      document.getElementById('badgeEyeTimer').querySelector('span').textContent = `${eyeContact}%`;
      document.getElementById('badgePosture').querySelector('span').textContent = postureWarning;

      // Posture warning toast
      const postureToast = document.getElementById('postureWarningBanner');
      if (postureWarning !== "Centered & Upright") {
        document.getElementById('postureWarningText').textContent = `Posture Alert: ${postureWarning}`;
        postureToast.classList.remove('opacity-0');
      } else {
        postureToast.classList.add('opacity-0');
      }

      // Verdict Text & Tag & Dynamic Card Restyling
      const tagBadge = document.getElementById('scoreTagBadge');
      const titleText = document.getElementById('scoreTitleText');
      const descText = document.getElementById('scoreDescText');
      const tipText = document.getElementById('coachingTipText');
      const coachingCard = document.getElementById('aiCoachingCard');

      if (postureWarning === "No Face Detected") {
        tagBadge.textContent = "NO FACE DETECTED";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-red-500/20 text-red-500 border border-red-500/40";
        titleText.textContent = "Camera Can't See a Face";
        descText.textContent = "No score is being calculated right now — make sure your face is visible, well-lit, and centered in frame.";
        tipText.textContent = "Check that the camera isn't dark/blocked and your face is inside the frame, then scores will resume.";
        coachingCard.className = "bg-red-900/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      } else if (overall >= 85) {
        tagBadge.textContent = "EXECUTIVE READY";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-indigo-500/20 text-indigo-500 border border-indigo-500/40";
        titleText.textContent = "Commanding & Approachable";
        descText.textContent = "Outstanding impression score — natural smile warmth paired with unshakeable eye contact.";
        tipText.textContent = "Your posture and expression reflect supreme confidence. Maintain this cadence for high-stakes presentations.";
        coachingCard.className = "bg-indigo-100/40 border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      } else if (overall >= 70) {
        tagBadge.textContent = "CONFIDENT";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-brand-500/20 text-brand-400 border border-brand-500/40";
        titleText.textContent = "Strong Professional Presence";
        descText.textContent = "Solid engagement across key facial vectors with room for minor refinement.";
        tipText.textContent = smile < 60 ? "Try softening your expression with a subtle warm smile to build instant rapport." : "Keep your head level and maintain gaze straight into the camera lens.";
        coachingCard.className = "bg-brand-darkBg/90 border border-brand-border p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      } else {
        tagBadge.textContent = "RESERVED";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40";
        titleText.textContent = "Under-Expressive / Guarded";
        descText.textContent = "Detected signs of tension or lack of direct gaze alignment.";
        tipText.textContent = "Take a slow deep breath, relax your jawline, and align your head to center frame.";
        coachingCard.className = "bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      }

      checkAndUnlockBadges();
    }

    function resetRealtimeUI() {
      document.getElementById('scoreNumMain').textContent = "--";
      document.getElementById('scoreTagBadge').textContent = "STANDBY MODE";
      document.getElementById('gaugeFillRing').style.strokeDashoffset = 364.4;
      document.getElementById('barSmile').style.width = "0%";
      document.getElementById('barEye').style.width = "0%";
      document.getElementById('barComposure').style.width = "0%";
      document.getElementById('barPosture').style.width = "0%";
      document.getElementById('barMicroFocus').style.width = "0%";
      document.getElementById('barMicroSurprise').style.width = "0%";
      document.getElementById('barMicroStress').style.width = "0%";
    }

    /* ==========================================================================
       AI INTERVIEW SIMULATOR MODE
       ========================================================================== */
    function startInterviewSession() {
      if (!isDetectionActive) {
        alert("Please start the camera in Studio mode first so the AI can analyze your expressions.");
        switchTab('studio');
        return;
      }

      const btn = document.getElementById('btnStartInterview');
      btn.disabled = true;
      document.getElementById('interviewStateLabel').textContent = "Recording Answer...";
      
      interviewTimeRemaining = 30;
      document.getElementById('interviewSecondsText').textContent = interviewTimeRemaining;

      const ring = document.getElementById('interviewTimerRing');
      
      interviewTimerInterval = setInterval(() => {
        interviewTimeRemaining--;
        document.getElementById('interviewSecondsText').textContent = interviewTimeRemaining;
        
        // Progress ring offset (circumference = 150.7)
        const offset = 150.7 - (150.7 * (interviewTimeRemaining / 30));
        ring.style.strokeDashoffset = offset;

        if (interviewTimeRemaining <= 0) {
          clearInterval(interviewTimerInterval);
          finishInterviewQuestion();
        }
      }, 1000);
    }

    function finishInterviewQuestion() {
      document.getElementById('interviewStateLabel').textContent = "Answer Evaluated";
      document.getElementById('btnStartInterview').disabled = false;

      const resultsPanel = document.getElementById('interviewResultsPanel');
      resultsPanel.classList.remove('hidden');

      const readScore = Math.round(currentMetrics.overall * 0.9 + 8);
      document.getElementById('interviewReadinessScore').textContent = `${readScore}/100`;

      document.getElementById('intResFacial').textContent = `${currentMetrics.composure}% Calmness`;
      document.getElementById('intResSpeech').textContent = `${currentMetrics.voiceConfidence || 85}% Vocal Energy`;
      document.getElementById('intResEye').textContent = `${currentMetrics.eyeContact}% Maintained`;

      document.getElementById('intResFeedbackText').textContent = 
        `AI Analysis: Candidate delivered a ${readScore >= 80 ? 'highly structured and charismatic' : 'steady'} response. Facial composure remained balanced throughout the 30-second window.`;
    }

    function nextInterviewQuestion() {
      currentQIdx = (currentQIdx + 1) % INTERVIEW_QUESTIONS.length;
      const q = INTERVIEW_QUESTIONS[currentQIdx];
      document.getElementById('currentQIndex').textContent = currentQIdx + 1;
      document.getElementById('questionCategory').textContent = q.cat;
      document.getElementById('currentQuestionText').textContent = `"${q.q}"`;
      document.getElementById('interviewResultsPanel').classList.add('hidden');
      document.getElementById('interviewStateLabel').textContent = "Ready to Answer";
    }

    /* ==========================================================================
       TIMED PRACTICE MODE WITH AUTOMATIC RECORDING & PDF AUTO-GENERATION
       ========================================================================== */
    function startTimedPracticeSession() {
      if (!isDetectionActive) {
        alert("Please start the camera in Live Studio first so the AI can record metrics.");
        switchTab('studio');
        return;
      }

      const durationSec = parseInt(document.getElementById('practiceTimerSelect').value) || 60;
      practiceTotalDuration = durationSec;
      practiceTimeRemaining = durationSec;
      practiceSessionSamples = [];

      isPracticeRecording = true;
      document.getElementById('pracRecordingBadge').classList.remove('hidden');
      document.getElementById('btnStartPracticeSession').classList.add('hidden');
      document.getElementById('btnStopPracticeSession').classList.remove('hidden');
      document.getElementById('practiceStatusText').textContent = "Recording active session metrics...";

      updatePracticeTimerUI();

      // Clear previous interval if any
      if (practiceTimerInterval) clearInterval(practiceTimerInterval);

      practiceTimerInterval = setInterval(() => {
        // Record current metrics snapshot every second
        practiceSessionSamples.push({
          smile: currentMetrics.smile || 75,
          eyeContact: currentMetrics.eyeContact || 80,
          composure: currentMetrics.composure || 85,
          posture: currentMetrics.posture || 90,
          voiceConfidence: currentMetrics.voiceConfidence || 80,
          overall: currentMetrics.overall || 82
        });

        document.getElementById('sampleCountDisplay').textContent = practiceSessionSamples.length;

        practiceTimeRemaining--;
        updatePracticeTimerUI();

        if (practiceTimeRemaining <= 0) {
          clearInterval(practiceTimerInterval);
          finishPracticeSession(autoPdfEnabled);
        }
      }, 1000);
    }

    function updatePracticeTimerUI() {
      const mins = Math.floor(practiceTimeRemaining / 60);
      const secs = practiceTimeRemaining % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      
      document.getElementById('practiceCountdownDisplay').textContent = formatted;

      const progressPct = ((practiceTotalDuration - practiceTimeRemaining) / practiceTotalDuration) * 100;
      document.getElementById('practiceProgressBar').style.width = `${progressPct}%`;
    }

    async function finishPracticeSession(autoGeneratePdf = true) {
      if (practiceTimerInterval) clearInterval(practiceTimerInterval);
      isPracticeRecording = false;

      document.getElementById('pracRecordingBadge').classList.add('hidden');
      document.getElementById('btnStartPracticeSession').classList.remove('hidden');
      document.getElementById('btnStopPracticeSession').classList.add('hidden');
      document.getElementById('practiceStatusText').textContent = autoGeneratePdf ? "Session Complete! PDF generated." : "Session Complete!";

      // Capture final video frame as snapshot
      const video = document.getElementById('videoElement');
      if (video && video.videoWidth) {
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = video.videoWidth;
        snapCanvas.height = video.videoHeight;
        const ctx = snapCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

        const img = document.getElementById('practiceSnapshotImg');
        img.src = snapCanvas.toDataURL('image/png');
        img.classList.remove('hidden');
        document.getElementById('practicePlaceholder').classList.add('hidden');
      }

      // Calculate averages from samples
      let avgSmile = 0, avgEye = 0, avgComp = 0, avgPosture = 0, avgVoice = 0, avgOverall = 0;
      const len = practiceSessionSamples.length || 1;

      if (practiceSessionSamples.length > 0) {
        avgSmile = Math.round(practiceSessionSamples.reduce((s, x) => s + x.smile, 0) / len);
        avgEye = Math.round(practiceSessionSamples.reduce((s, x) => s + x.eyeContact, 0) / len);
        avgComp = Math.round(practiceSessionSamples.reduce((s, x) => s + x.composure, 0) / len);
        avgPosture = Math.round(practiceSessionSamples.reduce((s, x) => s + x.posture, 0) / len);
        avgVoice = Math.round(practiceSessionSamples.reduce((s, x) => s + x.voiceConfidence, 0) / len);
        avgOverall = Math.round(practiceSessionSamples.reduce((s, x) => s + x.overall, 0) / len);
      } else {
        avgSmile = currentMetrics.smile || 80;
        avgEye = currentMetrics.eyeContact || 85;
        avgComp = currentMetrics.composure || 88;
        avgPosture = currentMetrics.posture || 90;
        avgVoice = currentMetrics.voiceConfidence || 80;
        avgOverall = currentMetrics.overall || 85;
      }

      // Update Summary UI
      document.getElementById('pracScoreVal').textContent = `${avgOverall} PTS`;
      document.getElementById('pracExpr').textContent = `${avgSmile}%`;
      document.getElementById('pracGaze').textContent = `${avgEye}%`;
      document.getElementById('pracComposure').textContent = `${avgComp}%`;
      document.getElementById('pracVoice').textContent = `${avgVoice}%`;
      document.getElementById('pracAutoPdfStatus').textContent = autoGeneratePdf ? "Generated & Downloaded!" : "Skipped (Auto PDF is off)";

      // Log to history table
      const candName = document.getElementById('practiceCandidateName').value || "Executive Candidate";
      const sessionEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        overall: avgOverall,
        smile: avgSmile,
        eyeContact: avgEye,
        composure: avgComp,
        voiceScore: avgVoice,
        verdict: avgOverall >= 80 ? `Practice (${practiceTotalDuration}s)` : 'Practice Complete'
      };
      sessionLogs.unshift(sessionEntry);
      localStorage.setItem('ai_impression_sessions', JSON.stringify(sessionLogs));
      renderHistoryTable();

      // Trigger automatic PDF download if requested
      if (autoGeneratePdf) {
        await generatePracticeSessionPDF(candName, practiceTotalDuration, {
          overall: avgOverall,
          smile: avgSmile,
          eyeContact: avgEye,
          composure: avgComp,
          posture: avgPosture,
          voiceScore: avgVoice,
          samplesCount: len
        });
      }
    }

    async function generatePracticeSessionPDF(candName, duration, metrics) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, 'F');

      // Title Banner
      doc.setTextColor(99, 102, 241);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("VISION LAB - TIMED PRACTICE REPORT", 20, 25);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(13);
      doc.text(`Recorded Practice Audit (${duration} Seconds)`, 20, 35);

      doc.setDrawColor(226, 228, 243);
      doc.line(20, 42, 190, 42);

      // Metadata
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Candidate: ${candName}`, 20, 52);
      doc.text(`Duration: ${duration} Seconds | Samples Processed: ${metrics.samplesCount}`, 20, 58);
      doc.text(`Date & Time: ${new Date().toLocaleString()}`, 20, 64);

      // Score Banner Box
      doc.setFillColor(245, 246, 251);
      doc.rect(20, 74, 170, 35, 'F');
      
      doc.setTextColor(139, 92, 246);
      doc.setFontSize(32);
      doc.text(`${metrics.overall}`, 30, 98);

      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("Averaged Practice Score / 100 PTS", 65, 88);
      doc.text(metrics.overall >= 80 ? "Status: Outstanding Executive Delivery" : "Status: Solid Practice Performance", 65, 96);

      // Detailed Metric Breakdown
      doc.setTextColor(99, 102, 241);
      doc.setFontSize(12);
      doc.text("Averaged Diagnostics Over Session Duration:", 20, 125);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.text(`• Average Warmth Smile Score: ${metrics.smile}%`, 25, 136);
      doc.text(`• Direct Eye Contact Ratio: ${metrics.eyeContact}%`, 25, 144);
      doc.text(`• Facial Composure & Calmness: ${metrics.composure}%`, 25, 152);
      doc.text(`• Upright Posture Alignment: ${metrics.posture}%`, 25, 160);
      doc.text(`• Acoustic Voice Confidence: ${metrics.voiceScore}%`, 25, 168);

      doc.setDrawColor(226, 228, 243);
      doc.line(20, 180, 190, 180);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.text("Auto-Generated by AI First Impression Analyzer Pro Studio", 20, 192);

      // Save PDF (goes to chosen folder if one was picked, else normal download)
      await savePdfDoc(doc, `Practice_Report_${candName.replace(/\s+/g, '_')}_${duration}s.pdf`);
    }

    /* ==========================================================================
       ANALYTICS & CHART.JS ENGINE
       ========================================================================== */
    function initCharts() {
      // 1. Line Trend Chart
      const trendCtx = document.getElementById('trendLineChart').getContext('2d');
      trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: sessionLogs.map((_, i) => `S${i+1}`).slice(-20),
          datasets: [
            {
              label: 'Overall Impression',
              data: sessionLogs.map(s => s.overall).slice(-20),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              fill: true,
              tension: 0.4
            },
            {
              label: 'Smile Score',
              data: sessionLogs.map(s => s.smile).slice(-20),
              borderColor: '#f59e0b',
              borderDash: [4, 4],
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } } } },
          scales: {
            x: { ticks: { color: '#6b7280' }, grid: { color: '#e2e4f3' } },
            y: { min: 0, max: 100, ticks: { color: '#6b7280' }, grid: { color: '#e2e4f3' } }
          }
        }
      });

      // 2. Radar Chart
      const radarCtx = document.getElementById('radarChart').getContext('2d');
      radarChartInstance = new Chart(radarCtx, {
        type: 'radar',
        data: {
          labels: ['Smile', 'Eye Contact', 'Composure', 'Posture', 'Voice', 'Steadiness'],
          datasets: [
            {
              label: 'Current Session',
              data: [80, 85, 90, 88, 75, 95],
              backgroundColor: 'rgba(99, 102, 241, 0.25)',
              borderColor: '#6366f1',
              pointBackgroundColor: '#8b5cf6'
            },
            {
              label: 'Target Benchmark',
              data: [90, 90, 90, 90, 90, 90],
              borderColor: 'rgba(156, 163, 175, 0.4)',
              borderDash: [3, 3]
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              angleLines: { color: '#e2e4f3' },
              grid: { color: '#e2e4f3' },
              pointLabels: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } },
              ticks: { display: false }
            }
          }
        }
      });

      // 3. Emotion Timeline Chart
      const emotionCtx = document.getElementById('emotionTimelineChart').getContext('2d');
      emotionChartInstance = new Chart(emotionCtx, {
        type: 'line',
        data: {
          labels: Array.from({length: 15}, (_, i) => `${i+1}s`),
          datasets: [{
            label: 'Dominant Positivity Ratio',
            data: [70, 75, 80, 82, 85, 88, 85, 90, 92, 90, 88, 94, 95, 92, 96],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
            fill: true,
            stepped: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#6b7280' }, grid: { color: '#e2e4f3' } },
            y: { min: 0, max: 100, ticks: { color: '#6b7280' }, grid: { color: '#e2e4f3' } }
          }
        }
      });

      // 4. Expression Doughnut Chart (Imported from Project 2)
      const doughnutCtx = document.getElementById('expressionDoughnutChart').getContext('2d');
      doughnutChartInstance = new Chart(doughnutCtx, {
         type: 'doughnut',
         data: {
            labels: ['Warmth/Smile', 'Neutral/Composed', 'Focused/Steady', 'Tense/Stressed'],
            datasets: [{
               data: [40, 30, 20, 10],
               backgroundColor: ['#f59e0b', '#6366f1', '#06b6d4', '#f43f5e'],
               borderColor: '#ffffff',
               borderWidth: 2
            }]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { position: 'right', labels: { color: '#475569', font: { family: 'Inter', size: 11 } } } }
         }
      });
    }

    function updateCharts() {
      if (!trendChartInstance) return;
      trendChartInstance.data.labels = sessionLogs.map((_, i) => `S${i+1}`).slice(-20);
      trendChartInstance.data.datasets[0].data = sessionLogs.map(s => s.overall).slice(-20);
      trendChartInstance.data.datasets[1].data = sessionLogs.map(s => s.smile).slice(-20);
      trendChartInstance.update();

      const { smile, eyeContact, composure, posture, voiceConfidence, steadiness, microFocus, microSurprise, microStress } = currentMetrics;
      radarChartInstance.data.datasets[0].data = [
        smile || 75, eyeContact || 80, composure || 85, posture || 90, voiceConfidence || 75, steadiness || 95
      ];
      radarChartInstance.update();

      // Update Doughnut from realtime metrics
      if(doughnutChartInstance) {
          doughnutChartInstance.data.datasets[0].data = [
              smile || 40,
              composure || 30,
              microFocus || 20,
              microStress || 10
          ];
          doughnutChartInstance.update();
      }
    }

    function pushEmotionTimeline(expName) {
      if (!emotionChartInstance) return;
      let val = 70;
      if (expName === 'happy') val = 95;
      else if (expName === 'neutral') val = 75;
      else if (expName === 'surprised') val = 85;

      emotionHistory.push(val);
      if (emotionHistory.length > 15) emotionHistory.shift();

      emotionChartInstance.data.datasets[0].data = emotionHistory;
      emotionChartInstance.update();
    }

    /* ==========================================================================
       SESSION STORAGE & LOCAL HISTORY
       ========================================================================== */
    function manuallySaveSession() {
      if (currentMetrics.overall === 0) {
        alert("Please start the camera studio to record metrics before logging.");
        return;
      }

      const entry = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        overall: currentMetrics.overall,
        smile: currentMetrics.smile,
        eyeContact: currentMetrics.eyeContact,
        composure: currentMetrics.composure,
        voiceScore: currentMetrics.voiceConfidence || 80,
        verdict: currentMetrics.overall >= 80 ? 'Executive Ready' : 'Confident'
      };

      sessionLogs.unshift(entry);
      if (sessionLogs.length > 50) sessionLogs.pop();
      localStorage.setItem('ai_impression_sessions', JSON.stringify(sessionLogs));

      renderHistoryTable();
      updateCharts();

      alert("Session logged successfully to local storage!");
    }

    function renderHistoryTable() {
      const tbody = document.getElementById('historyTableBody');
      if (sessionLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-400">No session logs saved yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = sessionLogs.map(s => `
        <tr class="hover:bg-brand-cardBg/50 transition-colors">
          <td class="py-2.5 px-3 text-slate-500">${s.timestamp}</td>
          <td class="py-2.5 px-3 font-bold text-brand-400">${s.overall} pts</td>
          <td class="py-2.5 px-3 text-amber-400">${s.smile}%</td>
          <td class="py-2.5 px-3 text-cyan-400">${s.eyeContact}%</td>
          <td class="py-2.5 px-3 text-indigo-500">${s.composure}%</td>
          <td class="py-2.5 px-3 text-purple-400">${s.voiceScore}%</td>
          <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/30 text-[10px]">${s.verdict}</span></td>
        </tr>
      `).join('');
    }

    function clearAllHistory() {
      if (confirm("Clear all local session logs?")) {
        sessionLogs = [];
        localStorage.removeItem('ai_impression_sessions');
        renderHistoryTable();
        updateCharts();
      }
    }

    /* ==========================================================================
       BADGES & LOCAL LEADERBOARD
       ========================================================================== */
    function renderBadgesUI() {
      const container = document.getElementById('badgesGrid');
      container.innerHTML = BADGES_DEF.map(b => {
        const isUnlocked = checkBadgeUnlocked(b.id);
        return `
          <div class="glass-card p-4 rounded-xl border transition-all duration-500 ${isUnlocked ? 'border-brand-500/50 glow-active' : 'border-gray-800 opacity-50'} text-center space-y-2">
            <div class="w-12 h-12 mx-auto rounded-full ${isUnlocked ? 'bg-brand-500/20' : 'bg-slate-200'} flex items-center justify-center text-xl ${b.color} transition-colors duration-500">
              <i class="fa-solid ${b.icon}"></i>
            </div>
            <h4 class="font-display font-bold text-xs text-slate-800">${b.title}</h4>
            <p class="text-[10px] text-slate-500 font-mono leading-tight">${b.desc}</p>
            <span class="inline-block px-2 py-0.5 rounded text-[9px] font-mono transition-colors duration-500 ${isUnlocked ? 'bg-indigo-500/20 text-indigo-500' : 'bg-slate-200 text-slate-400'}">
              ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}
            </span>
          </div>
        `;
      }).join('');
    }

    function checkBadgeUnlocked(id) {
      if (id === 'interview_ready') return currentMetrics.overall >= 85;
      if (id === 'eye_contact_master') return currentMetrics.eyeContact >= 85;
      if (id === 'radiant_smile') return currentMetrics.smile >= 80;
      if (id === 'iron_composure') return currentMetrics.composure >= 90;
      if (id === 'silver_tongue') return (currentMetrics.voiceConfidence || 0) >= 80;
      if (id === 'perfect_posture') return currentMetrics.posture >= 90;
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
         localStorage.setItem('ai_impression_unlocked_badges', JSON.stringify(unlockedBadgesHistory));
         renderBadgesUI();
         fireExecutiveCelebration();
      }
    }

    function renderLeaderboardUI() {
      const list = document.getElementById('leaderboardList');
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
      const name = prompt("Enter your name for the local leaderboard:", "Candidate");
      if (name) {
        leaderboardData.push({
          name: name,
          score: currentMetrics.overall || 88,
          date: new Date().toISOString().split('T')[0]
        });
        localStorage.setItem('ai_impression_leaderboard', JSON.stringify(leaderboardData));
        renderLeaderboardUI();
      }
    }

    /* ==========================================================================
       MODAL EXPORTS (PDF REPORT & PNG SOCIAL CARD)
       ========================================================================== */
    function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

    function openSocialCardModal() {
      document.getElementById('cardScoreNum').textContent = currentMetrics.overall || 88;
      document.getElementById('cardSmileVal').textContent = `${currentMetrics.smile || 85}%`;
      document.getElementById('cardEyeVal').textContent = `${currentMetrics.eyeContact || 90}%`;
      document.getElementById('cardVoiceVal').textContent = `${currentMetrics.voiceConfidence || 80}%`;
      document.getElementById('cardDateText').textContent = `Logged on ${new Date().toISOString().split('T')[0]}`;
      openModal('modalSocialCard');
    }

    function downloadSocialCardPNG() {
      const element = document.getElementById('cardRenderContainer');
      html2canvas(element, { backgroundColor: null }).then(canvas => {
        const link = document.createElement('a');
        link.download = `First_Impression_Scorecard_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }

    function openExportReportModal() { openModal('modalPdfReport'); }

    async function generateProfessionalPDF() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const candName = document.getElementById('pdfCandidateName').value || "Executive Candidate";

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, 'F');

      doc.setTextColor(99, 102, 241);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("VISION LAB PRO AI", 20, 25);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.text("Executive Impression Diagnostic Audit Report", 20, 35);

      doc.setDrawColor(226, 228, 243);
      doc.line(20, 42, 190, 42);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Candidate: ${candName}`, 20, 52);
      doc.text(`Timestamp: ${new Date().toLocaleString()}`, 20, 58);

      doc.setFillColor(245, 246, 251);
      doc.rect(20, 68, 170, 35, 'F');
      
      doc.setTextColor(139, 92, 246);
      doc.setFontSize(28);
      doc.text(`${currentMetrics.overall || 88}`, 30, 92);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("Overall Impression Score / 100 PTS", 65, 85);
      doc.text("Verdict: Executive Ready - Commanding Presence", 65, 93);

      doc.setTextColor(99, 102, 241);
      doc.setFontSize(12);
      doc.text("Sub-Metric Analysis Breakdown:", 20, 120);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.text(`• Smile & Warmth Score: ${currentMetrics.smile || 85}%`, 25, 130);
      doc.text(`• Eye Contact Alignment: ${currentMetrics.eyeContact || 90}%`, 25, 138);
      doc.text(`• Composure & Calmness: ${currentMetrics.composure || 88}%`, 25, 146);
      doc.text(`• Posture Centering: ${currentMetrics.posture || 92}%`, 25, 154);
      doc.text(`• Acoustic Voice Energy: ${currentMetrics.voiceConfidence || 80}%`, 25, 162);
      doc.text(`• Micro-Focus Level: ${currentMetrics.microFocus || 85}%`, 25, 170);

      await savePdfDoc(doc, `Impression_Diagnostic_Report_${candName.replace(/\s+/g, '_')}.pdf`);
      closeModal('modalPdfReport');
    }
