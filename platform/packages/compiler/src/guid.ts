/**
 * Identity contract (architecture.md §3, frozen).
 *
 * `uuid = uuidv5(namespace 6f8c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f, partId)` using SHA-1
 * (RFC 4122 version 5), then `ifcGlobalId = ifcCompress(uuid)` implemented exactly like
 * IfcOpenShell 0.9.0 `ifcopenshell.guid.compress`:
 *
 *   hex string -> prefix "0000" -> bytes -> standard base64 -> drop first two characters
 *   -> translate STD "ABC...Zabc...z0-9+/" to IFC "0123456789ABC...Zabc...z_$".
 *
 * Only node:crypto is used; no new dependencies.
 */
import { createHash } from 'node:crypto';

/** Frozen IFC identity namespace from architecture.md §3. */
export const IFC_NAMESPACE = '6f8c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f';

const STD64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const IFC64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

function hexToBytes(hex: string): Buffer {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (clean.length % 2 !== 0) throw new Error(`Invalid hex string: ${hex}`);
  return Buffer.from(clean, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  if (bytes.length !== 16) throw new Error(`UUID needs 16 bytes, got ${bytes.length}`);
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** RFC 4122 version-5 (SHA-1 name-based) UUID. */
export function uuidv5(name: string, namespace: string = IFC_NAMESPACE): string {
  const nsBytes = hexToBytes(namespace);
  if (nsBytes.length !== 16) throw new Error(`Namespace must be a UUID, got ${namespace}`);
  const hash = createHash('sha1')
    .update(nsBytes)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  // version 5 + RFC 4122 variant bits
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/**
 * IFC GlobalId compression, byte-for-byte identical to IfcOpenShell 0.9.0
 * `ifcopenshell.guid.compress` (verified against the frozen test vectors).
 */
export function ifcCompress(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`Not a UUID: ${uuid}`);
  const padded = Buffer.from(`0000${hex}`, 'hex'); // 18 bytes -> 24 base64 chars, no padding
  const b64 = padded.toString('base64');
  const dropped = b64.slice(2); // 22 characters
  let out = '';
  for (const char of dropped) {
    const index = STD64.indexOf(char);
    if (index < 0) throw new Error(`Unexpected base64 character: ${char}`);
    out += IFC64[index];
  }
  return out;
}

/** Deterministic IFC GlobalId for an authored part id (22 characters). */
export function ifcGuidForPart(partId: string): string {
  return ifcCompress(uuidv5(partId));
}
