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
window.assetsReady = Promise.all([runtimeImage.decode(), themeImage.decode()]);
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
  line(48, 906, 48 + 1104 * clamp(time / 24), 906, green);
  text('COMPOSE. CONNECT. RUN.', 48, 950, 15, muted, true);
  text(
    `${String(Math.floor(time)).padStart(2, '0')} / 24`,
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
function runtimeScene(time) {
  const p = ease((time - 16) / 0.7);
  text('And now, it runs.', 48, 160, 43);
  text('Paja · a real runtime built with kernl', 48, 205, 20, muted);
  ctx.save();
  ctx.globalAlpha = p;
  const scale = 1 + 0.035 * clamp((time - 16) / 5);
  ctx.beginPath();
  ctx.rect(75, 270, 1050, 515);
  ctx.clip();
  ctx.translate(600, 520);
  ctx.scale(scale, scale);
  ctx.drawImage(time < 18.4 ? runtimeImage : themeImage, -510, -275, 1020, 708);
  ctx.restore();
  rect(75, 816, 1050, 60, '#b9f66b');
  text(
    time < 18.4
      ? '✓ shell.ready → shell.init · app connected'
      : '✓ theme.get → theme.get.result · host service reached',
    98,
    854,
    20,
    '#1b2814',
    true
  );
}
function closing(time) {
  const p = ease((time - 21) / 0.65);
  ctx.save();
  ctx.globalAlpha = p;
  for (let i = 0; i < 4; i++)
    rect(480 + (i % 2) * 124, 285 + Math.floor(i / 2) * 124, 104, 104, green);
  text('Your runtime.', 235, 655, 100);
  text('Your rules.', 315, 757, 100);
  text('BUILD WITH KERNL', 453, 837, 20, green, true);
  ctx.restore();
}
window.renderFrame = (time) => {
  background(time);
  if (time < 6) assembly(time);
  else if (time < 11) codeScene(time, false);
  else if (time < 16) codeScene(time, true);
  else if (time < 21) runtimeScene(time);
  else closing(time);
};
window.renderFrame(4);
