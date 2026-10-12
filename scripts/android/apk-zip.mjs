/**
 * A very small, very deliberate ZIP writer used to finish an APK.
 *
 * Why this exists: aapt2 produces a valid APK, but the compiled classes still have to be added
 * to it as `classes.dex`, and `zipalign` may not be on the machine. Re-writing the whole archive
 * would be wasteful (it is hundreds of entries), so this appends a single stored entry and:
 *
 *   * stores it uncompressed — Android requires the DEX to be stored so it can be memory-mapped,
 *   * aligns its data to 4 bytes, which is what zipalign does for a .dex entry,
 *   * rebuilds the central directory and end-of-central-directory record by hand, and
 *   * writes fixed 1980 timestamps so two builds of the same input are identical.
 *
 * Anything more complicated than "add one file to an APK" is out of scope on purpose.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
// 1980-01-01 00:00:00 in MS-DOS form. Fixed so builds are byte-for-byte reproducible.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

export function findEndOfCentralDirectory(zip) {
  const earliest = Math.max(0, zip.length - 65557);
  for (let i = zip.length - 22; i >= earliest; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('Not a ZIP archive: no end-of-central-directory record found.');
}

/**
 * Appends one stored (uncompressed) entry to a ZIP archive and returns the new archive.
 * `align` pads the entry's data so it starts on a multiple of that many bytes.
 */
export function appendStoredEntry(zip, entryName, content, { align = 4 } = {}) {
  const name = Buffer.from(entryName, 'utf8');
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const eocd = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  if (centralOffset + centralSize > zip.length) {
    throw new Error('Corrupt archive: the central directory points outside the file.');
  }

  const dataStart = zip.length + 30 + name.length;
  let extraLength = 0;
  if (dataStart % align !== 0) {
    for (let candidate = 4; candidate < 4 + align; candidate++) {
      if ((dataStart + candidate) % align === 0) {
        extraLength = candidate;
        break;
      }
    }
    if (extraLength === 0) throw new Error('Could not work out alignment padding.');
  }
  const extra = Buffer.alloc(extraLength);
  if (extraLength > 0) {
    extra.writeUInt16LE(0x0001, 0); // extra-field id; the value is padding by definition
    extra.writeUInt16LE(extraLength - 4, 2);
  }

  const local = Buffer.alloc(30);
  local.writeUInt32LE(LOCAL_HEADER, 0);
  local.writeUInt16LE(20, 4); // version needed to extract: 2.0
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(0, 8); // method: stored
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(extraLength, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(CENTRAL_HEADER, 0);
  central.writeUInt16LE(0x031e, 4); // made by: UNIX, 3.0
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc32(data), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(extraLength, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(zip.length, 42);

  const appended = Buffer.concat([local, name, extra, data]);
  const newCentral = Buffer.concat([zip.subarray(centralOffset, centralOffset + centralSize), central, name, extra]);
  const newCentralOffset = zip.length + appended.length;

  const newEocd = Buffer.alloc(22);
  newEocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  newEocd.writeUInt16LE(0, 4);
  newEocd.writeUInt16LE(0, 6);
  newEocd.writeUInt16LE(entryCount + 1, 8);
  newEocd.writeUInt16LE(entryCount + 1, 10);
  newEocd.writeUInt32LE(newCentral.length, 12);
  newEocd.writeUInt32LE(newCentralOffset, 16);
  newEocd.writeUInt16LE(0, 20);

  return Buffer.concat([zip.subarray(0, zip.length), appended, newCentral, newEocd]);
}

/** Reads the entry list (name, offset, sizes) — used by the build's own self-check. */
export function listEntries(zip) {
  const eocd = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== CENTRAL_HEADER) throw new Error('Corrupt central directory entry');
    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const crc = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const size = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    entries.push({
      name,
      flags,
      method,
      crc,
      compressedSize,
      size,
      localOffset,
      dataOffset: localOffset + 30 + nameLength + localExtraLength,
      alignment: 1, // filled in by the caller when needed
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function readZip(path) {
  return readFileSync(path);
}

export function writeZip(path, buffer) {
  writeFileSync(path, buffer);
}
