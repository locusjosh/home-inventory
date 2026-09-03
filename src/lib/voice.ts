/**
 * On-device voice via Web Speech API (SpeechRecognition + speechSynthesis).
 * No cloud LLM / API keys. Safari uses webkitSpeechRecognition.
 *
 * iOS Safari notes:
 * - Never reuse a Recognition instance after onend — create fresh each start.
 * - Wait ~150–300ms after onend before next start.
 * - speechSynthesis must be unlocked from a user gesture.
 * - Silent Mode (ringer switch) can mute TTS on some iOS versions.
 */

export type VoiceStatus = "idle" | "listening" | "speaking" | "unsupported";

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
    length: number;
  }> & { length: number };
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const VOICE_REPLIES_KEY = "home-inventory-voice-replies";

/** Min ms to wait after recognition onend before allowing another start (iOS). */
export const RECOGNITION_COOLDOWN_MS = 220;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window === "undefined" ? false : "speechSynthesis" in window;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function loadVoiceRepliesEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(VOICE_REPLIES_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function saveVoiceRepliesEnabled(on: boolean): void {
  try {
    localStorage.setItem(VOICE_REPLIES_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Prefer a calm local English voice. */
export function pickPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferName = [
    /samantha/i,
    /karen/i,
    /moira/i,
    /google us english/i,
    /google uk english female/i,
    /microsoft aria/i,
    /microsoft jenny/i,
    /natural/i,
    /enhanced/i,
  ];

  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang) || /english/i.test(v.lang));
  const pool = en.length ? en : voices;

  for (const re of preferName) {
    const hit = pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  const local = pool.find((v) => v.localService);
  return local || pool[0] || null;
}

/**
 * Unlock speechSynthesis from a user gesture (required on iOS Safari).
 * Call from mic tap / first interaction. Speaks a near-silent utterance.
 */
export function unlockSpeechSynthesis(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.getVoices();
    const unlock = new SpeechSynthesisUtterance(" ");
    unlock.volume = 0.01;
    unlock.rate = 2;
    unlock.pitch = 1;
    unlock.lang = "en-US";
    const voice = pickPreferredVoice();
    if (voice) unlock.voice = voice;
    window.speechSynthesis.speak(unlock);
    // Cancel quickly so it doesn't delay recognition — still unlocks the engine
    window.setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }, 30);
  } catch {
    /* ignore */
  }
}

/** Warm getVoices; retry on voiceschanged if empty (Safari/Chrome). */
export function ensureVoicesLoaded(cb?: (voices: SpeechSynthesisVoice[]) => void): void {
  if (!isSpeechSynthesisSupported()) {
    cb?.([]);
    return;
  }
  const synth = window.speechSynthesis;
  const current = synth.getVoices();
  if (current.length) {
    cb?.(current);
    return;
  }
  const onChange = () => {
    const v = synth.getVoices();
    if (v.length) {
      synth.removeEventListener("voiceschanged", onChange);
      cb?.(v);
    }
  };
  synth.addEventListener("voiceschanged", onChange);
  // Fallback timeout
  window.setTimeout(() => {
    synth.removeEventListener("voiceschanged", onChange);
    cb?.(synth.getVoices());
  }, 1500);
}

export type SpeakOptions = {
  text: string;
  /** Full text shown in UI; if longer, we may summarize for speech */
  fullText?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
};

const LONG_LIST_THRESHOLD = 280;

