/* ==========================================================================
   ANALYTICS, CHARTS & REPORT EXPORT ENGINE
   ========================================================================== */

let sessionLogs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SESSIONS) || '[]');
let trendChartInstance = null;
let radarChartInstance = null;
let emotionChartInstance = null;
let doughnutChartInstance = null;
let emotionHistory = [];

function logSessionEntry(entry) {
  sessionLogs.unshift(entry);
  if (sessionLogs.length > 50) sessionLogs.pop();
  localStorage.setItem(CONFIG.STORAGE_KEYS.SESSIONS, JSON.stringify(sessionLogs));

  // Sync to backend asynchronously
  try {
    fetch(`${CONFIG.API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(() => {});
  } catch (e) {}

  renderHistoryTable();
  updateCharts();
}

function initCharts() {
  // 1. Line Trend Chart
  const trendCtx = document.getElementById('trendLineChart');
  if (trendCtx) {
    trendChartInstance = new Chart(trendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: sessionLogs.map((_, i) => `S${i+1}`).slice(-20),
        datasets: [
          {
            label: 'Overall Impression',
            data: sessionLogs.map(s => s.overall).slice(-20),
            borderColor: '#b07d52',
            backgroundColor: 'rgba(176, 125, 82, 0.15)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Smile Score',
            data: sessionLogs.map(s => s.smile).slice(-20),
            borderColor: '#c9a07a',
            borderDash: [4, 4],
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#5c3d1e', font: { family: 'JetBrains Mono', size: 10 } } } },
        scales: {
          x: { ticks: { color: '#8c7b6b' }, grid: { color: '#e8d9c8' } },
          y: { min: 0, max: 100, ticks: { color: '#8c7b6b' }, grid: { color: '#e8d9c8' } }
        }
      }
    });
  }

  // 2. Radar Chart
  const radarCtx = document.getElementById('radarChart');
  if (radarCtx) {
    radarChartInstance = new Chart(radarCtx.getContext('2d'), {
      type: 'radar',
      data: {
        labels: ['Smile', 'Eye Contact', 'Composure', 'Posture', 'Voice', 'Steadiness'],
        datasets: [
          {
            label: 'Current Session',
            data: [80, 85, 90, 88, 75, 95],
            backgroundColor: 'rgba(176, 125, 82, 0.25)',
            borderColor: '#b07d52',
            pointBackgroundColor: '#c9a07a'
          },
          {
            label: 'Target Benchmark',
            data: [90, 90, 90, 90, 90, 90],
            borderColor: 'rgba(140, 123, 107, 0.4)',
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
            angleLines: { color: '#e8d9c8' },
            grid: { color: '#e8d9c8' },
            pointLabels: { color: '#5c3d1e', font: { family: 'JetBrains Mono', size: 10 } },
            ticks: { display: false }
          }
        }
      }
    });
  }

  // 3. Emotion Timeline Chart
  const emotionCtx = document.getElementById('emotionTimelineChart');
  if (emotionCtx) {
    emotionChartInstance = new Chart(emotionCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array.from({ length: 15 }, (_, i) => `${i+1}s`),
        datasets: [{
          label: 'Dominant Positivity Ratio',
          data: [70, 75, 80, 82, 85, 88, 85, 90, 92, 90, 88, 94, 95, 92, 96],
          borderColor: '#c9a07a',
          backgroundColor: 'rgba(201, 160, 122, 0.15)',
          fill: true,
          stepped: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8c7b6b' }, grid: { color: '#e8d9c8' } },
          y: { min: 0, max: 100, ticks: { color: '#8c7b6b' }, grid: { color: '#e8d9c8' } }
        }
      }
    });
  }

  // 4. Expression Doughnut Chart
  const doughnutCtx = document.getElementById('expressionDoughnutChart');
  if (doughnutCtx) {
    doughnutChartInstance = new Chart(doughnutCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Warmth/Smile', 'Neutral/Composed', 'Focused/Steady', 'Tense/Stressed'],
        datasets: [{
          data: [40, 30, 20, 10],
          backgroundColor: ['#b07d52', '#c9a07a', '#7c502b', '#c0392b'],
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
}

function updateCharts() {
  if (!trendChartInstance) return;
  trendChartInstance.data.labels = sessionLogs.map((_, i) => `S${i+1}`).slice(-20);
  trendChartInstance.data.datasets[0].data = sessionLogs.map(s => s.overall).slice(-20);
  trendChartInstance.data.datasets[1].data = sessionLogs.map(s => s.smile).slice(-20);
  trendChartInstance.update();

  const metrics = window.studio ? window.studio.getCurrentMetrics() : {};
  const { smile, eyeContact, composure, posture, voiceConfidence, steadiness } = metrics;
  
  if (radarChartInstance) {
    radarChartInstance.data.datasets[0].data = [
      smile || 75, eyeContact || 80, composure || 85, posture || 90, voiceConfidence || 75, steadiness || 95
    ];
    radarChartInstance.update();
  }

  if (doughnutChartInstance) {
    doughnutChartInstance.data.datasets[0].data = [
      smile || 40,
      composure || 30,
      metrics.microFocus || 20,
      metrics.microStress || 10
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

function manuallySaveSession() {
  const current = window.studio ? window.studio.getCurrentMetrics() : { overall: 0 };
  if (current.overall === 0) {
    alert("Please start the camera studio to record metrics before logging.");
    return;
  }

  const entry = {
    id: Date.now(),
    timestamp: new Date().toLocaleString(),
    overall: current.overall,
    smile: current.smile,
    eyeContact: current.eyeContact,
    composure: current.composure,
    voiceScore: current.voiceConfidence || 80,
    verdict: current.overall >= 80 ? 'Executive Ready' : 'Confident'
  };

  logSessionEntry(entry);
  if (window.gamification) {
    window.gamification.recordSession(entry);
  }
  alert("Session logged successfully to history! XP and progression updated.");
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

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
      <td class="py-2.5 px-3 text-brand-500">${s.composure}%</td>
      <td class="py-2.5 px-3 text-purple-400">${s.voiceScore}%</td>
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/30 text-[10px]">${s.verdict}</span></td>
    </tr>
  `).join('');
}

function clearAllHistory() {
  if (confirm("Clear all local session logs?")) {
    sessionLogs = [];
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSIONS);
    renderHistoryTable();
    updateCharts();
  }
}

