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

export async function decodeFile(file: File): Promise<string> {
  return decodeBytes(new Uint8Array(await file.arrayBuffer()))
}
