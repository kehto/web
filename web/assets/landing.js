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

function isHistoryRestore(event) {
  if (event.persisted) return true;

  const entries = typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('navigation') : [];
  return entries.some((entry) => entry.type === 'back_forward');
}

function createFluidNodes() {
  return [
    { homeX: 0.16, homeY: 0.25, radius: 0.22, mass: 0.9, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.31, homeY: 0.18, radius: 0.28, mass: 1.1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.5, homeY: 0.3, radius: 0.34, mass: 1.3, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.72, homeY: 0.22, radius: 0.26, mass: 1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.84, homeY: 0.46, radius: 0.3, mass: 1.2, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.66, homeY: 0.68, radius: 0.32, mass: 1.3, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.42, homeY: 0.78, radius: 0.27, mass: 1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.19, homeY: 0.66, radius: 0.3, mass: 1.15, x: 0, y: 0, vx: 0, vy: 0 },
  ];
}

function createFluidState(canvas, context) {
  return {
    canvas,
    context,
    height: 0,
    lastTime: 0,
    nodes: createFluidNodes(),
    pixelRatio: 1,
    width: 0,
  };
}

function resizeFluidCanvas(fluid) {
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  const nextRatio = Math.min(window.devicePixelRatio || 1, 1.6);

  if (nextWidth === fluid.width && nextHeight === fluid.height && nextRatio === fluid.pixelRatio) return;

  fluid.width = nextWidth;
  fluid.height = nextHeight;
  fluid.pixelRatio = nextRatio;
  fluid.canvas.width = Math.max(1, Math.floor(fluid.width * fluid.pixelRatio));
  fluid.canvas.height = Math.max(1, Math.floor(fluid.height * fluid.pixelRatio));
  fluid.canvas.style.width = `${fluid.width}px`;
  fluid.canvas.style.height = `${fluid.height}px`;
  fluid.context.setTransform(fluid.pixelRatio, 0, 0, fluid.pixelRatio, 0, 0);

  for (const node of fluid.nodes) {
    node.x = node.homeX * fluid.width;
    node.y = node.homeY * fluid.height;
    node.vx = 0;
    node.vy = 0;
  }
}

function drawFluidNode(fluid, node, strength) {
  const radius = Math.min(fluid.width, fluid.height) * node.radius * (0.9 + strength * 0.18);
  const gradient = fluid.context.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);

  gradient.addColorStop(0, `rgba(255, 218, 88, ${0.044 + strength * 0.032})`);
  gradient.addColorStop(0.32, `rgba(244, 197, 57, ${0.026 + strength * 0.022})`);
  gradient.addColorStop(0.68, 'rgba(244, 197, 57, 0.01)');
  gradient.addColorStop(1, 'rgba(244, 197, 57, 0)');

  fluid.context.fillStyle = gradient;
  fluid.context.beginPath();
  fluid.context.arc(node.x, node.y, radius, 0, Math.PI * 2);
  fluid.context.fill();
}

function drawFluidWake(fluid, strength) {
  const scale = Math.min(fluid.width, fluid.height);
  fluid.context.save();
  fluid.context.globalCompositeOperation = 'lighter';
  fluid.context.filter = `blur(${Math.max(18, scale * 0.032)}px)`;
  fluid.context.lineCap = 'round';
  fluid.context.lineJoin = 'round';
  fluid.context.lineWidth = Math.max(34, scale * 0.056);
  fluid.context.strokeStyle = `rgba(255, 218, 88, ${0.01 + strength * 0.012})`;

  fluid.context.beginPath();
  fluid.context.moveTo(fluid.nodes[0].x, fluid.nodes[0].y);

  for (let index = 1; index < fluid.nodes.length; index += 2) {
    const current = fluid.nodes[index];
    const next = fluid.nodes[(index + 1) % fluid.nodes.length];
    fluid.context.bezierCurveTo(
      current.x,
      current.y,
      next.x,
      next.y,
      (current.x + next.x) * 0.5,
      (current.y + next.y) * 0.5,
    );
  }

  fluid.context.stroke();
  fluid.context.restore();
}

