import { describe, expect, it } from 'vitest';
import { pajaIntentHandlerGroups } from './browser-intent-handlers-panel.js';
import type { InstalledNappletRecord } from './installed-napplet-catalog.js';

// NAP-INTENT napplet/naps master 377bf939: user-owned default per archetype (kehto/web#523).
function record(id: string, title: string | undefined, archetypes: [string, string][]): InstalledNappletRecord {
  return {
    id,
    dTag: id.split(':').at(-1) ?? id,
    aggregateHash: 'a'.repeat(64),
    pointer: { type: 'naddr', value: `naddr-${id}`, identifier: id, pubkey: 'b'.repeat(64), kind: 35129, relays: [] },
    ...(title === undefined ? {} : { title }),
    requires: ['intent'],
    archetypes: archetypes.map(([slug, convention]) => ({ slug, convention, params: [] })),
  };
}

describe('pajaIntentHandlerGroups', () => {
  const reader = record('nip5d:35129:pk:reader', 'Reader', [['note', 'napplet:note/open']]);
  const editor = record('nip5d:35129:pk:editor', 'Editor', [['note', 'napplet:note/open'], ['note', 'napplet:note/edit']]);
  const profile = record('nip5d:35129:pk:profile', undefined, [['profile', 'napplet:profile/open']]);

  it('groups installed handlers per archetype with the default first', () => {
    const defaults = new Map([['note', editor.id]]);
    expect(pajaIntentHandlerGroups([reader, editor, profile], (archetype) => defaults.get(archetype))).toEqual([
      {
        archetype: 'note',
        defaultId: editor.id,
        handlers: [
          { id: editor.id, title: 'Editor', conventions: ['napplet:note/edit', 'napplet:note/open'], isDefault: true },
          { id: reader.id, title: 'Reader', conventions: ['napplet:note/open'], isDefault: false },
        ],
      },
      {
        archetype: 'profile',
        handlers: [{ id: profile.id, title: 'profile', conventions: ['napplet:profile/open'], isDefault: false }],
      },
    ]);
  });

  it('does not show a saved default whose handler is not installed', () => {
    const [group] = pajaIntentHandlerGroups([reader], () => 'nip5d:35129:pk:gone');
    expect(group.defaultId).toBeUndefined();
    expect(group.handlers.every((handler) => !handler.isDefault)).toBe(true);
  });

  it('lists nothing when no installed app advertises an intent', () => {
    expect(pajaIntentHandlerGroups([record('nip5d:35129:pk:plain', 'Plain', [])], () => undefined)).toEqual([]);
  });
});