/** Summarize long list replies for TTS; UI still shows full text. */
export function textForSpeech(reply: string, speakText?: string): string {
  if (speakText && speakText.trim()) return speakText.trim();
  if (reply.length <= LONG_LIST_THRESHOLD) return reply;
  const lines = reply.split("\n").filter(Boolean);
  const bullets = lines.filter((l) => /^[·•\-]/.test(l.trim()) || /^\d+\./.test(l.trim()));
  const head = lines[0] || "Here's what I found.";
  if (bullets.length > 4) {
    return `${head} ${bullets.length} items listed on screen.`;
  }
  return reply.slice(0, 220).replace(/\s+\S*$/, "") + "…";
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function speak(opts: SpeakOptions): void {
  if (!isSpeechSynthesisSupported()) {
    opts.onError?.("unsupported");
    opts.onEnd?.();
    return;
  }
  const spoken = (opts.text || "").trim();
  if (!spoken) {
    opts.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }

  const startUtter = (voice: SpeechSynthesisVoice | null) => {
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = opts.rate ?? 0.95;
    utter.pitch = 1;
    utter.lang = "en-US";
    if (voice) utter.voice = voice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      opts.onEnd?.();
    };
    utter.onstart = () => opts.onStart?.();
    utter.onend = () => finish();
    utter.onerror = () => {
      opts.onError?.("synthesis-failed");
      finish();
    };
    try {
      // Safari: empty utterance first in same tick can help after unlock
      const prime = new SpeechSynthesisUtterance(" ");
      prime.volume = 0;
      prime.rate = 2;
      if (voice) prime.voice = voice;
      window.speechSynthesis.speak(prime);
      window.speechSynthesis.speak(utter);
    } catch {
      opts.onError?.("speak-threw");
      finish();
    }
  };

  const voice = pickPreferredVoice();
  if (voice) {
    // Small tick after cancel/resume (Chrome + Safari)
    window.setTimeout(() => startUtter(voice), 40);
    return;
  }
  // Voices empty — wait for voiceschanged then speak
  ensureVoicesLoaded((voices) => {
    const v = pickPreferredVoice() || voices[0] || null;
    window.setTimeout(() => startUtter(v), 40);
  });
}

export function humanizeRecognitionError(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone blocked — allow mic in Safari settings for this site.";
    case "network":
      return "Speech recognition network error. Check connection and try again.";
    case "audio-capture":
      return "No microphone found or audio capture failed.";
    case "language-not-supported":
      return "Language not supported for speech recognition.";
    case "start failed":
    case "busy":
      return "Mic busy — wait a moment and tap again.";
    default:
      return error ? `Mic error: ${error}` : "Mic error — try again.";
  }
}

export type RecognitionHandlers = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
};

/**
 * Create a fresh recognition session. Must call start() from a user gesture.
 * Never reuse after onend — call createRecognition again.
 * iOS Safari: continuous false, interimResults true, lang en-US.
 * Fires onFinal from onresult when isFinal (Safari often won't buffer to onend).
 */
export function createRecognition(handlers: RecognitionHandlers): {
  start: () => void;
  stop: () => void;
  abort: () => void;
} | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "en-US";
  if (rec.maxAlternatives !== undefined) rec.maxAlternatives = 1;

  let finalBuff = "";
  let finalDelivered = false;

  const deliverFinal = (text: string) => {
    const t = text.trim();
    if (!t || finalDelivered) return;
    finalDelivered = true;
    finalBuff = "";
    handlers.onFinal?.(t);
  };

  rec.onstart = () => handlers.onStart?.();
  rec.onend = () => {
    // Fallback if Safari didn't mark isFinal but we have buffer
    if (!finalDelivered && finalBuff.trim()) {
      deliverFinal(finalBuff);
    }
    handlers.onEnd?.();
  };
  rec.onerror = (ev) => {
    const err = ev.error || "error";
    if (err !== "aborted" && err !== "no-speech") {
      handlers.onError?.(err);
    }
    handlers.onEnd?.();
  };
  rec.onresult = (ev) => {
    let interim = "";
    let hasFinal = false;
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = r[0]?.transcript || "";
      if (r.isFinal) {
        hasFinal = true;
        finalBuff += (finalBuff ? " " : "") + t;
      } else {
        interim += t;
      }
    }
    // Fire final from onresult when isFinal (Safari quirks — don't wait only for onend)
    if (hasFinal && finalBuff.trim()) {
      deliverFinal(finalBuff);
      return;
    }
    if (!finalDelivered) {
      const shown = finalBuff
        ? finalBuff + (interim ? " " + interim : "")
        : interim;
      if (shown) handlers.onInterim?.(shown);
    }
  };

  return {
    start: () => {
      finalBuff = "";
      finalDelivered = false;
      try {
        rec.start();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "start failed";
        // InvalidStateError often means already started / overlapping
        handlers.onError?.(
          /invalidstate|already/i.test(msg) ? "busy" : msg
        );
        handlers.onEnd?.();
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}

export const VOICE_GREETING = "Inventory online. What do you need?";

export const SILENT_MODE_TIP =
  "iPhone tip: the Silent switch (ringer) can mute spoken replies. Turn Silent Mode off, keep Voice replies on, and allow Microphone in Safari.";
