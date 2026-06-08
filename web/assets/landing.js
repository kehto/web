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

function createContourBodies() {
  return [
    { homeX: 0.22, homeY: 0.23, radius: 0.22, weight: 0.95, mass: 1, phase: 0.1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.43, homeY: 0.27, radius: 0.27, weight: 1.12, mass: 1.2, phase: 1.3, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.66, homeY: 0.34, radius: 0.3, weight: 1.08, mass: 1.15, phase: 2.4, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.8, homeY: 0.56, radius: 0.25, weight: 0.94, mass: 1.05, phase: 3.2, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.55, homeY: 0.72, radius: 0.28, weight: 1.04, mass: 1.18, phase: 4.1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.28, homeY: 0.63, radius: 0.24, weight: 0.98, mass: 1.08, phase: 5.0, x: 0, y: 0, vx: 0, vy: 0 },
  ];
}

function createContourState(canvas, context) {
  return {
    bodies: createContourBodies(),
    canvas,
    cellSize: 28,
    columns: 0,
    context,
    height: 0,
    lastTime: 0,
    pixelRatio: 1,
    rows: 0,
    values: new Float32Array(0),
    width: 0,
  };
}

function resetContourBodies(field) {
  for (const body of field.bodies) {
    body.x = body.homeX * field.width;
    body.y = body.homeY * field.height;
    body.vx = 0;
    body.vy = 0;
  }
}

function resizeContourCanvas(field) {
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  const nextRatio = Math.min(window.devicePixelRatio || 1, 2);

  if (nextWidth === field.width && nextHeight === field.height && nextRatio === field.pixelRatio) return;

  field.width = nextWidth;
  field.height = nextHeight;
  field.pixelRatio = nextRatio;
  field.cellSize = Math.max(16, Math.min(26, Math.min(field.width, field.height) / 36));
  field.columns = Math.ceil(field.width / field.cellSize) + 1;
  field.rows = Math.ceil(field.height / field.cellSize) + 1;
  field.values = new Float32Array(field.columns * field.rows);
  field.canvas.width = Math.max(1, Math.floor(field.width * field.pixelRatio));
  field.canvas.height = Math.max(1, Math.floor(field.height * field.pixelRatio));
  field.canvas.style.width = `${field.width}px`;
  field.canvas.style.height = `${field.height}px`;
  field.context.setTransform(field.pixelRatio, 0, 0, field.pixelRatio, 0, 0);
  resetContourBodies(field);
}

function updatePointerInertia(pointer, dt) {
  const follow = 1 - Math.pow(0.004, dt);
  const pressureFollow = 1 - Math.pow(0.016, dt);
  pointer.x += (pointer.targetX - pointer.x) * follow;
  pointer.y += (pointer.targetY - pointer.y) * follow;
  pointer.pressure += (pointer.targetPressure - pointer.pressure) * pressureFollow;
  pointer.targetPressure *= Math.pow(0.42, dt);

  if (pointer.targetPressure < 0.01) {
    pointer.targetPressure = 0;
  }
}

function repelContourBodies(field, body, index, dt) {
  const scale = Math.min(field.width, field.height);

  for (let otherIndex = index + 1; otherIndex < field.bodies.length; otherIndex += 1) {
    const other = field.bodies[otherIndex];
    const dx = body.x - other.x;
    const dy = body.y - other.y;
    const distance = Math.hypot(dx, dy) || 1;
    const target = scale * 0.2;
    const pressure = Math.max(0, 1 - distance / target) * 34 * dt;
    body.vx += (dx / distance) * pressure;
    body.vy += (dy / distance) * pressure;
    other.vx -= (dx / distance) * pressure;
    other.vy -= (dy / distance) * pressure;
  }
}

