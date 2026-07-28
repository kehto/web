import { describe, expect, it, vi } from 'vitest';
import { InstalledNappletCatalog } from '../../apps/playground/src/installed-napplet-catalog.js';
import { getInstalledNappletCatalog, installVerifiedNapplet } from '../../apps/playground/src/shell-host.js';

const resolvedProfile = {
  dTag: 'profile-viewer',
  aggregateHash: 'profile-aggregate',
  requires: ['inc'],
  title: 'Profile Viewer',
  archetypes: [
    { slug: 'profile', convention: 'napplet:profile/open' },
  ],
  indexHtml: '<main>verified profile</main>',
};

describe('InstalledNappletCatalog', () => {
  it('keeps serializable verified installation facts after a frame closes', () => {
    const catalog = new InstalledNappletCatalog();
    const onChanged = vi.fn();
    catalog.onChanged(onChanged);

    catalog.install(resolvedProfile, {
      name: 'profile-viewer',
      containerId: 'profile-viewer-frame',
    });

    expect(catalog.installed()).toEqual([{
      dTag: 'profile-viewer',
      aggregateHash: 'profile-aggregate',
      restart: { name: 'profile-viewer', containerId: 'profile-viewer-frame' },
      title: 'Profile Viewer',
      requires: ['inc'],
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    }]);
    expect(catalog.intentCatalog()).toEqual([expect.objectContaining({
      dTag: 'profile-viewer',
      archetypes: expect.objectContaining({ profile: expect.any(Object) }),
    })]);
    expect(onChanged).toHaveBeenCalledWith('profile');
  });

  it('removes availability only on explicit artifact uninstall', () => {
    const catalog = new InstalledNappletCatalog();
    const onChanged = vi.fn();
    catalog.onChanged(onChanged);
    catalog.install(resolvedProfile, { name: 'profile-viewer', containerId: 'profile-viewer-frame' });

    expect(catalog.remove('profile-viewer')).toBe(true);
    expect(catalog.intentCatalog()).toEqual([]);
    expect(onChanged).toHaveBeenLastCalledWith('profile');
    expect(catalog.remove('profile-viewer')).toBe(false);
  });

  it('inserts only after resolver verification and retains installation independently of frames', async () => {
    getInstalledNappletCatalog().remove('profile-viewer');
    installVerifiedNapplet(resolvedProfile, {
      name: 'profile-viewer',
      containerId: 'profile-viewer-frame',
    });

    expect(getInstalledNappletCatalog().get('profile-viewer')).toEqual(expect.objectContaining({
      aggregateHash: 'profile-aggregate',
      restart: { name: 'profile-viewer', containerId: 'profile-viewer-frame' },
    }));
    expect(getInstalledNappletCatalog().get('profile-viewer')).toBeDefined();
    getInstalledNappletCatalog().remove('profile-viewer');
    expect(getInstalledNappletCatalog().get('profile-viewer')).toBeUndefined();
  });
});
