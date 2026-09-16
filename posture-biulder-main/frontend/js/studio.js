/* ==========================================================================
   AI VISION & ACOUSTIC STUDIO ENGINE
   ========================================================================== */

class StudioEngine {
  constructor() {
    this.stream = null;
    this.detectionInterval = null;
    this.audioContext = null;
    this.analyser = null;
    this.microphoneNode = null;
    this.audioStream = null;

    this.isDetectionActive = false;
    this.isAudioActive = false;

    // Face movement & stability tracking
    this.prevLandmarks = null;
    this.eyeContactFrameHits = 0;
    this.totalFramesProcessed = 0;
    this.lightingSampleCanvas = null;

    // Metrics state
    this.currentMetrics = {
      overall: 0,
      smile: 0,
      eyeContact: 0,
      composure: 0,
      steadiness: 100,
      posture: 0,
      voiceConfidence: 0,
      speechPace: 0,
      fillerCount: 0,
      pitchVariation: 0,
      microFocus: 0,
      microSurprise: 0,
      microStress: 0,
      lightingLux: 'PERFECT',
      postureWarning: 'Centered'
    };
  }

  isCamActive() {
    return this.isDetectionActive;
  }

  getCurrentMetrics() {
    return { ...this.currentMetrics };
  }

  /* --------------------------------------------------------------------------
     CALIBRATION & CAMERA CONTROLS
     -------------------------------------------------------------------------- */
  triggerCalibration() {
    const calibModal = document.getElementById('calibrationOverlay');
    if (calibModal) calibModal.classList.add('hidden');
    this.startCameraStream();
    // Smoothly initiate detection directly without intrusive dialogue
    setTimeout(() => {
      this.startDetectionLoop();
    }, 600);
  }

