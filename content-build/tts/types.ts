// The TTS provider seam. The content build talks to providers only through this interface.
// 01 ships the fake provider; 02 adds the Azure provider and the edge-tts fallback.

export interface TtsRequest {
  /** Plain spoken prompt (before SSML wrapping), useful for logging and fakes. */
  text: string;
  /** Full SSML document that is sent to the provider (and hashed into the audio file name). */
  ssml: string;
  voice: string;
  /** SSML prosody rate, e.g. "0%" or "-30%". */
  rate: string;
  /** Output format identifier, e.g. an Azure `X-Microsoft-OutputFormat` value. */
  format: string;
}

export interface TtsProvider {
  /** Stable id; part of the audio content hash, so switching providers regenerates audio. */
  id: string;
  /** File extension (no dot) of the audio this provider produces. */
  extension: string;
  synthesize(request: TtsRequest): Promise<Uint8Array>;
}
