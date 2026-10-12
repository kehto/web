/** Deny direct controller paths to napplet frames; NAP-GAMEPAD Security Considerations. */
const CONTROLLER_FEATURES = ['gamepad', 'hid', 'usb'] as const;

/**
 * Restrict native controller/device APIs before assigning a napplet document.
 * @param frame Host-owned iframe, before its authored code executes.
 * @returns Nothing; unrelated Permissions-Policy entries are retained.
 * @example denyNappletControllerAccess(frame);
 */
export function denyNappletControllerAccess(frame: Pick<HTMLIFrameElement, 'getAttribute' | 'setAttribute'>): void {
  const remaining = (frame.getAttribute('allow') ?? '').split(';').map((entry) => entry.trim()).filter((entry) => entry && !CONTROLLER_FEATURES.some((feature) => entry === feature || entry.startsWith(`${feature} `)));
  frame.setAttribute('allow', [...remaining, ...CONTROLLER_FEATURES.map((feature) => `${feature} 'none'`)].join('; '));
}