function moveContourBodies(field, driver, pointer, dt) {
  updatePointerInertia(pointer, dt);

  const scale = Math.min(field.width, field.height);
  const pointerX = pointer.x * field.width;
  const pointerY = pointer.y * field.height;

  for (let index = 0; index < field.bodies.length; index += 1) {
    const body = field.bodies[index];
    const phase = driver.phase + body.phase;
    const homeX = (body.homeX + Math.sin(phase * 0.44) * 0.08 + Math.cos(phase * 0.17) * 0.035) * field.width;
    const homeY = (body.homeY + Math.cos(phase * 0.36) * 0.075 + Math.sin(phase * 0.22) * 0.028) * field.height;
    const dx = pointerX - body.x;
    const dy = pointerY - body.y;
    const distance = Math.hypot(dx, dy) || 1;
    const pointerRange = scale * 0.56;
    const pointerInfluence = Math.max(0, 1 - distance / pointerRange) * pointer.pressure;
    const tangent = Math.atan2(dy, dx) + Math.PI / 2;
    const outward = Math.min(scale * 0.085, distance * 0.08) * pointerInfluence;

    body.vx += ((homeX - body.x) * 0.05 + Math.cos(tangent) * outward + dx * 0.01 * pointerInfluence) * dt / body.mass;
    body.vy += ((homeY - body.y) * 0.05 + Math.sin(tangent) * outward + dy * 0.01 * pointerInfluence) * dt / body.mass;
    repelContourBodies(field, body, index, dt);
    body.vx *= 0.985;
    body.vy *= 0.985;
    body.x += body.vx;
    body.y += body.vy;
  }
}

function sampleContourField(field, x, y) {
  const scale = Math.min(field.width, field.height);
  let value = 0;

  for (const body of field.bodies) {
    const dx = x - body.x;
    const dy = y - body.y;
    const radius = scale * body.radius;
    value += (body.weight * radius * radius) / (dx * dx + dy * dy + radius * radius * 0.34);
  }

  return value;
}

function populateScalarField(field) {
  for (let row = 0; row < field.rows; row += 1) {
    const y = row * field.cellSize;

    for (let column = 0; column < field.columns; column += 1) {
      const x = column * field.cellSize;
      field.values[row * field.columns + column] = sampleContourField(field, x, y);
    }
  }
}

function interpolateContourPoint(level, a, b) {
  const range = b.value - a.value;
  const amount = range === 0 ? 0.5 : (level - a.value) / range;
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  };
}

const contourSegments = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [
    [3, 2],
    [0, 1],
  ],
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[0, 2]],
  [
    [0, 3],
    [1, 2],
  ],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[3, 0]],
  [],
];

function drawContourLevel(field, level, alpha, lineWidth) {
  const { cellSize, columns, context, rows, values } = field;
  context.beginPath();

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const x = column * cellSize;
      const y = row * cellSize;
      const topLeft = { x, y, value: values[row * columns + column] };
      const topRight = { x: x + cellSize, y, value: values[row * columns + column + 1] };
      const bottomRight = { x: x + cellSize, y: y + cellSize, value: values[(row + 1) * columns + column + 1] };
      const bottomLeft = { x, y: y + cellSize, value: values[(row + 1) * columns + column] };
      const cellIndex =
        (topLeft.value > level ? 1 : 0) |
        (topRight.value > level ? 2 : 0) |
        (bottomRight.value > level ? 4 : 0) |
        (bottomLeft.value > level ? 8 : 0);
      const segments = contourSegments[cellIndex];
      if (segments.length === 0) continue;

      const edges = [
        interpolateContourPoint(level, topLeft, topRight),
        interpolateContourPoint(level, topRight, bottomRight),
        interpolateContourPoint(level, bottomLeft, bottomRight),
        interpolateContourPoint(level, topLeft, bottomLeft),
      ];

      for (const [startEdge, endEdge] of segments) {
        const start = edges[startEdge];
        const end = edges[endEdge];
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
      }
    }
  }

  context.strokeStyle = `rgba(244, 197, 57, ${alpha})`;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawContourLines(field, driver, strength) {
  populateScalarField(field);

  const phase = driver.outward % 1;
  const levelCount = 13;
  const minLevel = 0.3;
  const levelStep = 0.076;
  field.context.save();
  field.context.lineCap = 'round';
  field.context.lineJoin = 'round';

  for (let index = 0; index < levelCount; index += 1) {
    const offset = (index + 1 - phase + levelCount) % levelCount;
    const level = minLevel + Math.pow(offset + 0.24, 1.08) * levelStep;
    const normalized = offset / (levelCount - 1);
    const alpha = 0.16 + (1 - normalized) * 0.34 + strength * 0.07;
    const lineWidth = 0.48 + (1 - normalized) * 0.34;
    drawContourLevel(field, level, alpha, lineWidth);
  }

  field.context.restore();
}

