/** Browser NAP-FS types, validation, and byte helpers. */

import type { FsPermission, FsPickOptions, FsReadOptions } from '@napplet/core';
import { FsServiceError, type FsBackendChange } from '@kehto/services';

export const MAX_READ_BYTES = 1024 * 1024;
export const MAX_WRITE_BYTES = 1024 * 1024;
/** Maximum file size eligible for an in-memory revision digest. */
export const MAX_REVISION_BYTES = 16 * 1024 * 1024;
export const MAX_WATCH_COUNT = 16;
export const WATCH_INTERVAL_MS = 1_000;
export const WORKSPACE_PERMISSIONS: FsPermission[] = ['read', 'write', 'create', 'delete', 'list', 'watch'];

const INVALID_PATH_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface BrowserFile {
  readonly size: number;
  readonly lastModified: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  slice(start?: number, end?: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

interface BrowserWritable {
  write(data: BufferSource): Promise<void>;
  seek(position: number): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

export interface BrowserHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  requestPermission?(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  move?(destination: BrowserDirectoryHandle, name?: string): Promise<void>;
}

export interface BrowserFileHandle extends BrowserHandle {
  readonly kind: 'file';
  getFile(): Promise<BrowserFile>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<BrowserWritable>;
}

export interface BrowserDirectoryHandle extends BrowserHandle {
  readonly kind: 'directory';
  entries(): AsyncIterableIterator<[string, BrowserHandle]>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<BrowserDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface BrowserFsStorage {
  getDirectory(): Promise<BrowserDirectoryHandle>;
}

export interface BrowserPickerApi {
  showOpenFilePicker?(options?: Record<string, unknown>): Promise<BrowserFileHandle[]>;
  showDirectoryPicker?(options?: Record<string, unknown>): Promise<BrowserDirectoryHandle>;
  showSaveFilePicker?(options?: Record<string, unknown>): Promise<BrowserFileHandle>;
}

export interface ParsedPath {
  readonly path: string;
  readonly segments: string[];
}

export interface Mount {
  readonly rootPath: string;
  readonly handle: BrowserHandle;
  readonly permissions: ReadonlySet<FsPermission>;
  readonly key: string;
}

export interface ResolvedEntry extends Mount {
  readonly path: string;
  readonly handle: BrowserHandle;
}

export interface BackendWatchRecord {
  readonly windowId: string;
  readonly path: string;
  readonly directory: boolean;
  readonly recursive: boolean;
  readonly onChange: (change: FsBackendChange) => void;
  snapshot: Map<string, string>;
  timer?: ReturnType<typeof setInterval>;
  closed: boolean;
}

let pickerCounter = 0;

export function browserStorage(): BrowserFsStorage | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator.storage as StorageManager & Partial<BrowserFsStorage>)?.getDirectory
    ? navigator.storage as StorageManager & BrowserFsStorage
    : null;
}

export function browserPickers(): BrowserPickerApi {
  if (typeof window === 'undefined') return {};
  const source = window as Window & BrowserPickerApi;
  return {
    showOpenFilePicker: source.showOpenFilePicker?.bind(source),
    showDirectoryPicker: source.showDirectoryPicker?.bind(source),
    showSaveFilePicker: source.showSaveFilePicker?.bind(source),
  };
}

export function parsePath(value: unknown): ParsedPath {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\\')) {
    throw new FsServiceError('invalid-path');
  }
  if (value === '/') return { path: '/', segments: [] };
  if (value.endsWith('/') || value.includes('//') || INVALID_PATH_TEXT.test(value)) {
    throw new FsServiceError('invalid-path');
  }
  const rawSegments = value.slice(1).split('/');
  if (rawSegments.some((segment) => segment === '.' || segment === '..' || segment.length === 0)) {
    throw new FsServiceError('invalid-path');
  }
  if (/^[A-Za-z]:$/u.test(rawSegments[0]!) || rawSegments[0]!.toLowerCase() === 'file:') {
    throw new FsServiceError('invalid-path');
  }
  const segments = rawSegments.map((segment) => segment.normalize('NFC'));
  if (segments.some((segment) => INVALID_PATH_TEXT.test(segment))) throw new FsServiceError('invalid-path');
  return { path: `/${segments.join('/')}`, segments };
}

export function errorFromBrowser(error: unknown): FsServiceError {
  if (error instanceof FsServiceError) return error;
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : '';
  switch (name) {
    case 'NotFoundError': return new FsServiceError('not-found');
    case 'TypeMismatchError': return new FsServiceError('conflict');
    case 'NotAllowedError':
    case 'SecurityError': return new FsServiceError('permission-denied');
    case 'QuotaExceededError': return new FsServiceError('quota-exceeded');
    case 'AbortError': return new FsServiceError('cancelled');
    case 'InvalidModificationError': return new FsServiceError('conflict');
    default: return new FsServiceError('io-error');
  }
}

export async function child(directory: BrowserDirectoryHandle, name: string): Promise<BrowserHandle | null> {
  try {
    for await (const [entryName, handle] of directory.entries()) {
      if (entryName.normalize('NFC') === name) return handle;
    }
    return null;
  } catch (error) {
    throw errorFromBrowser(error);
  }
}

export function requirePermission(mount: Mount, permission: FsPermission): void {
  if (!mount.permissions.has(permission)) throw new FsServiceError('permission-denied');
}

export function randomMountId(): string {
  pickerCounter += 1;
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `entry-${Date.now()}-${pickerCounter}`;
}

export function safePickedName(name: string): string {
  const normalized = name.normalize('NFC');
  if (
    normalized.length === 0
    || normalized === '.'
    || normalized === '..'
    || normalized.includes('/')
    || normalized.includes('\\')
    || INVALID_PATH_TEXT.test(normalized)
  ) return 'selected-entry';
  return normalized;
}

export function base64Bytes(value: unknown): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !CANONICAL_BASE64.test(value)) throw new FsServiceError('invalid-data');
  const paddingBytes = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const decodedLength = (value.length / 4) * 3 - paddingBytes;
  if (decodedLength > MAX_WRITE_BYTES) throw new FsServiceError('too-large');
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    if (encodeBase64(bytes) !== value) {
      throw new FsServiceError('invalid-data');
    }
    return bytes;
  } catch (error) {
    if (error instanceof FsServiceError) throw error;
    throw new FsServiceError('invalid-data');
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function validateRange(options: FsReadOptions | undefined): { offset: number; length: number } {
  const offset = options?.offset ?? 0;
  const length = options?.length ?? MAX_READ_BYTES;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0) {
    throw new FsServiceError('invalid-data');
  }
  if (length > MAX_READ_BYTES) throw new FsServiceError('too-large');
  return { offset, length };
}

