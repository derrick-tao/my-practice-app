/** True when the bytes look like an MP3 file (ID3 tag or an MPEG audio frame sync) of plausible size. */
export function looksLikeMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 256) return false;
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const frameSync = bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0;
  return id3 || frameSync;
}