function repelFluidNodes(fluid, node, index, dt) {
  for (let otherIndex = index + 1; otherIndex < fluid.nodes.length; otherIndex += 1) {
    const other = fluid.nodes[otherIndex];
    const dx = node.x - other.x;
    const dy = node.y - other.y;
    const distance = Math.hypot(dx, dy) || 1;
    const target = Math.min(fluid.width, fluid.height) * 0.18;
    const pressure = Math.max(0, 1 - distance / target) * 24 * dt;
    node.vx += (dx / distance) * pressure;
    node.vy += (dy / distance) * pressure;
    other.vx -= (dx / distance) * pressure;
    other.vy -= (dy / distance) * pressure;
  }
}

function updatePointerInertia(pointer, dt) {
  const follow = 1 - Math.pow(0.002, dt);
  const pressureFollow = 1 - Math.pow(0.01, dt);
  pointer.x += (pointer.targetX - pointer.x) * follow;
  pointer.y += (pointer.targetY - pointer.y) * follow;
  pointer.pressure += (pointer.targetPressure - pointer.pressure) * pressureFollow;
  pointer.targetPressure *= Math.pow(0.5, dt);

  if (pointer.targetPressure < 0.01) {
    pointer.targetPressure = 0;
  }
}

function moveFluidNodes(fluid, driver, pointer, dt) {
  updatePointerInertia(pointer, dt);

  const centerX = fluid.width * (driver.x + Math.sin(driver.spin * 0.37) * 0.09);
  const centerY = fluid.height * (driver.y + Math.cos(driver.spin * 0.29) * 0.11);
  const pointerX = pointer.x * fluid.width;
  const pointerY = pointer.y * fluid.height;

  for (let index = 0; index < fluid.nodes.length; index += 1) {
    const node = fluid.nodes[index];
    const homeX = node.homeX * fluid.width;
    const homeY = node.homeY * fluid.height;
    const toDriverX = centerX - node.x;
    const toDriverY = centerY - node.y;
    const driverDistance = Math.hypot(toDriverX, toDriverY) || 1;
    const swirl = Math.sin(driver.spin + index * 0.92) * 24 * driver.pressure;
    const pointerDistance = Math.hypot(pointerX - node.x, pointerY - node.y) || 1;
    const pointerRange = Math.min(fluid.width, fluid.height) * 0.48;
    const pointerInfluence = Math.max(0, 1 - pointerDistance / pointerRange) * pointer.pressure;

    node.vx += ((homeX - node.x) * 0.045 + (toDriverY / driverDistance) * swirl + (pointerX - node.x) * 0.006 * pointerInfluence) * dt / node.mass;
    node.vy += ((homeY - node.y) * 0.045 - (toDriverX / driverDistance) * swirl + (pointerY - node.y) * 0.006 * pointerInfluence) * dt / node.mass;

    repelFluidNodes(fluid, node, index, dt);
    node.vx *= 0.987;
    node.vy *= 0.987;
    node.x += node.vx;
    node.y += node.vy;
  }
}

function drawFluidFrame(fluid, driver, pointer, reducedMotionQuery, time = 0) {
  resizeFluidCanvas(fluid);
  const dt = Math.min(0.04, Math.max(0.012, time - fluid.lastTime || 0.016));
  fluid.lastTime = time;

  fluid.context.globalCompositeOperation = 'destination-out';
  fluid.context.fillStyle = 'rgba(0, 0, 0, 0.12)';
  fluid.context.fillRect(0, 0, fluid.width, fluid.height);

  if (!reducedMotionQuery.matches) {
    moveFluidNodes(fluid, driver, pointer, dt);
  }

  const strength = reducedMotionQuery.matches ? 0.16 : Math.max(driver.pressure, pointer.pressure);
  drawFluidWake(fluid, strength);

  for (const node of fluid.nodes) {
    drawFluidNode(fluid, node, strength);
  }

  fluid.context.globalCompositeOperation = 'source-over';
}

function drawStillFluid(fluid) {
  resizeFluidCanvas(fluid);
  fluid.context.clearRect(0, 0, fluid.width, fluid.height);
  drawFluidWake(fluid, 0.18);

  for (const node of fluid.nodes) {
    drawFluidNode(fluid, node, 0.16);
  }
}

