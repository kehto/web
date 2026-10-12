/* Deterministic film artwork. window.renderFrame(seconds) is the export API. */
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const green = '#b9f66b';
const white = '#eaf1e0';
const muted = '#98aa8c';
const runtimeImage = new Image();
const themeImage = new Image();
runtimeImage.src = 'captures/runtime.png';
themeImage.src = 'captures/theme.png';
window.assetsReady = Promise.all([
  runtimeImage.decode(),
  themeImage.decode(),
]);
const clamp = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

function text(value, x, y, size = 20, color = white, mono = false) {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${mono ? 'monospace' : 'Arial'}`;
  ctx.fillText(value, x, y);
}
function line(x, y, x2, y2, color = '#36452e') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function rect(x, y, w, h, color, border) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
}
function background(time) {
  ctx.fillStyle = '#151c15';
  ctx.fillRect(0, 0, 1200, 1000);
  for (let x = 0; x < 1200; x += 50) line(x, 0, x, 1000, '#1c261b');
  for (let y = 0; y < 1000; y += 50) line(0, y, 1200, y, '#1c261b');
  text('kernl', 48, 68, 32, white);
  text('RUNTIME ASSEMBLY / 001', 780, 62, 15, muted, true);
  line(48, 906, 1152, 906);
  line(48, 906, 48 + 1104 * clamp(time / 38), 906, green);
  text('COMPOSE. CONNECT. RUN.', 48, 950, 15, muted, true);
  text(
    `${String(Math.floor(time)).padStart(2, '0')} / 38`,
    1045,
    950,
    15,
    green,
    true
  );
}
function tile(x, y, options, time) {
  const { width, height, fill, label, index } = options;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -height);
  ctx.lineTo(width, 0);
  ctx.lineTo(0, height);
  ctx.lineTo(-width, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#71845b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-width, 0);
  ctx.lineTo(0, height);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, 13);
  ctx.lineTo(0, height + 13);
  ctx.lineTo(-width, 13);
  ctx.closePath();
  ctx.fillStyle = '#24361d';
  ctx.fill();
  ctx.stroke();
  for (let j = -3; j <= 3; j++) {
    const k = j / 4;
    line(
      (k * width) / 2 - width / 2,
      (k * height) / 2 + height / 2,
      (k * width) / 2 + width / 2,
      (k * height) / 2 - height / 2,
      '#71895866'
    );
  }
  ctx.fillStyle = index === 3 ? '#172311' : green;
  ctx.beginPath();
  ctx.arc(0, 0, 8 + 2 * Math.sin(time * 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  line(
    x + width * 0.7,
    y + height * 0.3,
    x + width + 55,
    y + height * 0.3,
    '#6b8157'
  );
  text(label, x + width + 65, y + height * 0.3 + 5, 17, white, true);
}
function assembly(time) {
  const settle = ease((time - 2) / 3);
  text(
    time < 3 ? 'Start with a kernl.' : 'A few parts. Your runtime.',
    48,
    160,
    43
  );
  text('Independent modules. One connected host.', 48, 205, 20, muted);
  const labels = ['runtime', 'permissions', 'services', 'your shell'];
  for (let i = 0; i < 4; i++) {
    const arrival = ease((time - i * 0.3) / 1.5);
    ctx.globalAlpha = arrival;
    const y = 725 - i * (76 + 18 * (1 - settle));
    tile(
      470 + (1 - arrival) * (i % 2 ? 450 : -450),
      y,
      {
        width: 265,
        height: 105,
        fill: i === 3 ? '#afd978' : ['#344929', '#435e31', '#638c41'][i],
        label: labels[i],
        index: i,
      },
      time
    );
  }
  ctx.globalAlpha = 1;
  text('01', 48, 850, 17, green, true);
  text('Choose the pieces you need.', 98, 850, 20, white);
}
function codeScene(time, theme) {
  const start = theme ? 11 : 6;
  const p = ease((time - start) / 0.7);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(0, (1 - p) * 35);
  text(
    theme ? 'Give your apps a shared world.' : 'Connect your host.',
    48,
    160,
    43
  );
  text(
    theme
      ? 'Host services. Available through the sandbox.'
      : 'Your backends. Your interface. Your policies.',
    48,
    205,
    20,
    muted
  );
  rect(75, 282, 1050, 390, '#202b1d', '#4c643f');
  text('host.ts', 108, 323, 18, green, true);
  text('INTEGRATION EXCERPT', 840, 323, 13, muted, true);
  line(75, 349, 1125, 349, '#4c643f');
  const lines = theme
    ? [
        ['const service = createThemeService({', white],
        ['  initialTheme: theme,', green],
        ['});', white],
        ['bridge.runtime.registerService(', white],
        ["  'theme', service.handler);", green],
      ]
    : [
        ["import { createShellBridge } from '@kehto/shell';", green],
        ['', white],
        ['const bridge = createShellBridge(adapter);', white],
        ["window.addEventListener('message',", white],
        ['  bridge.handleMessage);', white],
      ];
  lines.forEach(([value, color], index) => {
    ctx.globalAlpha = p * ease((time - start - 0.15 * index) / 0.5);
    text(value, 108, 402 + index * 46, 23, color, true);
  });
  ctx.globalAlpha = p;
  const labels = theme
    ? ['APP', 'CAPABILITY CHECK', 'THEME SERVICE']
    : ['YOUR ADAPTER', 'SHELL BRIDGE', 'RUNTIME'];
  labels.forEach((label, index) => {
    rect(75 + index * 385, 742, 280, 62, '#24331d', '#597443');
    text(label, 95 + index * 385, 779, 16, white, true);
    if (index < 2) {
      line(355 + index * 385, 773, 460 + index * 385, 773, '#668d47');
      const x = 355 + index * 385 + (((time - start) % 1.5) / 1.5) * 105;
      rect(x, 769, 8, 8, green);
    }
  });
  text(theme ? '03' : '02', 48, 850, 17, green, true);
  text(
    theme
      ? 'Register the services your apps need.'
      : 'Wire the engine to your host.',
    98,
    850,
    20
  );
  ctx.restore();
}
// Coordinates refer to the real 1440 × 1000 browser capture. These regions
// illustrate package responsibilities; bench supplies their visual interface.
const benchLayers = [
  {
    title: 'Runtime',
    pkg: '@kehto/runtime',
    detail: 'Routing & app lifecycle',
    start: 16,
    regions: [
      [0, 38, 380, 102],
      [0, 714, 380, 256],
      [0, 970, 1440, 30],
    ],
  },
  {
    title: 'Shell',
    pkg: '@kehto/shell',
    detail: 'Connect the sandbox',
    start: 18,
    regions: [
      [0, 0, 380, 38],
      [380, 38, 1060, 932],
    ],
  },
  {
    title: 'ACL',
    pkg: '@kehto/acl',
    detail: 'Choose app permissions',
    start: 20,
    regions: [[0, 308, 380, 286]],
  },
  {
    title: 'Identity',
    pkg: '@kehto/services',
    detail: 'Connect a host identity',
    start: 22,
    regions: [[0, 594, 380, 120]],
  },
  {
    title: 'Services',
    pkg: '@kehto/services',
    detail: 'Theme, storage, media…',
    start: 24,
    regions: [[0, 140, 380, 168]],
  },
  {
    title: 'Windows',
    pkg: '@kehto/wm',
    detail: 'Manage app tabs',
    start: 26,
    regions: [[380, 0, 1060, 38]],
  },
];

function drawCaptureRegion(region, progress, destination, highlight) {
  const [sx, sy, sw, sh] = region;
  const [x, y, scale] = destination;
  const dx = x + sx * scale + (1 - progress) * 90;
  const dy = y + sy * scale - (1 - progress) * 35;
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.shadowColor = '#00000066';
  ctx.shadowBlur = (1 - progress) * 30;
  ctx.drawImage(runtimeImage, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
  ctx.shadowBlur = 0;
  if (highlight > 0) {
    ctx.globalAlpha = highlight;
    ctx.strokeStyle = green;
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, dy, sw * scale, sh * scale);
  }
  ctx.restore();
}

function layerLabel(layer, index, time, destination) {
  const progress = ease((time - layer.start) / 1.1);
  const active = time >= layer.start && time < layer.start + 2;
  const y = 278 + index * 91;
  ctx.save();
  ctx.globalAlpha *= time < layer.start ? 0.24 : 1;
  rect(
    48,
    y,
    330,
    79,
    active ? '#2c4023' : '#1d291c',
    active ? green : '#3b5032'
  );
  text(layer.title, 66, y + 28, 22, active ? green : white);
  text(layer.pkg, 66, y + 51, 17, white, true);
  text(layer.detail, 66, y + 69, 13, muted);
  text(
    time >= layer.start + 1.1 ? '✓' : String(index + 1).padStart(2, '0'),
    340,
    y + 29,
    17,
    green
  );
  ctx.restore();
  if (!active) return;
  const [sx, sy, sw, sh] = layer.regions[0];
  const [x, top, scale] = destination;
  const tx = x + (sx + sw / 2) * scale;
  const ty = top + (sy + sh / 2) * scale;
  ctx.save();
  ctx.globalAlpha *= 0.8;
  line(378, y + 40, 405, y + 40, green);
  line(405, y + 40, 405, ty, green);
  line(405, ty, tx, ty, green);
  rect(405 + (tx - 405) * progress - 4, ty - 4, 8, 8, green);
  ctx.restore();
}

function runtimeScene(time) {
  const assembled = ease((time - 28) / 1.2);
  text(
    assembled > 0.8
      ? 'bench. Built with kernl.'
      : 'Build a runtime. Piece by piece.',
    48,
    160,
    43
  );
  text('bench · the developer runtime', 48, 205, 22, muted);
  const destination = [
    430 - assembled * 250,
    310 - assembled * 65,
    0.5 + assembled / 12,
  ];
  const [x, y, scale] = destination;
  rect(x, y, 1440 * scale, 1000 * scale, '#10160f', '#4c643f');
  // Ghost outlines preserve the destination while the actual screenshot pieces arrive.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.drawImage(runtimeImage, x, y, 1440 * scale, 1000 * scale);
  ctx.restore();
  benchLayers.forEach((layer, index) => {
    const progress = ease((time - layer.start) / 1.1);
    const highlight = clamp(1 - (time - layer.start - 1.1) / 0.9);
    layer.regions.forEach((region) =>
      drawCaptureRegion(region, progress, destination, progress * highlight)
    );
    ctx.save();
    ctx.globalAlpha = 1 - assembled;
    layerLabel(layer, index, time, destination);
    ctx.restore();
  });
  if (time >= 29.4) {
    ctx.save();
    ctx.globalAlpha = ease((time - 29.4) / 0.5);
    ctx.drawImage(themeImage, x, y, 1440 * scale, 1000 * scale);
    ctx.restore();
  }
  if (time < 28) {
    text('kernl packages → bench interface', 440, 851, 19, green, true);
    text(
      'The building blocks supply behavior. bench supplies the UI.',
      440,
      878,
      15,
      muted
    );
  } else {
    rect(180, 825, 840, 58, green);
    text(
      time < 29.4
        ? 'One developer runtime. Your choice of parts.'
        : '✓ Theme requested. Host service reached.',
      205,
      862,
      23,
      '#1b2814'
    );
  }
}
function closing(time) {
  const p = ease((time - 32) / 0.7);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(0, (1 - p) * 20);
  for (let i = 0; i < 4; i++)
    rect(48 + (i % 2) * 38, 282 + Math.floor(i / 2) * 38, 30, 30, green);
  text('kernl', 150, 348, 94);
  text('Your runtime. Your rules.', 48, 433, 49);
  const identities = [
    ['SOURCE', 'github.com/kernlize/web'],
    ['NPM', 'npmjs.com/org/kernlize/'],
    ['JSR', 'jsr.io/@kernl'],
  ];
  identities.forEach(([label, url], index) => {
    ctx.globalAlpha = p * ease((time - 32.5 - index * 0.35) / 0.6);
    const y = 540 + index * 100;
    line(48, y, 1152, y, '#415536');
    text(label, 48, y + 54, 16, muted, true);
    text(url, 225, y + 58, 34, green, true);
    text('↗', 1108, y + 58, 32, green);
  });
  ctx.restore();
}
window.renderFrame = (time) => {
  background(time);
  if (time < 6) assembly(time);
  else if (time < 11) codeScene(time, false);
  else if (time < 16) codeScene(time, true);
  else if (time < 32) runtimeScene(time);
  else closing(time);
};
window.renderFrame(4);
