/**
 * On-device voice via Web Speech API (SpeechRecognition + speechSynthesis).
 * No cloud LLM / API keys. Safari uses webkitSpeechRecognition.
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

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
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

/** Prefer a calm non-robotic English voice. */
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
  // Prefer local / non-remote if flagged
  const local = pool.find((v) => v.localService);
  return local || pool[0] || null;
}

export type SpeakOptions = {
  text: string;
  /** Full text shown in UI; if longer, we may summarize for speech */
  fullText?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

const LONG_LIST_THRESHOLD = 280;

/** Summarize long list replies for TTS; UI still shows full text. */
export function textForSpeech(reply: string, speakText?: string): string {
  if (speakText && speakText.trim()) return speakText.trim();
  if (reply.length <= LONG_LIST_THRESHOLD) return reply;
  // Heuristic: first line + count of bullet lines
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
  window.speechSynthesis.cancel();
}

export function speak(opts: SpeakOptions): void {
  if (!isSpeechSynthesisSupported()) {
    opts.onEnd?.();
    return;
  }
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(opts.text);
  utter.rate = opts.rate ?? 0.95;
  utter.pitch = 1;
  utter.lang = "en-US";
  const voice = pickPreferredVoice();
  if (voice) utter.voice = voice;
  utter.onstart = () => opts.onStart?.();
  utter.onend = () => opts.onEnd?.();
  utter.onerror = () => opts.onEnd?.();
  // Chrome sometimes needs a tick after cancel
  window.setTimeout(() => {
    try {
      window.speechSynthesis.speak(utter);
    } catch {
      opts.onEnd?.();
    }
  }, 40);
}

export type RecognitionHandlers = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
};

/**
 * Create a recognition session. Must call start() from a user gesture.
 * iOS Safari: continuous false, interimResults true, lang en-US.
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

  rec.onstart = () => handlers.onStart?.();
  rec.onend = () => {
    if (finalBuff.trim()) {
      handlers.onFinal?.(finalBuff.trim());
      finalBuff = "";
    }
    handlers.onEnd?.();
  };
  rec.onerror = (ev) => {
    const err = ev.error || "error";
    // no-speech / aborted are benign
    if (err !== "aborted" && err !== "no-speech") {
      handlers.onError?.(err);
    }
    handlers.onEnd?.();
  };
  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = r[0]?.transcript || "";
      if (r.isFinal) {
        finalBuff += (finalBuff ? " " : "") + t;
      } else {
        interim += t;
      }
    }
    if (interim) handlers.onInterim?.(interim);
    if (finalBuff) handlers.onInterim?.(finalBuff + (interim ? " " + interim : ""));
  };

  return {
    start: () => {
      finalBuff = "";
      try {
        rec.start();
      } catch (e) {
        handlers.onError?.(e instanceof Error ? e.message : "start failed");
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
