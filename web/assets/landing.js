const root = document.documentElement;
root.dataset.kehtoLanding = 'ready';

const gsapInstance = window.gsap;

function isModifiedClick(event) {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldAnimateRoute(anchor, event) {
  if (isModifiedClick(event)) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return false;

  return destination.pathname === '/web/playground/' || destination.pathname === '/web/docs/';
}

function setFinalState() {
  root.dataset.motion = 'ready';
}

function setupLiquidAccent(gsapApi, reducedMotionQuery) {
  const canvas = document.getElementById('liquid-accent');
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  const points = [
    { x: 0.22, y: 0.24, radius: 0.32, phase: 0.1, drift: 0.013 },
    { x: 0.7, y: 0.2, radius: 0.38, phase: 1.7, drift: 0.018 },
    { x: 0.82, y: 0.64, radius: 0.34, phase: 2.8, drift: 0.015 },
    { x: 0.34, y: 0.78, radius: 0.3, phase: 4.2, drift: 0.011 },
  ];

  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  function resize() {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.6);

    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;

    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    canvas.width = Math.max(1, Math.floor(width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function draw(time = 0) {
    resize();
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    for (const point of points) {
      const still = reducedMotionQuery.matches;
      const wave = still ? point.phase : time * point.drift + point.phase;
      const x = width * (point.x + Math.sin(wave) * 0.035);
      const y = height * (point.y + Math.cos(wave * 0.8) * 0.045);
      const radius = Math.min(width, height) * point.radius;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

      gradient.addColorStop(0, 'rgba(214, 186, 91, 0.095)');
      gradient.addColorStop(0.38, 'rgba(214, 186, 91, 0.045)');
      gradient.addColorStop(1, 'rgba(214, 186, 91, 0)');

      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    context.globalCompositeOperation = 'source-over';
  }

  const onResize = () => draw(0);
  window.addEventListener('resize', onResize, { passive: true });
  draw(0);

  if (reducedMotionQuery.matches || !gsapApi) {
    return () => window.removeEventListener('resize', onResize);
  }

  const tick = (time) => draw(time);
  gsapApi.ticker.add(tick);

  return () => {
    window.removeEventListener('resize', onResize);
    gsapApi.ticker.remove(tick);
  };
}

if (!gsapInstance) {
  setupLiquidAccent(null, window.matchMedia('(prefers-reduced-motion: reduce)'));
  setFinalState();
} else {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionItems = [
    '.ambient-field',
    '.eyebrow',
    '.wordmark-name',
    '.wordmark-role',
    '.summary',
    '.proof-item',
    '.notice',
    '.destination',
    '.site-footer',
  ];

  gsapInstance.set(motionItems, { clearProps: 'all' });

  const media = gsapInstance.matchMedia();

  media.add('(prefers-reduced-motion: reduce)', () => {
    setFinalState();
    gsapInstance.set(motionItems, { clearProps: 'all' });
    return setupLiquidAccent(null, reduceMotion);
  });

  media.add('(prefers-reduced-motion: no-preference)', () => {
    root.dataset.motion = 'preparing';
    const cleanupLiquidAccent = setupLiquidAccent(gsapInstance, reduceMotion);

    gsapInstance.set('.ambient-field', { autoAlpha: 0 });
    gsapInstance.set(['.eyebrow', '.wordmark-role', '.summary', '.notice', '.site-footer'], {
      autoAlpha: 0,
      y: 14,
    });
    gsapInstance.set('.wordmark-name', {
      autoAlpha: 0,
      clipPath: 'inset(0 0 100% 0)',
      y: 18,
    });
    gsapInstance.set(['.proof-item', '.destination'], {
      autoAlpha: 0,
      y: 18,
    });

    const entrance = gsapInstance.timeline({
      defaults: { duration: 0.78, ease: 'power3.out' },
      onComplete: setFinalState,
    });

    entrance
      .to('.ambient-field', { autoAlpha: 0.9, duration: 1.1, ease: 'power2.out' })
      .to('.eyebrow', { autoAlpha: 1, y: 0 }, 0.1)
      .to('.wordmark-name', { autoAlpha: 1, clipPath: 'inset(0 0 0% 0)', y: 0 }, 0.24)
      .to('.wordmark-role', { autoAlpha: 1, y: 0 }, 0.48)
      .to('.summary', { autoAlpha: 1, y: 0 }, 0.56)
      .to('.proof-item', { autoAlpha: 1, y: 0, stagger: 0.08 }, 0.72)
      .to('.notice', { autoAlpha: 1, y: 0 }, 0.9)
      .to('.destination', { autoAlpha: 1, y: 0, stagger: 0.08 }, 1.02)
      .to('.site-footer', { autoAlpha: 1, y: 0, duration: 0.52 }, 1.18);

    return () => {
      entrance.kill();
      cleanupLiquidAccent?.();
    };
  });

  for (const anchor of document.querySelectorAll('[data-route-link]')) {
    anchor.addEventListener('click', (event) => {
      if (!(event instanceof MouseEvent) || reduceMotion.matches || !shouldAnimateRoute(anchor, event)) return;

      event.preventDefault();
      document.body.classList.add('is-leaving');

      gsapInstance
        .timeline({
          defaults: { duration: 0.24, ease: 'power2.inOut' },
          onComplete: () => {
            window.location.href = anchor.href;
          },
        })
        .to('.destination', { autoAlpha: 0.42, y: 4, stagger: 0.03 }, 0)
        .to('.ambient-field', { autoAlpha: 0.28, scale: 0.995 }, 0)
        .to('.landing', { autoAlpha: 0, y: -8 }, 0.06)
        .to('.site-footer', { autoAlpha: 0 }, 0.08);
    });
  }
}
