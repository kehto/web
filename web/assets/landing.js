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

function createHairlineStrands() {
  return [
    { homeY: 0.16, amplitude: 0.07, curl: 0.7, phase: 0.2, speed: 0.82, points: [] },
    { homeY: 0.26, amplitude: 0.06, curl: -0.5, phase: 1.1, speed: 0.68, points: [] },
    { homeY: 0.37, amplitude: 0.075, curl: 0.48, phase: 2.1, speed: 0.74, points: [] },
    { homeY: 0.5, amplitude: 0.052, curl: -0.66, phase: 3.0, speed: 0.62, points: [] },
    { homeY: 0.62, amplitude: 0.07, curl: 0.58, phase: 4.0, speed: 0.78, points: [] },
    { homeY: 0.74, amplitude: 0.058, curl: -0.42, phase: 4.9, speed: 0.64, points: [] },
  ];
}

function createHairlineState(canvas, context) {
  return {
    canvas,
    context,
    height: 0,
    lastTime: 0,
    pixelRatio: 1,
    strands: createHairlineStrands(),
    vortices: [
      { x: 0.28, y: 0.2, phase: 0.1, radius: 0.44, strength: 0.88 },
      { x: 0.72, y: 0.36, phase: 2.4, radius: 0.5, strength: -0.74 },
      { x: 0.46, y: 0.78, phase: 4.0, radius: 0.42, strength: 0.62 },
    ],
    width: 0,
  };
}

function createHairlinePoints(strand, width, height) {
  const count = Math.max(18, Math.round(width / 58));
  strand.points = Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);
    const x = (progress * 1.12 - 0.06) * width;
    const y =
      (strand.homeY +
        Math.sin(progress * Math.PI * 1.8 + strand.phase) * strand.amplitude * 0.45 +
        Math.sin(progress * Math.PI * 4.6 + strand.phase * 1.7) * strand.amplitude * 0.18) *
      height;

    return {
      homeX: progress,
      homeY: strand.homeY,
      x,
      y,
      vx: 0,
      vy: 0,
    };
  });
}

function resizeHairlineCanvas(field) {
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  const nextRatio = Math.min(window.devicePixelRatio || 1, 2);

  if (nextWidth === field.width && nextHeight === field.height && nextRatio === field.pixelRatio) return;

  field.width = nextWidth;
  field.height = nextHeight;
  field.pixelRatio = nextRatio;
  field.canvas.width = Math.max(1, Math.floor(field.width * field.pixelRatio));
  field.canvas.height = Math.max(1, Math.floor(field.height * field.pixelRatio));
  field.canvas.style.width = `${field.width}px`;
  field.canvas.style.height = `${field.height}px`;
  field.context.setTransform(field.pixelRatio, 0, 0, field.pixelRatio, 0, 0);

  for (const strand of field.strands) {
    createHairlinePoints(strand, field.width, field.height);
  }
}

function updatePointerInertia(pointer, dt) {
  const follow = 1 - Math.pow(0.004, dt);
  const pressureFollow = 1 - Math.pow(0.014, dt);
  pointer.x += (pointer.targetX - pointer.x) * follow;
  pointer.y += (pointer.targetY - pointer.y) * follow;
  pointer.pressure += (pointer.targetPressure - pointer.pressure) * pressureFollow;
  pointer.targetPressure *= Math.pow(0.38, dt);

  if (pointer.targetPressure < 0.008) {
    pointer.targetPressure = 0;
  }
}

function getVortexPosition(vortex, driver) {
  return {
    x: vortex.x + Math.sin(driver.phase * 0.58 + vortex.phase) * 0.09,
    y: vortex.y + Math.cos(driver.phase * 0.43 + vortex.phase * 1.3) * 0.08,
  };
}

function applyVortexForce(point, vortex, driver, field, dt) {
  const position = getVortexPosition(vortex, driver);
  const centerX = position.x * field.width;
  const centerY = position.y * field.height;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  const distance = Math.hypot(dx, dy) || 1;
  const radius = Math.min(field.width, field.height) * vortex.radius;
  const falloff = Math.max(0, 1 - distance / radius);
  if (falloff === 0) return;

  const force = falloff * falloff * vortex.strength * driver.pressure * 34 * dt;
  point.vx += (-dy / distance) * force;
  point.vy += (dx / distance) * force;
}

