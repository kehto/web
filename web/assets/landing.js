(() => {
  const video = document.querySelector('#runtime-film');
  const toggle = document.querySelector('.film-toggle');
  if (
    !(video instanceof HTMLVideoElement) ||
    !(toggle instanceof HTMLButtonElement)
  )
    return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = false;
  let visible = false;

  function updateControl() {
    toggle.textContent = video.paused ? 'Play film ▶' : 'Pause film Ⅱ';
    toggle.setAttribute(
      'aria-label',
      video.paused ? 'Play runtime film' : 'Pause runtime film'
    );
  }

  async function playFilm() {
    try {
      await video.play();
    } catch {
      // Autoplay policies can reject play; the same control allows a user gesture.
      updateControl();
    }
  }

  const expand = document.querySelector('.film-expand');
  if (expand instanceof HTMLButtonElement && document.fullscreenEnabled) {
    expand.hidden = false;
    expand.addEventListener('click', async () => {
      video.controls = true;
      try {
        await video.requestFullscreen();
      } catch {
        video.controls = false;
      }
    });
    document.addEventListener('fullscreenchange', () => {
      video.controls = document.fullscreenElement === video;
    });
  }
  toggle.hidden = false;
  video.controls = false;
  video.addEventListener('play', updateControl);
  video.addEventListener('pause', updateControl);
  video.addEventListener('error', () => {
    toggle.hidden = true;
    video.controls = true;
  });
  toggle.addEventListener('click', () => {
    if (video.paused) {
      userPaused = false;
      void playFilm();
    } else {
      userPaused = true;
      video.pause();
    }
  });
  function syncPlayback() {
    if (document.hidden || !visible || reducedMotion.matches || userPaused)
      video.pause();
    else void playFilm();
  }
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    },
    { threshold: 0.15 }
  ).observe(video);
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  window.addEventListener('pagehide', () => video.pause());
  window.addEventListener('pageshow', syncPlayback);
  updateControl();
})();