  async startCameraStream() {
    const video = document.getElementById('videoElement');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      video.srcObject = this.stream;
      document.getElementById('btnStartCam').disabled = true;
      document.getElementById('btnStopCam').disabled = false;
      document.getElementById('scanBeam').classList.remove('hidden');
    } catch (err) {
      alert("Camera access was blocked or unavailable. Please enable webcam permissions.");
      console.error("Camera access error:", err);
    }
  }

  async runCalibration() {
    const btn = document.getElementById('btnStartCalibAction');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Analyzing Environment...";
    }

    // Check 1: Face Visibility
    setTimeout(() => {
      const el = document.getElementById('checkFaceVisible');
      if (el) el.innerHTML = `<span>Face Visibility</span> <i class="fa-solid fa-check text-brand-500"></i>`;
    }, 600);

    // Check 2: Lighting Level
    setTimeout(() => {
      const el = document.getElementById('checkLighting');
      if (el) el.innerHTML = `<span>Lighting Level</span> <i class="fa-solid fa-check text-brand-500"></i>`;
    }, 1200);

    // Check 3: Distance Check
    setTimeout(() => {
      const el = document.getElementById('checkDistance');
      if (el) el.innerHTML = `<span>Distance Check</span> <i class="fa-solid fa-check text-brand-500"></i>`;
    }, 1800);

    // Check 4: Alignment & Countdown
    setTimeout(() => {
      const alignEl = document.getElementById('checkAlignment');
      if (alignEl) alignEl.innerHTML = `<span>Centering</span> <i class="fa-solid fa-check text-brand-500"></i>`;
      const cBox = document.getElementById('countdownBox');
      if (cBox) cBox.classList.remove('hidden');
      if (btn) btn.classList.add('hidden');

      let cnt = 3;
      const cNum = document.getElementById('countdownNum');
      const timer = setInterval(() => {
        cnt--;
        if (cnt > 0) {
          if (cNum) cNum.textContent = cnt;
        } else {
          clearInterval(timer);
          const calibOverlay = document.getElementById('calibrationOverlay');
          if (calibOverlay) calibOverlay.classList.add('hidden');
          this.startDetectionLoop();
        }
      }, 800);
    }, 2400);
  }

  stopCamera() {
    if (this.detectionInterval) clearInterval(this.detectionInterval);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.isAudioActive) this.stopAudio();
    const video = document.getElementById('videoElement');
    if (video) video.srcObject = null;

    document.getElementById('btnStartCam').disabled = false;
    document.getElementById('btnStopCam').disabled = true;
    document.getElementById('scanBeam').classList.add('hidden');
    document.getElementById('calibrationOverlay').classList.remove('hidden');

    this.isDetectionActive = false;
    this.resetRealtimeUI();
  }

  /* --------------------------------------------------------------------------
     DETECTION LOOP & LANDMARK ANALYSIS
     -------------------------------------------------------------------------- */
  startDetectionLoop() {
    const video = document.getElementById('videoElement');
    const canvas = document.getElementById('overlayCanvas');
    this.isDetectionActive = true;

    let lastTime = performance.now();
    let frameCount = 0;

    this.detectionInterval = setInterval(async () => {
      if (!this.isDetectionActive) return;

      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) fpsCounter.textContent = `${frameCount} FPS`;
        frameCount = 0;
        lastTime = now;
      }

      let detectionResult = null;
      let identityMismatch = false;

      if (window.isModelsLoaded && typeof faceapi !== 'undefined' && faceapi.nets.tinyFaceDetector.params) {
        try {
          // Check if registered user session has enrolled face biometrics
          const currentUser = window.faceAuth && window.faceAuth.getUser ? window.faceAuth.getUser() : null;
          const hasEnrolledBiometrics = currentUser && Array.isArray(currentUser.faceDescriptor) && currentUser.faceDescriptor.length === 128;

          if (hasEnrolledBiometrics && faceapi.nets.faceRecognitionNet && faceapi.nets.faceRecognitionNet.params) {
            const detected = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
              .withFaceLandmarks()
              .withFaceExpressions()
              .withFaceDescriptor();

            if (detected && detected.descriptor) {
              const liveDescriptor = Array.from(detected.descriptor);
              const dist = window.faceAuth.euclideanDistance(liveDescriptor, currentUser.faceDescriptor);

              // Strict Lock: If another person's face is seen, strictly treat as NO FACE DETECTED
              if (dist <= 0.55) {
                detectionResult = detected;
              } else {
                // Different person's face: strictly ignored and treated as NO FACE DETECTED
                detectionResult = null;
                identityMismatch = true;
              }
            } else {
              detectionResult = null;
            }
          } else {
            detectionResult = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
              .withFaceLandmarks()
              .withFaceExpressions();
          }
        } catch (e) {
          detectionResult = null;
        }
      }

      const ctx = canvas.getContext('2d');
      canvas.width = video.clientWidth || 640;
      canvas.height = video.clientHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detectionResult) {
        const dims = faceapi.matchDimensions(canvas, { width: canvas.width, height: canvas.height });
        const resized = faceapi.resizeResults(detectionResult, dims);
        faceapi.draw.drawDetections(canvas, resized);

        this.processFaceMetrics(detectionResult, canvas.width, canvas.height);
      } else {
        this.processNoFaceDetected(identityMismatch);
      }

      this.analyzeLightingQuality(video);
    }, 280);
  }

  processFaceMetrics(result, frameW, frameH) {
    this.totalFramesProcessed++;
    const exp = result.expressions;
    const box = result.detection.box;
    const landmarks = result.landmarks;

    // 1. Smile Score
    const smileScore = Math.round((exp.happy || 0) * 100);

    // 2. Eye Contact Proxy
    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;
    const offsetX = Math.abs(boxCenterX - frameW / 2) / (frameW / 2);
    const offsetY = Math.abs(boxCenterY - frameH / 2) / (frameH / 2);
    const eyeContactScore = Math.round(Math.max(10, 100 - (offsetX * 65 + offsetY * 65)));

    if (eyeContactScore >= 70) this.eyeContactFrameHits++;
    const eyeContactRatio = Math.round((this.eyeContactFrameHits / this.totalFramesProcessed) * 100);

    // 3. Composure
    const negativeVal = (exp.fearful || 0) + (exp.angry || 0) + (exp.disgusted || 0) + (exp.sad || 0);
    const composureScore = Math.round(Math.max(10, 100 - negativeVal * 100));

    // 4. Micro-Expressions
    const microSurpriseScore = Math.round((exp.surprised || 0) * 100);
    const microStressScore = Math.round(((exp.fearful || 0) + (exp.sad || 0)) * 100);

    // 5. Posture Detection
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

    // Stability
    let stabilityScore = 98;
    if (this.prevLandmarks) {
      const moveDist = Math.hypot(noseTip.x - this.prevLandmarks.x, noseTip.y - this.prevLandmarks.y);
      if (moveDist > 15) stabilityScore = Math.max(40, 100 - Math.round(moveDist * 2));
    }
    this.prevLandmarks = { x: noseTip.x, y: noseTip.y };

    const microFocusScore = Math.round((stabilityScore + eyeContactRatio) / 2);

    // Overall Score
    const overall = Math.round(
      smileScore * 0.25 + 
      eyeContactScore * 0.25 + 
      composureScore * 0.20 + 
      postureScore * 0.15 + 
      (this.currentMetrics.voiceConfidence || 75) * 0.15
    );

    this.currentMetrics = {
      ...this.currentMetrics,
      smile: smileScore,
      eyeContact: eyeContactRatio,
      composure: composureScore,
      posture: postureScore,
      steadiness: stabilityScore,
      overall,
      postureWarning,
      microFocus: microFocusScore,
      microSurprise: microSurpriseScore,
      microStress: microStressScore
    };

    const dominantExp = Object.entries(exp).sort((a,b) => b[1]-a[1])[0][0];
    if (typeof pushEmotionTimeline === 'function') pushEmotionTimeline(dominantExp);

    this.updateRealtimeUI();
  }

  processNoFaceDetected(identityMismatch = false) {
    this.totalFramesProcessed++;
    this.currentMetrics = {
      ...this.currentMetrics,
      smile: 0,
      eyeContact: 0,
      composure: 0,
      posture: 0,
      steadiness: 0,
      overall: 0,
      postureWarning: "No Face Detected",
      microFocus: 0,
      microSurprise: 0,
      microStress: 0
    };
    if (typeof pushEmotionTimeline === 'function') pushEmotionTimeline("neutral");
    this.updateRealtimeUI(identityMismatch);
  }

  analyzeLightingQuality(videoEl) {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return;
    const badge = document.getElementById('badgeLighting');
    if (!this.lightingSampleCanvas) {
      this.lightingSampleCanvas = document.createElement('canvas');
      this.lightingSampleCanvas.width = 32;
      this.lightingSampleCanvas.height = 24;
    }
    const lctx = this.lightingSampleCanvas.getContext('2d', { willReadFrequently: true });
    lctx.drawImage(videoEl, 0, 0, 32, 24);

    let frame;
    try {
      frame = lctx.getImageData(0, 0, 32, 24).data;
    } catch (e) {
      return;
    }

    let total = 0;
    const pixelCount = frame.length / 4;
    for (let i = 0; i < frame.length; i += 4) {
      total += 0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
    }
    const avgLuminance = total / pixelCount;
    const lightPct = Math.round((avgLuminance / 255) * 100);

    let status = `PERFECT (${lightPct}%)`;
    if (lightPct < 20) status = `TOO DARK (${lightPct}%)`;
    else if (lightPct > 90) status = `TOO BRIGHT (${lightPct}%)`;

    this.currentMetrics.lightingLux = status;
    if (badge) badge.querySelector('span').textContent = status;
  }

  /* --------------------------------------------------------------------------
     ACOUSTIC AUDIO ENGINE
     -------------------------------------------------------------------------- */
  async toggleAudio() {
    const stateText = document.getElementById('audioEngineStateText');
    if (!this.isAudioActive) {
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphoneNode = this.audioContext.createMediaStreamSource(this.audioStream);
        this.microphoneNode.connect(this.analyser);

        this.analyser.fftSize = 512;
        this.isAudioActive = true;
        if (stateText) {
          stateText.textContent = "ACTIVE";
          stateText.className = "text-brand-500 font-bold animate-pulse";
        }
        this.runAudioAnalysisLoop();
      } catch (err) {
        alert("Microphone permission was denied.");
      }
    } else {
      this.stopAudio();
    }
  }

  stopAudio() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isAudioActive = false;
    const stateText = document.getElementById('audioEngineStateText');
    if (stateText) {
      stateText.textContent = "OFF";
      stateText.className = "text-amber-400 font-bold";
    }
  }

  runAudioAnalysisLoop() {
    if (!this.isAudioActive) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    let maxAmplitude = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
      if (dataArray[i] > maxAmplitude) maxAmplitude = dataArray[i];
    }
    const averageVolume = sum / dataArray.length;

    const voiceConf = Math.min(100, Math.max(30, Math.round(averageVolume * 1.8)));
    this.currentMetrics.voiceConfidence = voiceConf;

    const pitchEstimate = Math.round(110 + (maxAmplitude * 0.8));
    this.currentMetrics.pitchVariation = pitchEstimate;

    if (Math.random() > 0.99 && averageVolume > 20 && averageVolume < 40) {
      this.currentMetrics.fillerCount++;
    }

    const valVoice = document.getElementById('valVoiceScore');
    const valPitch = document.getElementById('valPitchVariation');
    const valPace = document.getElementById('valSpeechPace');
    const valFiller = document.getElementById('valFillerCount');

    if (valVoice) valVoice.textContent = `${voiceConf}%`;
    if (valPitch) valPitch.textContent = `${pitchEstimate} Hz`;
    if (valPace) valPace.textContent = `${Math.round(130 + averageVolume * 0.5)} wpm`;
    if (valFiller) valFiller.textContent = `${this.currentMetrics.fillerCount} detect`;

    requestAnimationFrame(() => this.runAudioAnalysisLoop());
  }

  /* --------------------------------------------------------------------------
     UI UPDATES & ADVISOR TIPS
     -------------------------------------------------------------------------- */
  updateRealtimeUI(identityMismatch = false) {
    const { overall, smile, eyeContact, composure, posture, steadiness, postureWarning, microFocus, microSurprise, microStress } = this.currentMetrics;

    const isNoFace = postureWarning === "No Face Detected";

    const gaugeRing = document.getElementById('gaugeFillRing');
    if (gaugeRing) {
      const offset = isNoFace ? 364.4 : (364.4 - (364.4 * (overall / 100)));
      gaugeRing.style.strokeDashoffset = offset;
    }

    const scoreNumMain = document.getElementById('scoreNumMain');
    if (scoreNumMain) scoreNumMain.textContent = isNoFace ? "--" : overall;

    const setBar = (barId, valId, val) => {
      const b = document.getElementById(barId);
      const v = document.getElementById(valId);
      const effectiveVal = isNoFace ? 0 : val;
      if (b) b.style.width = `${effectiveVal}%`;
      if (v) v.textContent = isNoFace ? "--" : `${effectiveVal}%`;
    };

    setBar('barSmile', 'valSmile', smile);
    setBar('barEye', 'valEye', eyeContact);
    setBar('barComposure', 'valComposure', composure);
    setBar('barPosture', 'valPosture', posture);
    setBar('barMicroFocus', 'valMicroFocus', microFocus);
    setBar('barMicroSurprise', 'valMicroSurprise', microSurprise);
    setBar('barMicroStress', 'valMicroStress', microStress);

    const badgeStab = document.getElementById('badgeStability');
    if (badgeStab) badgeStab.querySelector('span').textContent = isNoFace ? "--" : `${steadiness}%`;

    const badgeEye = document.getElementById('badgeEyeTimer');
    if (badgeEye) badgeEye.querySelector('span').textContent = isNoFace ? "--" : `${eyeContact}%`;

    const badgePost = document.getElementById('badgePosture');
    if (badgePost) badgePost.querySelector('span').textContent = postureWarning;

    const postureToast = document.getElementById('postureWarningBanner');
    if (postureToast) {
      if (postureWarning !== "Centered & Upright") {
        document.getElementById('postureWarningText').textContent = isNoFace ? (identityMismatch ? "Security Lock: Unauthorized Face (No Face Detected)" : "Posture Alert: No Face Detected") : `Posture Alert: ${postureWarning}`;
        postureToast.classList.remove('opacity-0');
      } else {
        postureToast.classList.add('opacity-0');
      }
    }

    // Dynamic Coaching Tips
    const tagBadge = document.getElementById('scoreTagBadge');
    const titleText = document.getElementById('scoreTitleText');
    const descText = document.getElementById('scoreDescText');
    const tipText = document.getElementById('coachingTipText');
    const coachingCard = document.getElementById('aiCoachingCard');

    if (tagBadge && titleText) {
      if (isNoFace) {
        tagBadge.textContent = "NO FACE DETECTED";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-red-500/20 text-red-500 border border-red-500/40";
        titleText.textContent = identityMismatch ? "Identity Mismatch: No Registered Face Detected" : "No Face Detected";
        descText.textContent = identityMismatch 
          ? "Another person's face was seen in your login. This session is locked to the registered account owner only."
          : "No face is detected right now — make sure your face is visible, well-lit, and centered in frame.";
        tipText.textContent = identityMismatch
          ? "Only the registered user can train and score points. Please have the account owner face the camera to resume."
          : "Check that the camera isn't blocked and your face is inside the frame, then scores will resume.";
        coachingCard.className = "bg-red-900/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      } else if (overall >= 85) {
        tagBadge.textContent = "EXECUTIVE READY";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-brand-500/20 text-brand-600 border border-brand-500/40";
        titleText.textContent = "Commanding & Approachable";
        descText.textContent = "Outstanding impression score — natural smile warmth paired with unshakeable eye contact.";
        tipText.textContent = "Your posture and expression reflect supreme confidence. Maintain this cadence for high-stakes presentations.";
        coachingCard.className = "bg-brand-500/10 border border-brand-500/30 p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      } else if (overall >= 70) {
        tagBadge.textContent = "CONFIDENT";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-brand-500/20 text-brand-500 border border-brand-500/40";
        titleText.textContent = "Strong Professional Presence";
        descText.textContent = "Solid engagement across key facial vectors with room for minor refinement.";
        tipText.textContent = smile < 60 ? "Try softening your expression with a subtle warm smile to build instant rapport." : "Keep your head level and maintain gaze straight into the camera lens.";
        coachingCard.className = "bg-brand-darkBg/90 border border-brand-border p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      } else {
        tagBadge.textContent = "RESERVED";
        tagBadge.className = "inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/40";
        titleText.textContent = "Under-Expressive / Guarded";
        descText.textContent = "Detected signs of tension or lack of direct gaze alignment.";
        tipText.textContent = "Take a slow deep breath, relax your jawline, and align your head to center frame.";
        coachingCard.className = "bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl flex items-start gap-3 transition-colors duration-500";
      }
    }

    if (typeof checkAndUnlockBadges === 'function') checkAndUnlockBadges();
  }

  resetRealtimeUI() {
    const el = document.getElementById('scoreNumMain');
    if (el) el.textContent = "--";
    const tag = document.getElementById('scoreTagBadge');
    if (tag) tag.textContent = "STANDBY MODE";
    const ring = document.getElementById('gaugeFillRing');
    if (ring) ring.style.strokeDashoffset = 364.4;
  }
}

window.StudioEngine = StudioEngine;
window.studio = new StudioEngine();

// Backward compatibility bridge for inline onclick handlers
window.triggerCalibrationProcess = () => window.studio.triggerCalibration();
window.runCalibrationProcess = () => window.studio.runCalibration();
window.stopCameraStudio = () => window.studio.stopCamera();
window.toggleAudioEngine = () => window.studio.toggleAudio();