function drawContourFrame(field, driver, pointer, reducedMotionQuery, time = 0) {
  resizeContourCanvas(field);
  const dt = Math.min(0.04, Math.max(0.012, time - field.lastTime || 0.016));
  field.lastTime = time;
  field.context.clearRect(0, 0, field.width, field.height);

  if (!reducedMotionQuery.matches) {
    moveContourBodies(field, driver, pointer, dt);
  }

  const strength = reducedMotionQuery.matches ? 0.12 : Math.max(driver.pressure, pointer.pressure);
  drawContourLines(field, driver, strength);
}

function drawStillContours(field) {
  resizeContourCanvas(field);
  field.context.clearRect(0, 0, field.width, field.height);
  resetContourBodies(field);
  drawContourFrame(
    field,
    { outward: 0.36, phase: 0.2, pressure: 0.16 },
    { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, targetPressure: 0, pressure: 0 },
    { matches: true },
  );
}

function setupContourAccent(gsapApi, reducedMotionQuery, animateWithoutGsap = false) {
  const canvas = document.getElementById('hairline-accent');
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  const field = createContourState(canvas, context);
  const driver = { outward: 0, phase: 0, pressure: 0.24 };
  const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, targetPressure: 0, pressure: 0 };
  const advanceContours = (time = 0) => drawContourFrame(field, driver, pointer, reducedMotionQuery, time);
  const onResize = () => {
    if (reducedMotionQuery.matches || !gsapApi) {
      drawStillContours(field);
      return;
    }

    advanceContours(field.lastTime);
  };
  window.addEventListener('resize', onResize, { passive: true });
  drawStillContours(field);

  if (reducedMotionQuery.matches || (!gsapApi && !animateWithoutGsap)) {
    return () => window.removeEventListener('resize', onResize);
  }

  const phaseTween = gsapApi
    ? gsapApi.to(driver, {
        outward: 1,
        phase: Math.PI * 2,
        pressure: 0.38,
        duration: 18,
        ease: 'none',
        repeat: -1,
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
    gsapApi.ticker.add(advanceContours);
  } else {
    const tickContours = (time) => {
      const seconds = time / 1000;
      driver.outward = (seconds * 0.08) % 1;
      driver.phase = seconds * 0.42;
      driver.pressure = 0.26 + Math.sin(seconds * 0.36) * 0.08;
      advanceContours(seconds);
      animationFrameId = window.requestAnimationFrame(tickContours);
    };

    animationFrameId = window.requestAnimationFrame(tickContours);
  }

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    phaseTween?.kill();

    if (gsapApi) {
      gsapApi.ticker.remove(advanceContours);
    } else {
      window.cancelAnimationFrame(animationFrameId);
    }
  };
}

if (!gsapInstance) {
  setupContourAccent(null, window.matchMedia('(prefers-reduced-motion: reduce)'), true);
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
    const cleanupContourAccent = setupContourAccent(null, reduceMotion);
    const onPageShow = (event) => {
      if (!isHistoryRestore(event)) return;
      clearLeavingState();
      setFinalState();
    };

    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      cleanupContourAccent?.();
    };
  });

  media.add('(prefers-reduced-motion: no-preference)', () => {
    const cleanupContourAccent = setupContourAccent(gsapInstance, reduceMotion);
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
      cleanupContourAccent?.();
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