function applyNeighborTension(strand, dt) {
  for (let index = 1; index < strand.points.length; index += 1) {
    const previous = strand.points[index - 1];
    const current = strand.points[index];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const distance = Math.hypot(dx, dy) || 1;
    const targetDistance = Math.abs(current.homeX - previous.homeX) * window.innerWidth * 1.08;
    const correction = (distance - targetDistance) * 0.018 * dt;
    const offsetX = (dx / distance) * correction;
    const offsetY = (dy / distance) * correction;
    previous.vx += offsetX;
    previous.vy += offsetY;
    current.vx -= offsetX;
    current.vy -= offsetY;
  }
}

function moveHairlinePoints(field, driver, pointer, dt) {
  updatePointerInertia(pointer, dt);

  const pointerX = pointer.x * field.width;
  const pointerY = pointer.y * field.height;
  const baseScale = Math.min(field.width, field.height);

  for (let strandIndex = 0; strandIndex < field.strands.length; strandIndex += 1) {
    const strand = field.strands[strandIndex];
    const phase = driver.phase * strand.speed + strand.phase;
    applyNeighborTension(strand, dt);

    for (let index = 0; index < strand.points.length; index += 1) {
      const point = strand.points[index];
      const progress = point.homeX;
      const easedProgress = progress * 1.12 - 0.06;
      const homeX =
        easedProgress * field.width +
        Math.sin(progress * Math.PI * 2.8 + phase * 0.72) * baseScale * strand.amplitude * strand.curl * 0.42;
      const wave =
        Math.sin(progress * Math.PI * 2.2 + phase) * strand.amplitude * field.height +
        Math.sin(progress * Math.PI * 6.2 - phase * 0.64) * strand.amplitude * field.height * 0.32;
      const homeY = strand.homeY * field.height + wave;
      const distance = Math.hypot(pointerX - point.x, pointerY - point.y) || 1;
      const range = baseScale * 0.5;
      const influence = Math.max(0, 1 - distance / range) * pointer.pressure;
      const wakeAngle = Math.atan2(point.y - pointerY, point.x - pointerX) + Math.PI / 2;
      const wake = influence * baseScale * 0.035;
      const targetX = homeX + Math.cos(wakeAngle) * wake;
      const targetY = homeY + Math.sin(wakeAngle) * wake;

      for (const vortex of field.vortices) {
        applyVortexForce(point, vortex, driver, field, dt);
      }

      point.vx += (targetX - point.x) * 0.04 * dt;
      point.vy += (targetY - point.y) * 0.04 * dt;
      point.vx *= 0.988;
      point.vy *= 0.988;
      point.x += point.vx;
      point.y += point.vy;
    }
  }
}

function drawHairlineTrace(field, strand, index, strength) {
  const points = strand.points;
  if (points.length < 2) return;

  const context = field.context;
  const alpha = 0.28 + strength * 0.24 - index * 0.02;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
    const current = points[pointIndex];
    const next = points[pointIndex + 1];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
  }

  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.strokeStyle = `rgba(244, 197, 57, ${Math.max(0.16, alpha)})`;
  context.lineWidth = index === 0 ? 0.82 : 0.64;
  context.stroke();
}

function drawHairlineEddies(field, strand, index, strength) {
  const context = field.context;
  const every = index % 2 === 0 ? 5 : 6;
  context.strokeStyle = `rgba(255, 218, 88, ${0.18 + strength * 0.14})`;
  context.lineWidth = 0.58;

  for (let pointIndex = 2; pointIndex < strand.points.length - 2; pointIndex += every) {
    const previous = strand.points[pointIndex - 1];
    const point = strand.points[pointIndex];
    const next = strand.points[pointIndex + 1];
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    const radius = 8 + strength * 7;
    context.beginPath();
    context.arc(point.x, point.y, radius, angle - 0.65, angle + 0.45);
    context.stroke();
  }
}