/* ==========================================================================
   EXPORT MODALS (PDF & PNG)
   ========================================================================== */
function openSocialCardModal() {
  const metrics = window.studio ? window.studio.getCurrentMetrics() : {};
  const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  setEl('cardScoreNum', metrics.overall || 88);
  setEl('cardSmileVal', `${metrics.smile || 85}%`);
  setEl('cardEyeVal', `${metrics.eyeContact || 90}%`);
  setEl('cardVoiceVal', `${metrics.voiceConfidence || 80}%`);
  setEl('cardDateText', `Logged on ${new Date().toISOString().split('T')[0]}`);
  if (typeof openModal === 'function') openModal('modalSocialCard');
}

function downloadSocialCardPNG() {
  const element = document.getElementById('cardRenderContainer');
  if (window.html2canvas && element) {
    html2canvas(element, { backgroundColor: null }).then(canvas => {
      const link = document.createElement('a');
      link.download = `First_Impression_Scorecard_${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  }
}

function openExportReportModal() {
  if (typeof openModal === 'function') openModal('modalPdfReport');
}

async function generateProfessionalPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const candNameInput = document.getElementById('pdfCandidateName');
  const candName = (candNameInput ? candNameInput.value.trim() : '') || (window.faceAuth && window.faceAuth.getUser() ? window.faceAuth.getUser().name : "Executive Candidate");
  const metrics = window.studio ? window.studio.getCurrentMetrics() : {};

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
  doc.text(`${metrics.overall || 88}`, 30, 92);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Overall Impression Score / 100 PTS", 65, 85);
  doc.text("Verdict: Executive Ready - Commanding Presence", 65, 93);

  doc.setTextColor(99, 102, 241);
  doc.setFontSize(12);
  doc.text("Sub-Metric Analysis Breakdown:", 20, 120);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`• Smile & Warmth Score: ${metrics.smile || 85}%`, 25, 130);
  doc.text(`• Eye Contact Alignment: ${metrics.eyeContact || 90}%`, 25, 138);
  doc.text(`• Composure & Calmness: ${metrics.composure || 88}%`, 25, 146);
  doc.text(`• Posture Centering: ${metrics.posture || 92}%`, 25, 154);
  doc.text(`• Acoustic Voice Energy: ${metrics.voiceConfidence || 80}%`, 25, 162);
  doc.text(`• Micro-Focus Level: ${metrics.microFocus || 85}%`, 25, 170);

  if (typeof savePdfDoc === 'function') {
    await savePdfDoc(doc, `Impression_Diagnostic_Report_${candName.replace(/\s+/g, '_')}.pdf`);
  } else {
    doc.save(`Impression_Diagnostic_Report_${candName.replace(/\s+/g, '_')}.pdf`);
  }
  if (typeof closeModal === 'function') closeModal('modalPdfReport');
}

window.initCharts = initCharts;
window.updateCharts = updateCharts;
window.pushEmotionTimeline = pushEmotionTimeline;
window.manuallySaveSession = manuallySaveSession;
window.renderHistoryTable = renderHistoryTable;
window.clearAllHistory = clearAllHistory;
window.openSocialCardModal = openSocialCardModal;
window.downloadSocialCardPNG = downloadSocialCardPNG;
window.openExportReportModal = openExportReportModal;
window.generateProfessionalPDF = generateProfessionalPDF;
window.logSessionEntry = logSessionEntry;
