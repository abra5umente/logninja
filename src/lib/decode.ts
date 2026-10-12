// Turn a log file's bytes into text. Windows tools often write UTF-16, which
// File.text() would read as UTF-8 and turn into garbage, so look for a byte
// order mark first, then for the tell-tale zero bytes of UTF-16 without one.
export function decodeBytes(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  // UTF-16 without a BOM: plain ASCII text then has a zero byte in every other position
  const sampleLen = Math.min(bytes.length, 4096)
  let nulCount = 0
  for (let i = 0; i < sampleLen; i++) if (bytes[i] === 0x00) nulCount++
  if (nulCount > sampleLen / 10) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

// Compressed archives that turn up next to rotated logs (server.log.2.gz and friends)
const ARCHIVE_MAGIC: number[][] = [
  [0x1F, 0x8B], // gzip
  [0x50, 0x4B, 0x03, 0x04], // zip
  [0x42, 0x5A, 0x68], // bzip2
  [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00], // xz
  [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], // 7z
]

// Whether decoded text looks like a log rather than a binary file: few
// replacement characters and control codes other than tabs and line breaks.
export function looksLikeText(bytes: Uint8Array, text: string): boolean {
  if (ARCHIVE_MAGIC.some(m => m.every((b, i) => bytes[i] === b))) return false
  const sample = text.slice(0, 4096)
  if (!sample) return true
  let odd = 0
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i)
    if (c === 0xFFFD || (c < 32 && c !== 9 && c !== 10 && c !== 12 && c !== 13)) odd++
  }
  return odd <= sample.length / 20
}

/** The file's text, or null when it doesn't look like a text log (an archive or other binary file) */
export async function readLogFile(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const text = decodeBytes(bytes)
  return looksLikeText(bytes, text) ? text : null
}
