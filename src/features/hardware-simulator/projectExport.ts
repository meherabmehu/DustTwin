export function download(name: string, content: BlobPart, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Standards-compliant ZIP STORE archive; no dependency or executable code injection. */
export function zipProject(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder(), local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    if (name.startsWith('/') || name.split('/').includes('..')) throw new Error('Invalid archive path');
    const n = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
    const header = new Uint8Array(30 + n.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, n.length, true); header.set(n, 30);
    const entry = new Uint8Array(46 + n.length), c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, offset, true); entry.set(n, 46);
    local.push(header, data); central.push(entry); offset += header.length + data.length;
  }
  const centralSize = central.reduce((n, a) => n + a.length, 0), end = new Uint8Array(22), v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, central.length, true); v.setUint16(10, central.length, true); v.setUint32(12, centralSize, true); v.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + 22); let pos = 0;
  for (const part of [...local, ...central, end]) { output.set(part, pos); pos += part.length; }
  return output;
}
