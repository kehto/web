/**
 * fixtures/linux-distros.ts — Shared subject matter for transfer-oriented
 * mocks (torrent, nzb, soulseek, resource, upload, fs).
 *
 * All mocks that model file discovery or downloads use freely redistributable
 * Linux distribution images as their catalog. Hashes, magnet links, and
 * mirrors are deterministic placeholders, not real release artifacts.
 */
import { mockHex } from '../core/rng.js';

/**
 * One distribution image in the mock catalog.
 *
 * @example
 * ```ts
 * const iso = LINUX_DISTROS[0];
 * console.log(iso.fileName, iso.sizeBytes);
 * ```
 */
export interface LinuxDistroImage {
  /** Stable catalog id, e.g. `debian-12-netinst`. */
  id: string;
  /** Human distribution name. */
  distro: string;
  /** Release version string. */
  version: string;
  /** Image file name. */
  fileName: string;
  /** Byte size of the image. */
  sizeBytes: number;
  /** Placeholder 40-hex BitTorrent info hash (v1 shaped). */
  infoHash: string;
  /** Placeholder 64-hex SHA-256 of the image. */
  sha256: string;
  /** Placeholder magnet URI built from `infoHash`. */
  magnet: string;
  /** Placeholder HTTPS mirrors (example domains only). */
  mirrors: readonly string[];
  /** Placeholder Usenet message-id style identifier for NZB mocks. */
  nzbId: string;
  /** Mock peer username that shares this file in Soulseek mocks. */
  sharedBy: string;
}

function image(
  id: string,
  distro: string,
  version: string,
  fileName: string,
  sizeMiB: number,
  sharedBy: string,
): LinuxDistroImage {
  const infoHash = mockHex(`infohash:${id}`, 40);
  return {
    id,
    distro,
    version,
    fileName,
    sizeBytes: sizeMiB * 1024 * 1024,
    infoHash,
    sha256: mockHex(`sha256:${id}`),
    magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(fileName)}&tr=${encodeURIComponent('udp://tracker.example.org:6969/announce')}`,
    mirrors: [
      `https://mirror-a.example.org/iso/${distro.toLowerCase()}/${fileName}`,
      `https://mirror-b.example.net/iso/${distro.toLowerCase()}/${fileName}`,
    ],
    nzbId: `${mockHex(`nzb:${id}`, 24)}@news.example.org`,
    sharedBy,
  };
}

/**
 * Deterministic catalog of distribution images used by transfer mocks.
 *
 * @example
 * ```ts
 * const arch = LINUX_DISTROS.find((d) => d.distro === 'Arch Linux');
 * ```
 */
export const LINUX_DISTROS: readonly LinuxDistroImage[] = Object.freeze([
  image('debian-12-netinst', 'Debian', '12.7.0', 'debian-12.7.0-amd64-netinst.iso', 631, 'tux-mirror'),
  image('ubuntu-24-04-desktop', 'Ubuntu', '24.04.1', 'ubuntu-24.04.1-desktop-amd64.iso', 5890, 'penguin-share'),
  image('fedora-41-workstation', 'Fedora', '41', 'Fedora-Workstation-Live-x86_64-41-1.4.iso', 2214, 'blue-hat'),
  image('arch-2024-11', 'Arch Linux', '2024.11.01', 'archlinux-2024.11.01-x86_64.iso', 1180, 'rolling-stone'),
  image('alpine-3-20-standard', 'Alpine', '3.20.3', 'alpine-standard-3.20.3-x86_64.iso', 213, 'tiny-musl'),
  image('nixos-24-05-gnome', 'NixOS', '24.05', 'nixos-gnome-24.05.5678.x86_64-linux.iso', 2431, 'lambda-cat'),
  image('opensuse-tumbleweed', 'openSUSE', 'Tumbleweed', 'openSUSE-Tumbleweed-DVD-x86_64-Current.iso', 4480, 'gecko-green'),
  image('linuxmint-22-cinnamon', 'Linux Mint', '22', 'linuxmint-22-cinnamon-64bit.iso', 2790, 'fresh-leaf'),
]);

/**
 * Look up a catalog image by id, file name, info hash, or sha256.
 *
 * @param key - Any of the stable identifiers.
 * @returns The matching image or `undefined`.
 * @example
 * ```ts
 * findLinuxDistro('debian-12-netinst')?.fileName;
 * ```
 */
export function findLinuxDistro(key: string): LinuxDistroImage | undefined {
  const needle = key.toLowerCase();
  return LINUX_DISTROS.find((item) =>
    item.id === needle || item.fileName.toLowerCase() === needle || item.infoHash === needle || item.sha256 === needle,
  );
}

/**
 * Case-insensitive catalog search over distro name, version, and file name.
 *
 * @param query - Free text; empty matches everything.
 * @returns Matching images in catalog order.
 * @example
 * ```ts
 * searchLinuxDistros('debian').length === 1;
 * ```
 */
export function searchLinuxDistros(query: string): LinuxDistroImage[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return LINUX_DISTROS.filter((item) => {
    const haystack = `${item.distro} ${item.version} ${item.fileName}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
