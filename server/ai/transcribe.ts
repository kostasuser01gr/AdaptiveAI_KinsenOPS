/**
 * Speech-to-text via OpenAI Whisper.
 *
 * Accepts raw audio bytes (webm/ogg/mp3/m4a/wav up to ~15 MB) and forwards
 * them to the transcription endpoint. The route wrapper enforces size,
 * mime-type, and rate-limit boundaries.
 */
import { config } from "../config.js";

export interface TranscribeResult {
  text: string;
  language?: string;
  durationMs?: number;
}

export const TRANSCRIBE_ACCEPTED_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
]);

export const TRANSCRIBE_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
  opts: { language?: string; prompt?: string } = {},
): Promise<TranscribeResult> {
  if (!config.openaiApiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY not set — voice input unavailable"), { status: 503 });
  }
  if (audio.length === 0) {
    throw Object.assign(new Error("Empty audio payload"), { status: 400 });
  }

  const extFromMime: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  const ext = extFromMime[mimeType] ?? "webm";

  const t0 = Date.now();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("response_format", "json");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt.slice(0, 400));

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openaiApiKey}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw Object.assign(new Error(`Whisper API error ${response.status}: ${body.slice(0, 200)}`), {
      status: response.status >= 500 ? 502 : 400,
    });
  }

  const data = (await response.json()) as { text?: string; language?: string };
  return {
    text: (data.text ?? "").trim(),
    ...(data.language ? { language: data.language } : {}),
    durationMs: Date.now() - t0,
  };
}
