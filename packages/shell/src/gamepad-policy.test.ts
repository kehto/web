import { describe, expect, it } from 'vitest';
import { denyNappletControllerAccess } from './gamepad-policy.js';

describe('napplet controller Permissions-Policy', () => {
  it('denies native controller paths, preserves other features and is idempotent', () => {
    let allow = "camera 'none'; gamepad *; hid https://example.com; usb *";
    const frame = { getAttribute: () => allow, setAttribute: (_name: string, value: string) => { allow = value; } };
    denyNappletControllerAccess(frame);
    expect(allow).toBe("camera 'none'; gamepad 'none'; hid 'none'; usb 'none'");
    denyNappletControllerAccess(frame);
    expect(allow).toBe("camera 'none'; gamepad 'none'; hid 'none'; usb 'none'");
  });
});
