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
    { homeX: 0.14, homeY: 0.16, radius: 0.2, gravity: 0.82, mass: 1.35, phase: 0.1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.34, homeY: 0.22, radius: 0.24, gravity: 1.0, mass: 1.6, phase: 0.9, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.58, homeY: 0.17, radius: 0.22, gravity: 0.92, mass: 1.48, phase: 1.7, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.82, homeY: 0.28, radius: 0.21, gravity: 0.78, mass: 1.32, phase: 2.5, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.73, homeY: 0.5, radius: 0.25, gravity: 1.08, mass: 1.7, phase: 3.3, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.5, homeY: 0.62, radius: 0.23, gravity: 0.96, mass: 1.54, phase: 4.1, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.24, homeY: 0.72, radius: 0.2, gravity: 0.84, mass: 1.42, phase: 4.9, x: 0, y: 0, vx: 0, vy: 0 },
    { homeX: 0.9, homeY: 0.76, radius: 0.19, gravity: 0.72, mass: 1.26, phase: 5.7, x: 0, y: 0, vx: 0, vy: 0 },
  ];
}

function createContourState(canvas, context) {
  return {
    bodies: createContourBodies(),
    canvas,
    context,
    height: 0,
    lastTime: 0,
    lineSpacing: 14,
    pixelRatio: 1,
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
  field.lineSpacing = Math.max(7, Math.min(13, Math.min(field.width, field.height) / 68));
  field.canvas.width = Math.max(1, Math.floor(field.width * field.pixelRatio));
  field.canvas.height = Math.max(1, Math.floor(field.height * field.pixelRatio));
  field.canvas.style.width = `${field.width}px`;
  field.canvas.style.height = `${field.height}px`;
  field.context.setTransform(field.pixelRatio, 0, 0, field.pixelRatio, 0, 0);
  resetContourBodies(field);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easePulse(value) {
  const amount = clamp(value, 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function getSettledInteraction() {
  return root.dataset.motion === 'ready' ? 1 : 0.36;
}

function createPointerState() {
  return {
    lastEventTime: 0,
    pressure: 0,
    targetPressure: 0,
    targetVelocityX: 0,
    targetVelocityY: 0,
    targetX: 0.5,
    targetY: 0.5,
    velocityX: 0,
    velocityY: 0,
    x: 0.5,
    y: 0.5,
  };
}

function updatePointerInertia(pointer, dt) {
  const follow = 1 - Math.pow(0.004, dt);
  const pressureFollow = 1 - Math.pow(0.016, dt);
  const velocityFollow = 1 - Math.pow(0.012, dt);
  pointer.x += (pointer.targetX - pointer.x) * follow;
  pointer.y += (pointer.targetY - pointer.y) * follow;
  pointer.pressure += (pointer.targetPressure - pointer.pressure) * pressureFollow;
  pointer.velocityX += (pointer.targetVelocityX - pointer.velocityX) * velocityFollow;
  pointer.velocityY += (pointer.targetVelocityY - pointer.velocityY) * velocityFollow;
  pointer.targetPressure *= Math.pow(0.28, dt);
  pointer.targetVelocityX *= Math.pow(0.16, dt);
  pointer.targetVelocityY *= Math.pow(0.16, dt);

  if (pointer.targetPressure < 0.01) {
    pointer.targetPressure = 0;
  }

  if (Math.hypot(pointer.targetVelocityX, pointer.targetVelocityY) < 0.02) {
    pointer.targetVelocityX = 0;
    pointer.targetVelocityY = 0;
  }
}

function repelContourBodies(field, body, index, dt) {
  const scale = Math.min(field.width, field.height);

  for (let otherIndex = index + 1; otherIndex < field.bodies.length; otherIndex += 1) {
    const other = field.bodies[otherIndex];
    const dx = body.x - other.x;
    const dy = body.y - other.y;
    const distance = Math.hypot(dx, dy) || 1;
    const minDistance = scale * (body.radius + other.radius) * 0.58;
    const gravityRange = scale * 0.72;
    const attraction = Math.max(0, 1 - distance / gravityRange) * 5.4 * dt;
    const pressure = Math.max(0, 1 - distance / minDistance) * 42 * dt;
    const force = pressure - attraction;
    body.vx += (dx / distance) * force;
    body.vy += (dy / distance) * force;
    other.vx -= (dx / distance) * force;
    other.vy -= (dy / distance) * force;
  }
}

function containContourBody(field, body, scale, dt) {
  const margin = scale * 0.14;
  if (body.x < margin) body.vx += (margin - body.x) * 0.018 * dt;
  if (body.x > field.width - margin) body.vx -= (body.x - (field.width - margin)) * 0.018 * dt;
  if (body.y < margin) body.vy += (margin - body.y) * 0.018 * dt;
  if (body.y > field.height - margin) body.vy -= (body.y - (field.height - margin)) * 0.018 * dt;
}

function moveContourBodies(field, driver, pointer, dt) {
  updatePointerInertia(pointer, dt);

  const scale = Math.min(field.width, field.height);
  const settledInteraction = getSettledInteraction();
  const pointerX = pointer.x * field.width;
  const pointerY = pointer.y * field.height;
  const pointerSpeed = clamp(Math.hypot(pointer.velocityX, pointer.velocityY), 0, 1.8);
  const wakeX = pointer.velocityX * scale * (0.032 + settledInteraction * 0.026);
  const wakeY = pointer.velocityY * scale * (0.032 + settledInteraction * 0.026);

  for (let index = 0; index < field.bodies.length; index += 1) {
    const body = field.bodies[index];
    const phase = driver.phase + body.phase;
    const homeX = (body.homeX + Math.sin(phase * 0.28) * 0.052 + Math.cos(phase * 0.11) * 0.024) * field.width;
    const homeY = (body.homeY + Math.cos(phase * 0.24) * 0.046 + Math.sin(phase * 0.15) * 0.02) * field.height;
    const dx = pointerX - body.x;
    const dy = pointerY - body.y;
    const distance = Math.hypot(dx, dy) || 1;
    const pointerRange = scale * (0.52 + settledInteraction * 0.18);
    const pointerInfluence = Math.max(0, 1 - distance / pointerRange) * pointer.pressure * (0.7 + settledInteraction * 0.62);
    const tangent = Math.atan2(dy, dx) + Math.PI / 2;
    const outward = Math.min(scale * (0.014 + settledInteraction * 0.022), distance * 0.026) * pointerInfluence;
    const directionalWake = pointerInfluence * (0.1 + pointerSpeed * (0.13 + settledInteraction * 0.14));

    body.vx +=
      ((homeX - body.x) * 0.026 + Math.cos(tangent) * outward + wakeX * directionalWake + dx * 0.0032 * pointerInfluence) *
      dt /
      body.mass;
    body.vy +=
      ((homeY - body.y) * 0.026 + Math.sin(tangent) * outward + wakeY * directionalWake + dy * 0.0032 * pointerInfluence + scale * 0.018) *
      dt /
      body.mass;
    repelContourBodies(field, body, index, dt);
    containContourBody(field, body, scale, dt);
    body.vx *= 0.988;
    body.vy *= 0.988;
    body.x += body.vx;
    body.y += body.vy;
  }
}

function samplePointerWake(field, x, baseY, phase, pointer) {
  const pressure = pointer.pressure * getSettledInteraction();
  if (pressure < 0.004) {
    return { density: 0, shear: 0, shift: 0 };
  }

  const scale = Math.min(field.width, field.height);
  const speed = clamp(Math.hypot(pointer.velocityX, pointer.velocityY), 0, 1.8);
  const directionX = speed > 0.04 ? pointer.velocityX / speed : 0.92;
  const directionY = speed > 0.04 ? pointer.velocityY / speed : 0.38;
  const pointerX = pointer.x * field.width - directionX * scale * 0.08 * speed;
  const pointerY = pointer.y * field.height - directionY * scale * 0.08 * speed;
  const dx = x - pointerX;
  const dy = baseY - pointerY;
  const along = dx * directionX + dy * directionY;
  const cross = -dx * directionY + dy * directionX;
  const longRadius = scale * (0.32 + speed * 0.04);
  const shortRadius = scale * 0.2;
  const falloff = Math.exp(-((along * along) / (longRadius * longRadius) + (cross * cross) / (shortRadius * shortRadius)));
  const side = cross / (Math.abs(cross) + shortRadius * 0.54);
  const ripple = Math.sin((along / longRadius) * Math.PI * 3.2 + phase * 0.72);

  return {
    density: falloff * pressure * (0.58 + speed * 0.24),
    shear: falloff * pressure * (side * 1.7 + ripple * 0.32),
    shift: (side * 0.72 + ripple * 0.24) * falloff * scale * 0.052 * pressure,
  };
}

function sampleContourField(field, x, baseY, phase, pointer) {
  const scale = Math.min(field.width, field.height);
  let shift = Math.sin(x * 0.0035 + baseY * 0.005 + phase * 0.22) * scale * 0.014;
  let density = 0;
  let shear = 0;

  for (const body of field.bodies) {
    const dx = x - body.x;
    const dy = baseY - body.y;
    const radius = scale * body.radius;
    const distanceSquared = dx * dx + dy * dy;
    const falloff = Math.exp(-distanceSquared / (radius * radius * 1.18));
    const side = dy / (Math.abs(dy) + radius * 0.46);
    const wave = Math.sin((dx / radius) * Math.PI * 1.25 + body.phase + phase * 0.18);
    shift += (side * 0.34 + wave * 0.3) * falloff * radius * body.gravity;
    shear += Math.cos((dx / radius) * 1.7 + phase + body.phase) * falloff;
    density += falloff * body.gravity * (0.76 + Math.abs(side) * 0.34);
  }

  const pointerWake = samplePointerWake(field, x, baseY, phase, pointer);
  shift += pointerWake.shift;
  shear += pointerWake.shear;
  density += pointerWake.density;

  return {
    density,
    shear,
    y: baseY + shift,
  };
}

function samplePassivePulse(field, baseY, lineIndex, driver) {
  const normalizedY = baseY / Math.max(1, field.height);
  const gate = Math.pow(Math.max(0, Math.sin(driver.phase * 0.17 - 0.4)), 3.4);
  const band = Math.pow(Math.max(0, Math.cos(normalizedY * Math.PI * 2.25 - driver.phase * 0.38 + lineIndex * 0.015)), 4);
  return gate * band;
}

function sampleActivePulse(field, y, driver) {
  if (!driver.pulses || driver.pulses.length === 0) {
    return { alpha: 0, shift: 0 };
  }

  const height = Math.max(1, field.height);
  let alpha = 0;
  let shift = 0;

  for (const pulse of driver.pulses) {
    const age = driver.time - pulse.start;
    if (age < 0 || age > pulse.duration) continue;

    const progress = age / pulse.duration;
    const centerY = (-0.14 + progress * 1.28) * height;
    const spread = height * (0.04 + progress * 0.018);
    const distance = (y - centerY) / spread;
    const band = Math.exp(-(distance * distance));
    const envelope = Math.sin(Math.PI * progress) * (0.72 + easePulse(progress) * 0.28);
    const amount = band * envelope * pulse.force;
    alpha += amount;
    shift += amount * field.lineSpacing * 1.9;
  }

  return { alpha, shift };
}

function pruneContourPulses(driver) {
  if (!driver.pulses || driver.pulses.length === 0) return;
  driver.pulses = driver.pulses.filter((pulse) => driver.time - pulse.start <= pulse.duration + 0.2);
}

function drawContourLevel(field, baseY, lineIndex, driver, strength, pointer) {
  const { context, height, lineSpacing, width } = field;
  const margin = lineSpacing * 4;
  const sampleStep = Math.max(12, Math.min(24, width / 70));
  const points = [];
  let maxDensity = 0;
  let pulseTotal = 0;
  let shearTotal = 0;

  for (let x = -margin; x <= width + margin; x += sampleStep) {
    const pulse = sampleActivePulse(field, baseY, driver);
    const waveY =
      baseY +
      Math.sin(x * 0.005 + lineIndex * 0.41 + driver.phase * 0.2) * lineSpacing * 0.6 +
      Math.sin(x * 0.0017 - lineIndex * 0.23 + driver.phase * 0.13) * lineSpacing * 0.92 +
      Math.sin(x * 0.0042 + driver.phase + lineIndex * 0.17) * pulse.shift;
    const sample = sampleContourField(field, x, waveY, driver.phase + lineIndex * 0.19, pointer);
    maxDensity = Math.max(maxDensity, sample.density);
    pulseTotal += pulse.alpha;
    shearTotal += Math.abs(sample.shear);
    points.push({ x, y: clamp(sample.y, -margin, height + margin) });
  }

  if (points.length < 3) return;

  const shearAverage = shearTotal / points.length;
  const pulseAverage = pulseTotal / points.length;
  const passivePulse = samplePassivePulse(field, baseY, lineIndex, driver);
  const alphaWave = Math.sin(lineIndex * 0.73 + driver.outward * Math.PI * 2) * 0.035;
  const alpha = clamp(
    0.11 + alphaWave + passivePulse * 0.072 + pulseAverage * 0.16 + maxDensity * 0.056 + shearAverage * 0.025 + strength * 0.024,
    0.045,
    0.42,
  );
  const lineWidth = clamp(0.34 + maxDensity * 0.1 + pulseAverage * 0.08, 0.34, 0.78);

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
  }

  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.strokeStyle = `rgba(244, 197, 57, ${alpha})`;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawContourLines(field, driver, strength, pointer) {
  const { height, lineSpacing } = field;
  const phase = driver.outward * Math.PI * 2;
  let y = -height * 0.18;
  let lineIndex = 0;
  field.context.save();
  field.context.lineCap = 'round';
  field.context.lineJoin = 'round';

  while (y < height * 1.18) {
    const variance =
      1 +
      Math.sin(lineIndex * 0.59 + phase) * 0.28 +
      Math.sin(lineIndex * 1.31 - phase * 0.37) * 0.18 +
      Math.cos(lineIndex * 0.17) * 0.1;
    y += lineSpacing * clamp(variance, 0.58, 1.54);
    drawContourLevel(field, y, lineIndex, driver, strength, pointer);
    lineIndex += 1;
  }

  field.context.restore();
}

function drawContourFrame(field, driver, pointer, reducedMotionQuery, time = 0) {
  resizeContourCanvas(field);
  const dt = Math.min(0.04, Math.max(0.012, time - field.lastTime || 0.016));
  field.lastTime = time;
  driver.time = time;
  pruneContourPulses(driver);
  field.context.clearRect(0, 0, field.width, field.height);

  if (!reducedMotionQuery.matches) {
    moveContourBodies(field, driver, pointer, dt);
  }

  const strength = reducedMotionQuery.matches ? 0.12 : Math.max(driver.pressure, pointer.pressure);
  drawContourLines(field, driver, strength, pointer);
}

function drawStillContours(field) {
  resizeContourCanvas(field);
  field.context.clearRect(0, 0, field.width, field.height);
  resetContourBodies(field);
  drawContourFrame(
    field,
    { outward: 0.36, phase: 0.2, pressure: 0.08 },
    createPointerState(),
    { matches: true },
  );
}

function setupContourAccent(gsapApi, reducedMotionQuery, animateWithoutGsap = false) {
  const canvas = document.getElementById('hairline-accent');
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  const field = createContourState(canvas, context);
  const driver = { outward: 0, phase: 0, pressure: 0.14, pulses: [], time: 0 };
  const pointer = createPointerState();
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
        pressure: 0.18,
        duration: 46,
        ease: 'none',
        repeat: -1,
      })
    : null;
  let animationFrameId = 0;
  const triggerContourPulse = (force = 1) => {
    const start = driver.time || window.performance.now() / 1000;
    driver.pulses.push({ duration: 2.35, force, start });

    if (driver.pulses.length > 5) {
      driver.pulses.splice(0, driver.pulses.length - 5);
    }
  };
  const onPointerMove = (event) => {
    const nextX = event.clientX / Math.max(1, field.width);
    const nextY = event.clientY / Math.max(1, field.height);
    const deltaX = nextX - pointer.targetX;
    const deltaY = nextY - pointer.targetY;
    const elapsed = Math.max(16, event.timeStamp - pointer.lastEventTime);
    const velocityScale = 1000 / elapsed;
    const distance = Math.hypot(deltaX, deltaY);
    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.lastEventTime = event.timeStamp;
    pointer.targetVelocityX = clamp(deltaX * velocityScale, -1.8, 1.8);
    pointer.targetVelocityY = clamp(deltaY * velocityScale, -1.8, 1.8);
    const settledInteraction = getSettledInteraction();
    const targetLimit = 0.28 + settledInteraction * 0.2;
    pointer.targetPressure = Math.min(
      targetLimit,
      0.036 + distance * (1.35 + settledInteraction * 0.76) + Math.hypot(pointer.targetVelocityX, pointer.targetVelocityY) * (0.03 + settledInteraction * 0.034),
    );
  };
  const onPointerLeave = () => {
    pointer.targetPressure = 0;
    pointer.targetVelocityX = 0;
    pointer.targetVelocityY = 0;
  };
  const routeLinks = Array.from(document.querySelectorAll('[data-route-link]'));
  const onRoutePulse = () => triggerContourPulse(1);

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  for (const link of routeLinks) {
    link.addEventListener('pointerenter', onRoutePulse, { passive: true });
    link.addEventListener('focus', onRoutePulse);
  }

  if (gsapApi) {
    gsapApi.ticker.add(advanceContours);
  } else {
    const tickContours = (time) => {
      const seconds = time / 1000;
      driver.outward = (seconds * 0.032) % 1;
      driver.phase = seconds * 0.15;
      driver.pressure = 0.14 + Math.sin(seconds * 0.18) * 0.035;
      advanceContours(seconds);
      animationFrameId = window.requestAnimationFrame(tickContours);
    };

    animationFrameId = window.requestAnimationFrame(tickContours);
  }

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    for (const link of routeLinks) {
      link.removeEventListener('pointerenter', onRoutePulse);
      link.removeEventListener('focus', onRoutePulse);
    }
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