function setupLiquidAccent(gsapApi, reducedMotionQuery) {
  const canvas = document.getElementById('liquid-accent');
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  const fluid = createFluidState(canvas, context);
  const driver = { x: 0.52, y: 0.4, spin: 0, pressure: 0.32 };
  const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, targetPressure: 0, pressure: 0 };
  const advanceFluid = (time = 0) => drawFluidFrame(fluid, driver, pointer, reducedMotionQuery, time);
  const onResize = () => {
    if (reducedMotionQuery.matches || !gsapApi) {
      drawStillFluid(fluid);
      return;
    }

    advanceFluid(fluid.lastTime);
  };
  window.addEventListener('resize', onResize, { passive: true });
  drawStillFluid(fluid);

  if (reducedMotionQuery.matches || !gsapApi) {
    return () => window.removeEventListener('resize', onResize);
  }

  const driverTween = gsapApi.to(driver, {
    x: 0.62,
    y: 0.54,
    pressure: 0.48,
    spin: Math.PI * 2,
    duration: 24,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
  });
  const onPointerMove = (event) => {
    const nextX = event.clientX / Math.max(1, fluid.width);
    const nextY = event.clientY / Math.max(1, fluid.height);
    const distance = Math.hypot(nextX - pointer.targetX, nextY - pointer.targetY);
    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.targetPressure = Math.min(0.34, 0.06 + distance * 2.6);
  };
  const onPointerLeave = () => {
    pointer.targetPressure = 0;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  gsapApi.ticker.add(advanceFluid);

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    driverTween.kill();
    gsapApi.ticker.remove(advanceFluid);
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
    '.signal-row span',
    '.notice',
    '.destination',
    '.site-footer',
  ];
  const resetItems = [...motionItems, '.landing'];

  gsapInstance.set(motionItems, { clearProps: 'all' });

  function clearLeavingState() {
    document.body.classList.remove('is-leaving');

    for (const item of resetItems) {
      gsapInstance.killTweensOf(item);
    }

    gsapInstance.set(resetItems, { clearProps: 'all' });
  }

  function playEntrance() {
    root.dataset.motion = 'preparing';
    clearLeavingState();

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
    gsapInstance.set(['.signal-row span', '.destination'], {
      autoAlpha: 0,
      y: 18,
    });

    return gsapInstance
      .timeline({
        defaults: { duration: 0.78, ease: 'power3.out' },
        onComplete: setFinalState,
      })
      .to('.ambient-field', { autoAlpha: 0.9, duration: 1.1, ease: 'power2.out' })
      .to('.eyebrow', { autoAlpha: 1, y: 0 }, 0.1)
      .to('.wordmark-name', { autoAlpha: 1, clipPath: 'inset(0 0 0% 0)', y: 0 }, 0.24)
      .to('.wordmark-role', { autoAlpha: 1, y: 0 }, 0.48)
      .to('.summary', { autoAlpha: 1, y: 0 }, 0.56)
      .to('.destination', { autoAlpha: 1, y: 0, stagger: 0.07 }, 0.68)
      .to('.signal-row span', { autoAlpha: 1, y: 0, stagger: 0.045 }, 0.9)
      .to('.notice', { autoAlpha: 1, y: 0 }, 1.02)
      .to('.site-footer', { autoAlpha: 1, y: 0, duration: 0.52 }, 1.12);
  }

  const media = gsapInstance.matchMedia();

  media.add('(prefers-reduced-motion: reduce)', () => {
    setFinalState();
    gsapInstance.set(motionItems, { clearProps: 'all' });
    const cleanupLiquidAccent = setupLiquidAccent(null, reduceMotion);
    const onPageShow = (event) => {
      if (!isHistoryRestore(event)) return;
      clearLeavingState();
      setFinalState();
    };

    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      cleanupLiquidAccent?.();
    };
  });

  media.add('(prefers-reduced-motion: no-preference)', () => {
    const cleanupLiquidAccent = setupLiquidAccent(gsapInstance, reduceMotion);
    let entrance = playEntrance();
    const onPageShow = (event) => {
      if (!isHistoryRestore(event)) return;
      entrance.kill();
      entrance = playEntrance();
    };

    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
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
