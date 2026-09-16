/* ==========================================================================
   AI INTERVIEW SIMULATOR ENGINE
   ========================================================================== */

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

function startInterviewSession() {
  if (!window.studio || !window.studio.isCamActive()) {
    alert("Please start the camera in Studio mode first so the AI can analyze your expressions.");
    if (typeof switchTab === 'function') switchTab('studio');
    return;
  }

  const btn = document.getElementById('btnStartInterview');
  if (btn) btn.disabled = true;
  const label = document.getElementById('interviewStateLabel');
  if (label) label.textContent = "Recording Answer...";
  
  interviewTimeRemaining = 30;
  const secsText = document.getElementById('interviewSecondsText');
  if (secsText) secsText.textContent = interviewTimeRemaining;

  const ring = document.getElementById('interviewTimerRing');
  
  if (interviewTimerInterval) clearInterval(interviewTimerInterval);
  interviewTimerInterval = setInterval(() => {
    interviewTimeRemaining--;
    if (secsText) secsText.textContent = interviewTimeRemaining;
    
    // Progress ring offset (circumference = 150.7)
    if (ring) {
      const offset = 150.7 - (150.7 * (interviewTimeRemaining / 30));
      ring.style.strokeDashoffset = offset;
    }

    if (interviewTimeRemaining <= 0) {
      clearInterval(interviewTimerInterval);
      finishInterviewQuestion();
    }
  }, 1000);
}

function finishInterviewQuestion() {
  const label = document.getElementById('interviewStateLabel');
  if (label) label.textContent = "Answer Evaluated";

  const btn = document.getElementById('btnStartInterview');
  if (btn) btn.disabled = false;

  const resultsPanel = document.getElementById('interviewResultsPanel');
  if (resultsPanel) resultsPanel.classList.remove('hidden');

  const metrics = window.studio ? window.studio.getCurrentMetrics() : { overall: 85, composure: 88, voiceConfidence: 82, eyeContact: 85 };
  const readScore = Math.round(metrics.overall * 0.9 + 8);
  
  const scoreEl = document.getElementById('interviewReadinessScore');
  if (scoreEl) scoreEl.textContent = `${readScore}/100`;

  const resFacial = document.getElementById('intResFacial');
  const resSpeech = document.getElementById('intResSpeech');
  const resEye = document.getElementById('intResEye');
  const resFeedback = document.getElementById('intResFeedbackText');

  if (resFacial) resFacial.textContent = `${metrics.composure}% Calmness`;
  if (resSpeech) resSpeech.textContent = `${metrics.voiceConfidence || 85}% Vocal Energy`;
  if (resEye) resEye.textContent = `${metrics.eyeContact}% Maintained`;

  if (resFeedback) {
    resFeedback.textContent = `AI Analysis: Candidate delivered a ${readScore >= 80 ? 'highly structured and charismatic' : 'steady'} response. Facial composure remained balanced throughout the 30-second window.`;
  }
}

function nextInterviewQuestion() {
  currentQIdx = (currentQIdx + 1) % INTERVIEW_QUESTIONS.length;
  const q = INTERVIEW_QUESTIONS[currentQIdx];
  const qIdxEl = document.getElementById('currentQIndex');
  const catEl = document.getElementById('questionCategory');
  const textEl = document.getElementById('currentQuestionText');
  const resultsPanel = document.getElementById('interviewResultsPanel');
  const label = document.getElementById('interviewStateLabel');

  if (qIdxEl) qIdxEl.textContent = currentQIdx + 1;
  if (catEl) catEl.textContent = q.cat;
  if (textEl) textEl.textContent = `"${q.q}"`;
  if (resultsPanel) resultsPanel.classList.add('hidden');
  if (label) label.textContent = "Ready to Answer";
}

window.startInterviewSession = startInterviewSession;
window.nextInterviewQuestion = nextInterviewQuestion;
