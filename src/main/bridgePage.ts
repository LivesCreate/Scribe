/**
 * The phone dictation page served by the LAN bridge. Self-contained single
 * file: record (hold or tap), send to the PC, show clean text, copy/share.
 */
export const PWA_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<meta name="theme-color" content="#0ea5e9">
<title>Scribe — phone dictation</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: system-ui, sans-serif; min-height: 100dvh; display: flex; flex-direction: column;
    align-items: center; padding: 24px 20px; gap: 18px;
    background: #fafafa; color: #18181b;
  }
  @media (prefers-color-scheme: dark) { body { background: #09090b; color: #fafafa; } }
  h1 { font-size: 1.3rem; letter-spacing: -0.02em; }
  p.sub { color: #71717a; font-size: .85rem; text-align: center; }
  #mic {
    margin-top: 4vh; width: 132px; height: 132px; border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; font-size: 3rem;
    box-shadow: 0 8px 30px rgba(14,165,233,.35); transition: transform .15s ease;
    touch-action: none; user-select: none; -webkit-user-select: none;
  }
  #mic.rec { transform: scale(1.12); background: linear-gradient(135deg, #ef4444, #f97316); animation: pulse 1.2s infinite; }
  #mic.busy { background: linear-gradient(135deg, #71717a, #a1a1aa); animation: none; }
  @keyframes pulse { 50% { box-shadow: 0 8px 44px rgba(239,68,68,.55); } }
  #state { font-size: .95rem; font-weight: 500; min-height: 1.4em; }
  #styleRow { display: flex; gap: 8px; }
  #styleRow button {
    border: 1px solid #d4d4d8; background: transparent; color: inherit; border-radius: 999px;
    padding: 6px 14px; font-size: .8rem; cursor: pointer; text-transform: capitalize;
  }
  #styleRow button.on { border-color: #0ea5e9; background: rgba(14,165,233,.12); color: #0284c7; }
  #out {
    width: 100%; max-width: 560px; white-space: pre-wrap; border: 1px solid #e4e4e7;
    border-radius: 14px; padding: 14px; font-size: 1rem; min-height: 90px; background: rgba(255,255,255,.6);
  }
  @media (prefers-color-scheme: dark) { #out { border-color: #27272a; background: rgba(24,24,27,.6); } }
  #actions { display: flex; gap: 10px; }
  #actions button {
    border: none; border-radius: 10px; padding: 10px 18px; font-size: .9rem; font-weight: 600; cursor: pointer;
    background: #0ea5e9; color: white;
  }
  #actions button.ghost { background: transparent; color: #0ea5e9; }
  .notice { font-size: .72rem; color: #a1a1aa; text-align: center; max-width: 420px; }
</style>
</head>
<body>
  <h1>Scribe</h1>
  <p class="sub">Hold the button, speak, release. Your PC does the rest — nothing leaves your Wi-Fi.</p>
  <div id="styleRow"></div>
  <button id="mic" aria-label="Hold to dictate">🎙️</button>
  <div id="state" role="status" aria-live="polite">Ready</div>
  <div id="out" aria-label="Cleaned text"></div>
  <div id="actions">
    <button id="copy">Copy</button>
    <button id="share" class="ghost">Share</button>
  </div>
  <p class="notice">Audio is sent only to your own PC over your local network, processed there by local models, and never uploaded to the internet.</p>
<script>
(function () {
  var token = new URLSearchParams(location.search).get('t') || '';
  var styles = ['professional', 'casual', 'messaging'];
  var style = localStorage.getItem('scribe-style') || 'professional';
  var mic = document.getElementById('mic');
  var stateEl = document.getElementById('state');
  var out = document.getElementById('out');
  var row = document.getElementById('styleRow');

  styles.forEach(function (s) {
    var b = document.createElement('button');
    b.textContent = s;
    if (s === style) b.className = 'on';
    b.onclick = function () {
      style = s; localStorage.setItem('scribe-style', s);
      Array.prototype.forEach.call(row.children, function (c) { c.className = c.textContent === s ? 'on' : ''; });
    };
    row.appendChild(b);
  });

  var mediaRecorder = null, chunks = [], busy = false;

  function setState(t) { stateEl.textContent = t; }

  async function start() {
    if (busy || mediaRecorder) return;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) { setState('Microphone blocked — allow it in your browser.'); return; }
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.start();
    mic.classList.add('rec');
    setState('Listening…');
  }

  async function stop() {
    if (!mediaRecorder) return;
    var rec = mediaRecorder; mediaRecorder = null;
    var stream = rec.stream;
    await new Promise(function (r) { rec.onstop = r; rec.stop(); });
    stream.getTracks().forEach(function (t) { t.stop(); });
    mic.classList.remove('rec'); mic.classList.add('busy');
    busy = true; setState('Thinking…');
    try {
      var blob = new Blob(chunks);
      var wav = await toWav16k(blob);
      var res = await fetch('/dictate?t=' + token + '&style=' + style, { method: 'POST', body: wav });
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      out.textContent = data.clean || '(no speech detected)';
      setState('Done');
    } catch (e) { setState('Error: ' + e.message); }
    busy = false; mic.classList.remove('busy');
  }

  async function toWav16k(blob) {
    var buf = await blob.arrayBuffer();
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var audio = await ctx.decodeAudioData(buf);
    var src = audio.getChannelData(0);
    var ratio = audio.sampleRate / 16000;
    var n = Math.floor(src.length / ratio);
    var pcm = new Int16Array(n);
    for (var i = 0; i < n; i++) {
      var v = src[Math.floor(i * ratio)] || 0;
      pcm[i] = Math.max(-1, Math.min(1, v)) * 32767;
    }
    ctx.close();
    var w = new ArrayBuffer(44 + pcm.length * 2);
    var dv = new DataView(w);
    function str(o, s) { for (var i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
    new Int16Array(w, 44).set(pcm);
    return w;
  }

  mic.addEventListener('pointerdown', function (e) { e.preventDefault(); void start(); });
  mic.addEventListener('pointerup', function (e) { e.preventDefault(); void stop(); });
  mic.addEventListener('pointercancel', function () { void stop(); });

  document.getElementById('copy').onclick = function () {
    if (out.textContent) navigator.clipboard.writeText(out.textContent).then(function () { setState('Copied'); });
  };
  document.getElementById('share').onclick = function () {
    if (out.textContent && navigator.share) void navigator.share({ text: out.textContent });
    else setState('Sharing not supported here');
  };
})();
</script>
</body>
</html>`
