// The TTS provider seam. The content build talks to providers only through this interface.
// Implementations: azure-provider.ts (default), edge-provider.ts (unofficial fallback),
// fake-provider.ts (silent placeholder audio, tests and pull-request CI only).

export interface TtsRequest {
  /** Plain spoken prompt (before SSML wrapping). The edge provider sends exactly this. */
  text: string;
  /** Full SSML document that is sent to the provider (and hashed into the audio file name). */
  ssml: string;
  voice: string;
  /** SSML prosody rate, e.g. "0%" or "-30%". */
  rate: string;
  /** Output format identifier, e.g. an Azure `X-Microsoft-OutputFormat` value. */
  format: string;
  /** Human-readable origin for logs, e.g. "fall-2026-assessment/什 slow". Never contains secrets. */
  label: string;
}

export interface TtsProvider {
  /** Stable id; part of the audio content hash, so switching providers regenerates audio. */
  id: string;
  /** File extension (no dot) of the audio this provider produces. */
  extension: string;
  /** Whether the provider honours `<phoneme>` markup. When false, the prompt is sent without it. */
  supportsPhonemes: boolean;
  /**
   * Why this provider cannot synthesize right now (for example missing credentials), or undefined when
   * it can. Never includes secret values. Checked before any request is made.
   */
  unavailableReason?(): string | undefined;
  synthesize(request: TtsRequest): Promise<Uint8Array>;
}
