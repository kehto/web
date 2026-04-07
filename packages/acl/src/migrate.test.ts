import { describe, it, expect } from 'vitest';
import { migrateAclState } from './migrate.js';
import type { AclState } from './types.js';

describe('migrateAclState — no migration needed', () => {
  it('returns same reference when entries is empty', () => {
    const state: AclState = { defaultPolicy: 'permissive', entries: {} };
    expect(migrateAclState(state)).toBe(state);
  });

  it('returns same reference when all entries are 2-segment keys', () => {
    const state: AclState = {
      defaultPolicy: 'restrictive',
      entries: {
        'chat:ff00': { caps: 1, blocked: false, quota: 524288 },
        'notes:ab12': { caps: 33, blocked: false, quota: 524288 },
      },
    };
    expect(migrateAclState(state)).toBe(state);
  });

  it('is idempotent — running on already-migrated state returns same reference', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'chat:e3b0c4': { caps: 1023, blocked: false, quota: 524288 },
      },
    };
    const once = migrateAclState(state);
    const twice = migrateAclState(once);
    expect(once).toBe(state);
    expect(twice).toBe(once);
  });
});

describe('migrateAclState — single key migration', () => {
  it('converts one 3-segment key to 2-segment key', () => {
    const entry = { caps: 33, blocked: false, quota: 524288 };
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'abc123:chat:ff00': entry,
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated).not.toBe(state);
    expect(migrated.entries['chat:ff00']).toBeDefined();
    expect(migrated.entries['abc123:chat:ff00']).toBeUndefined();
  });

  it('preserves entry values during single key migration', () => {
    const entry = { caps: 33, blocked: false, quota: 1048576 };
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pubkey:chat:ff00': entry,
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.entries['chat:ff00']).toEqual(entry);
  });

  it('preserves defaultPolicy through migration', () => {
    const state: AclState = {
      defaultPolicy: 'restrictive',
      entries: {
        'pubkey:chat:ff00': { caps: 1, blocked: false, quota: 524288 },
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.defaultPolicy).toBe('restrictive');
  });
});

describe('migrateAclState — multiple key migration', () => {
  it('migrates multiple old keys independently', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pubkey1:chat:ff00': { caps: 1, blocked: false, quota: 524288 },
        'pubkey2:notes:ab12': { caps: 33, blocked: false, quota: 524288 },
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.entries['chat:ff00']).toBeDefined();
    expect(migrated.entries['notes:ab12']).toBeDefined();
    expect(Object.keys(migrated.entries)).toHaveLength(2);
  });

  it('resulting entries all have 2-segment keys', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 1, blocked: false, quota: 524288 },
        'pk2:notes:ab12': { caps: 2, blocked: false, quota: 524288 },
        'pk3:feed:cd34': { caps: 4, blocked: false, quota: 524288 },
      },
    };
    const migrated = migrateAclState(state);
    const keys = Object.keys(migrated.entries);
    expect(keys.every(k => k.split(':').length === 2)).toBe(true);
  });
});

describe('migrateAclState — merge behavior', () => {
  it('ORs caps when two old keys map to same dTag:hash', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 0b0000_0001, blocked: false, quota: 524288 }, // CAP_RELAY_READ
        'pk2:chat:ff00': { caps: 0b0010_0000, blocked: false, quota: 524288 }, // CAP_SIGN_EVENT
      },
    };
    const migrated = migrateAclState(state);
    expect(Object.keys(migrated.entries)).toHaveLength(1);
    // caps should be OR: 0b0010_0001 = 33
    expect(migrated.entries['chat:ff00'].caps).toBe(0b0010_0001);
  });

  it('ORs blocked flag — blocks if either source was blocked', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 1, blocked: true, quota: 524288 },
        'pk2:chat:ff00': { caps: 2, blocked: false, quota: 524288 },
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.entries['chat:ff00'].blocked).toBe(true);
  });

  it('ORs blocked flag — not blocked if neither source was blocked', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 1, blocked: false, quota: 524288 },
        'pk2:chat:ff00': { caps: 2, blocked: false, quota: 524288 },
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.entries['chat:ff00'].blocked).toBe(false);
  });

  it('MAXes quota when two old keys map to same dTag:hash', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 1, blocked: false, quota: 524288 },
        'pk2:chat:ff00': { caps: 2, blocked: false, quota: 1048576 },
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.entries['chat:ff00'].quota).toBe(1048576);
  });

  it('three old keys mapping to same dTag:hash merge all correctly', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 0b001, blocked: false, quota: 100 },
        'pk2:chat:ff00': { caps: 0b010, blocked: true,  quota: 200 },
        'pk3:chat:ff00': { caps: 0b100, blocked: false, quota: 150 },
      },
    };
    const migrated = migrateAclState(state);
    const entry = migrated.entries['chat:ff00'];
    expect(entry.caps).toBe(0b111);    // OR of all three
    expect(entry.blocked).toBe(true);  // OR — blocked because pk2 was blocked
    expect(entry.quota).toBe(200);     // MAX
  });
});

describe('migrateAclState — mixed format', () => {
  it('migrates old keys, preserves new keys', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 1, blocked: false, quota: 524288 },  // old format
        'notes:ab12': { caps: 33, blocked: false, quota: 524288 },    // new format
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated.entries['chat:ff00']).toBeDefined();  // migrated
    expect(migrated.entries['notes:ab12']).toBeDefined(); // preserved
    expect(migrated.entries['pk1:chat:ff00']).toBeUndefined(); // old key gone
    expect(Object.keys(migrated.entries)).toHaveLength(2);
  });

  it('old key and new key for same dTag:hash are merged', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 0b001, blocked: false, quota: 524288 }, // old
        'chat:ff00':     { caps: 0b010, blocked: false, quota: 100 },    // new
      },
    };
    const migrated = migrateAclState(state);
    expect(Object.keys(migrated.entries)).toHaveLength(1);
    expect(migrated.entries['chat:ff00'].caps).toBe(0b011); // OR
    expect(migrated.entries['chat:ff00'].quota).toBe(524288); // MAX
  });

  it('returns new reference when old keys exist, even with mixed format', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'pk1:chat:ff00': { caps: 1, blocked: false, quota: 524288 },
        'notes:ab12': { caps: 33, blocked: false, quota: 524288 },
      },
    };
    const migrated = migrateAclState(state);
    expect(migrated).not.toBe(state);
  });
});

describe('migrateAclState — defaultPolicy preservation', () => {
  it('permissive policy stays permissive after migration', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: { 'pk:chat:ff00': { caps: 1, blocked: false, quota: 524288 } },
    };
    expect(migrateAclState(state).defaultPolicy).toBe('permissive');
  });

  it('restrictive policy stays restrictive after migration', () => {
    const state: AclState = {
      defaultPolicy: 'restrictive',
      entries: { 'pk:chat:ff00': { caps: 1, blocked: false, quota: 524288 } },
    };
    expect(migrateAclState(state).defaultPolicy).toBe('restrictive');
  });
});