function drawHairlineFrame(field, driver, pointer, reducedMotionQuery, time = 0) {
  resizeHairlineCanvas(field);
  const dt = Math.min(0.04, Math.max(0.012, time - field.lastTime || 0.016));
  field.lastTime = time;
  field.context.clearRect(0, 0, field.width, field.height);

  if (!reducedMotionQuery.matches) {
    moveHairlinePoints(field, driver, pointer, dt);
  }

  const strength = reducedMotionQuery.matches ? 0.18 : Math.max(driver.pressure, pointer.pressure);
  field.context.save();
  field.context.lineCap = 'butt';
  field.context.lineJoin = 'round';

  for (let index = 0; index < field.strands.length; index += 1) {
    const strand = field.strands[index];
    drawHairlineTrace(field, strand, index, strength);
    drawHairlineEddies(field, strand, index, strength);
  }

  field.context.restore();
}

function drawStillHairlines(field) {
  resizeHairlineCanvas(field);
  field.context.clearRect(0, 0, field.width, field.height);

  for (const strand of field.strands) {
    createHairlinePoints(strand, field.width, field.height);
  }

  drawHairlineFrame(
    field,
    { phase: 0.2, pressure: 0.16 },
    { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, targetPressure: 0, pressure: 0 },
    { matches: true },
  );
}

function setupHairlineAccent(gsapApi, reducedMotionQuery, animateWithoutGsap = false) {
  const canvas = document.getElementById('hairline-accent');
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  const field = createHairlineState(canvas, context);
  const driver = { phase: 0, pressure: 0.2 };
  const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, targetPressure: 0, pressure: 0 };
  const advanceHairlines = (time = 0) => drawHairlineFrame(field, driver, pointer, reducedMotionQuery, time);
  const onResize = () => {
    if (reducedMotionQuery.matches || !gsapApi) {
      drawStillHairlines(field);
      return;
    }

    advanceHairlines(field.lastTime);
  };
  window.addEventListener('resize', onResize, { passive: true });
  drawStillHairlines(field);

  if (reducedMotionQuery.matches || (!gsapApi && !animateWithoutGsap)) {
    return () => window.removeEventListener('resize', onResize);
  }

  const driverTween = gsapApi
    ? gsapApi.to(driver, {
        phase: Math.PI * 2,
        pressure: 0.34,
        duration: 30,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      })
    : null;
  let animationFrameId = 0;
  const onPointerMove = (event) => {
    const nextX = event.clientX / Math.max(1, field.width);
    const nextY = event.clientY / Math.max(1, field.height);
    const distance = Math.hypot(nextX - pointer.targetX, nextY - pointer.targetY);
    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.targetPressure = Math.min(0.42, 0.08 + distance * 2.2);
  };
  const onPointerLeave = () => {
    pointer.targetPressure = 0;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });

  if (gsapApi) {
    gsapApi.ticker.add(advanceHairlines);
  } else {
    const tickHairlines = (time) => {
      const seconds = time / 1000;
      driver.phase = seconds * 0.44;
      driver.pressure = 0.26 + Math.sin(seconds * 0.42) * 0.08;
      advanceHairlines(seconds);
      animationFrameId = window.requestAnimationFrame(tickHairlines);
    };

    animationFrameId = window.requestAnimationFrame(tickHairlines);
  }

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    driverTween?.kill();

    if (gsapApi) {
      gsapApi.ticker.remove(advanceHairlines);
    } else {
      window.cancelAnimationFrame(animationFrameId);
    }
  };
}

if (!gsapInstance) {
  setupHairlineAccent(null, window.matchMedia('(prefers-reduced-motion: reduce)'), true);
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
    const cleanupHairlineAccent = setupHairlineAccent(null, reduceMotion);
    const onPageShow = (event) => {
      if (!isHistoryRestore(event)) return;
      clearLeavingState();
      setFinalState();
    };

    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      cleanupHairlineAccent?.();
    };
  });

  media.add('(prefers-reduced-motion: no-preference)', () => {
    const cleanupHairlineAccent = setupHairlineAccent(gsapInstance, reduceMotion);
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
      cleanupHairlineAccent?.();
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
