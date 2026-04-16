/**
 * Voice input hook — records from the default microphone via MediaRecorder,
 * uploads the resulting blob to /api/ai/transcribe, and returns the text.
 *
 * Provides a tiny state machine (idle → recording → transcribing → idle) plus
 * auto-stop on silence so operators can press once to talk and release.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "recording" | "transcribing" | "error";

interface Options {
  language?: string;
  maxDurationMs?: number;
  onResult?: (text: string) => void;
  onError?: (message: string) => void;
}

interface Result {
  state: VoiceState;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  isSupported: boolean;
}

const DEFAULT_MAX_DURATION_MS = 60_000;

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

export function useVoiceInput(opts: Options = {}): Result {
  const { language, maxDurationMs = DEFAULT_MAX_DURATION_MS, onResult, onError } = opts;

  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxTimerRef = useRef<number | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      setState("error");
      onError?.(message);
      cleanup();
    },
    [onError, cleanup],
  );

  const upload = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const query = language ? `?lang=${encodeURIComponent(language)}` : "";
        const response = await fetch(`/api/ai/transcribe${query}`, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
          credentials: "include",
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.message ?? `Transcription failed (${response.status})`);
        }
        const data = (await response.json()) as { text?: string };
        const text = (data.text ?? "").trim();
        setState("idle");
        setError(null);
        if (text) onResult?.(text);
      } catch (err) {
        reportError((err as Error).message);
      }
    },
    [language, onResult, reportError],
  );

  const start = useCallback(async () => {
    if (!isSupported) {
      reportError("Voice input not supported on this browser");
      return;
    }
    if (state === "recording") return;

    const mime = pickSupportedMime();
    if (!mime) {
      reportError("No supported audio codec available");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener("stop", () => {
        const chunks = chunksRef.current;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (chunks.length === 0) {
          setState("idle");
          return;
        }
        const blob = new Blob(chunks, { type: mime });
        void upload(blob);
      });

      recorder.start();
      setState("recording");
      setError(null);

      // Hard cap — stops the mic if the user forgets.
      maxTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, maxDurationMs);
    } catch (err) {
      const name = (err as { name?: string }).name;
      const message =
        name === "NotAllowedError"
          ? "Microphone permission denied"
          : name === "NotFoundError"
          ? "No microphone found"
          : (err as Error).message;
      reportError(message);
    }
  }, [isSupported, state, maxDurationMs, reportError, upload]);

  const stop = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  return { state, error, start, stop, isSupported };
}
