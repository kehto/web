const ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 6h10c3 0 5 10 3 12-2 2-5-3-6-3h-4c-1 0-4 5-6 3C2 16 4 6 7 6Z"/><path d="M7 9v6m-3-3h6"/><circle cx="16" cy="10" r="1" fill="currentColor"/><circle cx="19" cy="13" r="1" fill="currentColor"/></svg>';

/**
 * Show native controller activity in the host toolbar, independently of napplet subscriptions.
 * @returns Cleanup for polling and host lifecycle listeners.
 * @example const dispose = installPajaGamepadIndicators();
 */
export function installPajaGamepadIndicators(): () => void {
  const container = document.getElementById('paja-gamepads');
  if (!container || typeof navigator.getGamepads !== 'function') return () => {
    // No listeners or polling were installed on unsupported hosts.
  };
  const icons = new Map<number, HTMLElement>();
  const activeUntil = new Map<number, number>();
  let frame: number | undefined;
  let disposed = false;

  const makeIcon = (pad: Gamepad): HTMLElement => {
    const icon = document.createElement('span');
    icon.className = 'gamepad-indicator';
    icon.dataset.gamepadIndex = String(pad.index);
    icon.setAttribute('role', 'img');
    // Slot identity survives sparse lists and unrelated disconnects. Distinct
    // hues and motion parameters also distinguish controllers of the same model.
    icon.style.setProperty('--pad-color', `hsl(${(pad.index * 137.508 + 155) % 360} 75% 70%)`);
    icon.style.setProperty('--pad-turn', `${(pad.index % 2 ? -1 : 1) * (6 + pad.index * 2)}deg`);
    icon.style.setProperty('--pad-lift', `${-2 - pad.index % 4}px`);
    icon.style.setProperty('--pad-duration', `${480 + pad.index * 85}ms`);
    icon.innerHTML = ICON;
    const number = document.createElement('small');
    number.textContent = String(pad.index + 1);
    icon.append(number);
    container.append(icon);
    icons.set(pad.index, icon);
    return icon;
  };

  const sample = (): void => {
    let pads: (Gamepad | null)[];
    try {
      pads = Array.from(navigator.getGamepads());
    } catch {
      // Browsers may expose the method but deny access through host policy.
      pads = [];
    }
    const connected = new Set<number>();
    const focused = document.visibilityState !== 'hidden' && document.hasFocus();
    const now = performance.now();
    for (const pad of pads) {
      if (!pad?.connected) continue;
      connected.add(pad.index);
      const icon = icons.get(pad.index) ?? makeIcon(pad);
      const input = focused && (pad.axes.some((axis) => Math.abs(axis) > 0.12)
        || pad.buttons.some((button) => button.pressed || button.value > 0.05));
      // Keep quick taps visible long enough to identify their controller.
      if (input) activeUntil.set(pad.index, now + 420);
      if (!focused) activeUntil.delete(pad.index);
      const active = now < (activeUntil.get(pad.index) ?? 0);
      const activity = active ? 'active' : 'idle';
      if (icon.dataset.activity !== activity || icon.dataset.model !== pad.id) {
        icon.dataset.activity = activity;
        icon.dataset.model = pad.id;
        const label = `Controller ${pad.index + 1}: ${pad.id} — ${activity}`;
        icon.setAttribute('aria-label', label);
        icon.title = label;
      }
    }
    for (const [index, icon] of icons) {
      if (connected.has(index)) continue;
      icon.remove();
      icons.delete(index);
      activeUntil.delete(index);
    }
  };

  const tick = (): void => {
    frame = undefined;
    if (disposed) return;
    sample();
    if (document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick);
  };
  const refresh = (): void => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    tick();
  };
  const events = ['gamepadconnected', 'gamepaddisconnected', 'focus', 'blur'];
  for (const event of events) window.addEventListener(event, refresh);
  document.addEventListener('visibilitychange', refresh);
  tick();
  return () => {
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    for (const event of events) window.removeEventListener(event, refresh);
    document.removeEventListener('visibilitychange', refresh);
    container.replaceChildren();
    icons.clear();
    activeUntil.clear();
  };
}
