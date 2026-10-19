// The font tooling ships no type declarations; only the calls the build and its tests make are described.
declare module 'subset-font' {
  const subsetFont: (
    font: Uint8Array,
    text: string | undefined,
    options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' },
  ) => Promise<Buffer>;
  export default subsetFont;
}

declare module 'fontverter' {
  export function convert(font: Uint8Array, to: 'sfnt' | 'woff' | 'woff2', from?: string): Promise<Buffer>;
  export function detectFormat(font: Uint8Array): 'sfnt' | 'woff' | 'woff2';
}

declare module 'opentype.js' {
  interface Font {
    charToGlyphIndex(char: string): number;
    glyphs: { length: number };
  }
  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
