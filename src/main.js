/* Player: playback clock, controls, audio sync, and the export hook. */
(function () {
  const N = window.NYOS;
  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const exporting = params.has('export');

  const seek = document.getElementById('seek');
  const timeEl = document.getElementById('time');
  const playBtn = document.getElementById('play');
  const subsBox = document.getElementById('subs');
  const soundBox = document.getElementById('sound');
  const overlay = document.getElementById('overlay');

  let S = 1;
  function resize() {
    if (exporting) {
      canvas.width = 1920;
      canvas.height = 1080;
      S = 1;
      return;
    }
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(Math.min(1920, r.width * dpr));
    canvas.width = w;
    canvas.height = Math.round((w * 9) / 16);
    S = canvas.width / 1920;
  }

  let playing = false, t = 0, startWall = 0, startT = 0;
  let audio = null, audioSrc = null;

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  function draw() {
    N.renderFrame(ctx, t, S, { subtitles: subsBox.checked });
    seek.value = t;
    timeEl.textContent = `${fmt(t)} / 1:00`;
  }

  let audioToken = 0;
  async function startAudio() {
    stopAudio();
    if (!soundBox.checked) return;
    const token = ++audioToken;
    if (!audio) audio = await N.createScore();
    // Picture never waits for sound: join at wherever playback is now.
    if (token !== audioToken || !playing) return;
    audioSrc = audio.play(currentTime());
  }
  const currentTime = () => (playing ? startT + (performance.now() - startWall) / 1000 : t);
  function stopAudio() {
    audioToken++;
    if (audioSrc) {
      try { audioSrc.stop(); } catch (e) { /* already stopped */ }
      audioSrc = null;
    }
  }

  async function play() {
    if (t >= N.DURATION - 0.05) t = 0;
    playing = true;
    playBtn.textContent = 'Pause';
    overlay.classList.add('hidden');
    startWall = performance.now();
    startT = t;
    requestAnimationFrame(loop);
    startAudio();
  }
  function pause() {
    playing = false;
    playBtn.textContent = 'Play';
    stopAudio();
  }
  function loop(now) {
    if (!playing) return;
    t = startT + (now - startWall) / 1000;
    if (t >= N.DURATION) {
      t = N.DURATION - 0.001;
      draw();
      pause();
      return;
    }
    draw();
    requestAnimationFrame(loop);
  }

  playBtn.onclick = () => (playing ? pause() : play());
  document.getElementById('start').onclick = play;
  overlay.onclick = (e) => { if (e.target === overlay) play(); };
  seek.oninput = () => {
    t = parseFloat(seek.value);
    if (playing) {
      startWall = performance.now();
      startT = t;
      startAudio();
    }
    draw();
  };
  subsBox.onchange = draw;
  soundBox.onchange = () => (playing ? startAudio() : null);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      playing ? pause() : play();
    }
  });
  window.addEventListener('resize', () => { resize(); draw(); });

  // Hooks used by tools/render-video.mjs.
  const fonts = ['500 44px "Nyos Serif"', 'italic 500 44px "Nyos Serif"', '600 44px "Nyos Serif"', '400 20px "Nyos Sans"', '500 20px "Nyos Sans"'];
  N.ready = Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => null).then(() => {
    resize();
    if (params.has('t')) t = parseFloat(params.get('t'));
    draw();
    if (!exporting) N.createScore().then((a) => { audio = a; }).catch(() => null);
  });
  if (exporting) document.body.classList.add('export');
  window.renderAt = (time) => {
    t = time;
    N.renderFrame(ctx, t, S, { subtitles: params.get('subs') !== '0' });
  };
})();