export async function revision(file: BrowserFile): Promise<string> {
  if (file.size > MAX_REVISION_BYTES) throw new FsServiceError('too-large');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function pickerOptions(options: FsPickOptions | undefined, multiple = false): Record<string, unknown> {
  const accept = new Map<string, string[]>();
  for (const rule of options?.accept ?? []) {
    const mime = typeof rule.mime === 'string' && /^[\w.+-]+\/[\w.+-]+$/u.test(rule.mime)
      ? rule.mime
      : 'application/octet-stream';
    if (typeof rule.extension !== 'string' || !/^\.[\w.+-]+$/u.test(rule.extension)) continue;
    const extensions = accept.get(mime) ?? [];
    if (!extensions.includes(rule.extension)) extensions.push(rule.extension);
    accept.set(mime, extensions);
  }
  const types = [...accept].map(([mime, extensions]) => ({
    description: options?.description ?? 'Napplet files',
    accept: { [mime]: extensions },
  }));
  const suggestedName = typeof options?.suggestedName === 'string'
    && safePickedName(options.suggestedName) === options.suggestedName.normalize('NFC')
    ? options.suggestedName.normalize('NFC')
    : undefined;
  return {
    ...(multiple ? { multiple: true } : {}),
    ...(types.length > 0 ? { types } : {}),
    ...(suggestedName ? { suggestedName } : {}),
  };
}
