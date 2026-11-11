import type { Page } from '@playwright/test';

/** Approve Paja session prompts in browser scenarios testing other behavior. */
export async function installPajaApprovalDriver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const approve = () => {
        const dialog = document.querySelector<HTMLDialogElement>('.kehto-approval-ui dialog[open]');
        if (!dialog) return;
        const lifetime = dialog.querySelector('select');
        if (!lifetime || ![...lifetime.options].some((option) => option.value === 'session')) return;
        const allow = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
          .find((button) => button.textContent === 'Allow');
        if (!allow) return;
        lifetime.value = 'session';
        lifetime.dispatchEvent(new Event('change', { bubbles: true }));
        allow.click();
      };
      const observer = new MutationObserver(approve);
      observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
      approve();
    }, { once: true });
  });
}
