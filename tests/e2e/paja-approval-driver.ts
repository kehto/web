import type { Page } from '@playwright/test';

/** Storage key of Paja's default Firewall rules. */
const RULES_KEY = 'kehto:paja:firewall-rules:v1';

/** Approve Paja session prompts in browser scenarios testing other behavior. */
export async function installPajaApprovalDriver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const approve = () => {
        const dialog = document.querySelector<HTMLDialogElement>('.kehto-approval-ui dialog[open]');
        if (!dialog) return;
        const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
        const allow = buttons.find((button) => button.textContent === 'Allow');
        if (!allow) return;
        // Operation prompts preselect "just this once"; keep the session-wide
        // approval these scenarios were written against.
        buttons.find((button) => button.value === 'session')?.click();
        allow.click();
      };
      const observer = new MutationObserver(approve);
      observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
      approve();
    }, { once: true });
  });
}

/**
 * Replace Paja's shipped default rules (allow, ask before opening a link) with
 * "ask about everything", for scenarios that exercise the prompts themselves.
 */
export async function installPajaAskEverythingRules(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (window !== window.top || localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 1, default: 'ask', domains: {}, operations: {}, napplets: {} }));
  }, RULES_KEY);
}
