"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import {
  handleChatMessage,
  SUGGESTION_CHIPS,
  type ChatResult,
} from "@/lib/chatbot";
import type { InventoryItem } from "@/lib/types";
import { formatQty } from "@/lib/utils";
import {
  RECOGNITION_COOLDOWN_MS,
  SILENT_MODE_TIP,
  VOICE_GREETING,
  createRecognition,
  humanizeRecognitionError,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  loadVoiceRepliesEnabled,
  saveVoiceRepliesEnabled,
  speak,
  stopSpeaking,
  textForSpeech,
  unlockSpeechSynthesis,
  ensureVoicesLoaded,
  type VoiceStatus,
} from "@/lib/voice";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at?: number;
};

type InventoryChatProps = {
  /** Full Jarvis Assist layout vs compact embed on Data */
  variant?: "full" | "compact";
};

const STORAGE_KEY = "home-inventory-chat-v1";

function loadHistory(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Msg[];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function InventoryChat({ variant = "compact" }: InventoryChatProps) {
  const {
    activeItems,
    lowStockItems,
    needsCountItems,
    updateQuantity,
    markRestocked,
    logPurchase,
  } = useInventory();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [pendingCandidates, setPendingCandidates] = useState<InventoryItem[]>(
    []
  );
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interim, setInterim] = useState("");
  const [micToggleOn, setMicToggleOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showSilentTip, setShowSilentTip] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(
    null
  );
  const pendingCandidatesRef = useRef<InventoryItem[]>([]);
  const lastAssistantRef = useRef<string>("");
  const voiceRepliesRef = useRef(true);
  const greetedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const startingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const finalSentRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    pendingCandidatesRef.current = pendingCandidates;
  }, [pendingCandidates]);

  useEffect(() => {
    voiceRepliesRef.current = voiceReplies;
  }, [voiceReplies]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    const hist = loadHistory();
    if (hist.length) {
      setMessages(hist);
      const lastA = [...hist].reverse().find((m) => m.role === "assistant");
      if (lastA) lastAssistantRef.current = lastA.text;
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: "Inventory online. Ask about stock or update counts — 100% on this device. Tap the mic or type below.",
          at: Date.now(),
        },
      ]);
      lastAssistantRef.current =
        "Inventory online. Ask about stock or update counts — 100% on this device. Tap the mic or type below.";
    }
    setVoiceSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    setVoiceReplies(loadVoiceRepliesEnabled());
    setHydrated(true);
    ensureVoicesLoaded();

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopSpeaking();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore quota */
    }
  }, [messages, hydrated]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, interim]);

  const applyAction = useCallback(
    (result: ChatResult) => {
      if (!result.action) return;
      const a = result.action;
      if (a.type === "setQuantity") {
        updateQuantity(a.itemId, a.quantity);
      } else if (a.type === "adjustQuantity") {
        const item = activeItems.find((i) => i.id === a.itemId);
        if (!item) return;
        updateQuantity(a.itemId, Math.max(0, item.quantity + a.delta));
      } else if (a.type === "markRestocked") {
        markRestocked(a.itemId);
      } else if (a.type === "logPurchase") {
        logPurchase({
          itemId: a.itemId,
          qty: a.qty,
          pricePaid: a.pricePaid,
          listPrice: a.listPrice,
          discountPercent: a.discountPercent,
          discountAmount: a.discountAmount,
          promoNotes: a.promoNotes,
          vendor: a.vendor,
          source: "chat",
          alsoRestock: a.alsoRestock !== false,
        });
      }
    },
    [activeItems, logPurchase, markRestocked, updateQuantity]
  );

  const speakReply = useCallback(
    (replyText: string, speakText?: string) => {
      if (!voiceRepliesRef.current || !ttsSupported) return;
      const spoken = textForSpeech(replyText, speakText);
      setStatus("speaking");
      speak({
        text: spoken,
        onStart: () => setStatus("speaking"),
        onEnd: () => {
          setStatus((s) => (s === "speaking" ? "idle" : s));
          // Do NOT startListening here — breaks iOS gesture chain
        },
        onError: () => {
          setStatus("idle");
          setShowSilentTip(true);
          showToast(
            "Couldn't speak — check Silent Mode / Voice replies"
          );
        },
      });
    },
    [showToast, ttsSupported]
  );

  const send = useCallback(
    (raw: string, opts?: { fromVoice?: boolean }) => {
      const text = raw.trim();
      if (!text) return;

      stopSpeaking();
      setInterim("");

      const userMsg: Msg = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        text,
        at: Date.now(),
      };

      const result = handleChatMessage(text, {
        activeItems,
        lowStockItems,
        needsCountItems,
        pendingCandidates: pendingCandidatesRef.current,
        lastAssistantText: lastAssistantRef.current,
      });
      applyAction(result);

      let replyText = result.reply;
      if (result.action?.type === "markRestocked") {
        const item = activeItems.find((i) => i.id === result.action!.itemId);
        if (item) {
          const min = item.minLevel ?? 0;
          const nextQty =
            item.quantity < min ? Math.max(min, 1) : item.quantity + 1;
          replyText = `Marked ${item.name} restocked → ${formatQty(nextQty)} ${item.unit}. Nice catch-up.`;
        }
      }

      if (result.candidates?.length) {
        setPendingCandidates(result.candidates);
      } else {
        setPendingCandidates([]);
      }

      lastAssistantRef.current = replyText;

      const botMsg: Msg = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        text: replyText,
        at: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInput("");

      // Always speak when fromVoice if voice replies on (default ON)
      if (opts?.fromVoice) {
        if (voiceRepliesRef.current) {
          speakReply(replyText, result.speakText);
        } else {
          setStatus("idle");
        }
      } else if (voiceRepliesRef.current) {
        speakReply(replyText, result.speakText);
      }

      // After reply, ensure mic can work again
      recognitionRef.current = null;
      setMicToggleOn(false);
      startingRef.current = false;

      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [
      activeItems,
      applyAction,
      lowStockItems,
      needsCountItems,
      speakReply,
    ]
  );


  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    // Keep ref until onEnd clears — but also force idle soon
    setMicToggleOn(false);
    setStatus((s) => (s === "listening" ? "idle" : s));
  }, []);

  const startListening = useCallback(() => {
    if (!voiceSupported) return;
    if (startingRef.current) return;
    if (Date.now() < cooldownUntilRef.current) {
      showToast("Mic cooling down — tap again in a moment");
      return;
    }

    stopSpeaking();
    // Abort any leftover instance, then clear — always fresh Recognition
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setInterim("");
    finalSentRef.current = false;
    startingRef.current = true;

    const session = createRecognition({
      onStart: () => {
        setStatus("listening");
        startingRef.current = false;
      },
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        if (finalSentRef.current) return;
        finalSentRef.current = true;
        setInterim("");
        if (t.trim()) send(t, { fromVoice: true });
      },
      onEnd: () => {
        recognitionRef.current = null;
        setMicToggleOn(false);
        startingRef.current = false;
        cooldownUntilRef.current = Date.now() + RECOGNITION_COOLDOWN_MS;
        setStatus((s) => {
          if (s === "listening") return "idle";
          return s;
        });
        setInterim("");
        // Speak greeting AFTER first listen ends (not before — preserves gesture chain)
        if (!greetedRef.current && voiceRepliesRef.current && ttsSupported) {
          greetedRef.current = true;
          // Only greet if we didn't already speak a reply
          if (!finalSentRef.current) {
            setStatus("speaking");
            speak({
              text: VOICE_GREETING,
              onEnd: () => setStatus((s) => (s === "speaking" ? "idle" : s)),
              onError: () => {
                setStatus("idle");
                setShowSilentTip(true);
              },
            });
          }
        }
      },
      onError: (err) => {
        showToast(humanizeRecognitionError(err));
        setStatus("idle");
        setMicToggleOn(false);
        startingRef.current = false;
        recognitionRef.current = null;
        cooldownUntilRef.current = Date.now() + RECOGNITION_COOLDOWN_MS;
      },
    });
    if (!session) {
      startingRef.current = false;
      showToast("Speech recognition unavailable");
      return;
    }
    recognitionRef.current = session;
    setMicToggleOn(true);
    setStatus("listening");
    session.start();
  }, [send, showToast, ttsSupported, voiceSupported]);

  /**
   * Tap-to-toggle only — no pointerDown/Up hold handlers.
   * onClick + onPointerDown both fire on iPhone and race (start then stop).
   * Unlock TTS in the same user gesture, then start recognition immediately.
   */
  const toggleMic = useCallback(() => {
    if (status === "listening" || micToggleOn) {
      stopListening();
      return;
    }
    if (status === "speaking") {
      stopSpeaking();
      setStatus("idle");
    }

    // Unlock audio in this gesture (iOS), then start recognition immediately
    if (!audioUnlockedRef.current) {
      unlockSpeechSynthesis();
      audioUnlockedRef.current = true;
    } else {
      // Keep synthesis awake
      try {
        window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
    }

    // Mark greeted without speaking first — speak after first listen ends if needed
    // (speaking before startListening breaks iOS recognition gesture chain)
    startListening();
  }, [micToggleOn, startListening, status, stopListening]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const toggleVoiceReplies = () => {
    setVoiceReplies((v) => {
      const next = !v;
      saveVoiceRepliesEnabled(next);
      if (!next) stopSpeaking();
      return next;
    });
  };

  const statusLabel =
    status === "listening"
      ? "Listening…"
      : status === "speaking"
        ? "Speaking…"
        : voiceSupported
          ? "Ready"
          : "Voice unavailable";

  const isFull = variant === "full";

  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-soft ${
        isFull
          ? "min-h-[calc(100dvh-9.5rem)] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100"
          : "bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 text-slate-100"
      } assist-glass`}
    >
      {/* Ambient glow when listening */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          status === "listening" ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-24 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      {toast ? (
        <div
          role="status"
          className="absolute left-3 right-3 top-3 z-30 rounded-xl border border-amber-400/30 bg-amber-500/20 px-3 py-2 text-center text-xs font-medium text-amber-100 backdrop-blur"
        >
          {toast}
        </div>
      ) : null}

      <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="font-semibold tracking-tight text-white">
            {isFull ? "Jarvis Assist" : "Assistant"}
          </h2>
          <p className="text-xs text-slate-400">
            On-device · Web Speech · no cloud AI
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              status === "listening"
                ? "bg-sky-500/20 text-sky-300"
                : status === "speaking"
                  ? "bg-violet-500/20 text-violet-300"
                  : "bg-white/5 text-slate-400"
            }`}
            aria-live="polite"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "listening"
                  ? "animate-pulse bg-sky-400"
                  : status === "speaking"
                    ? "animate-pulse bg-violet-400"
                    : "bg-emerald-400/80"
              }`}
            />
            {statusLabel}
          </div>
          {ttsSupported ? (
            <button
              type="button"
              onClick={toggleVoiceReplies}
              className={`text-[11px] font-medium ${
                voiceReplies ? "text-sky-300" : "text-slate-500"
              }`}
            >
              Voice replies {voiceReplies ? "on" : "off"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={listRef}
        className={`relative z-10 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 ${
          isFull ? "flex-1" : "max-h-80"
        }`}
        role="log"
        aria-live="polite"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "rounded-br-md bg-sky-600 text-white"
                  : "rounded-bl-md border border-white/10 bg-white/5 text-slate-100 backdrop-blur"
              }`}
            >
              {m.text}
              {m.at ? (
                <div
                  className={`mt-1 text-[10px] ${
                    m.role === "user" ? "text-sky-100/70" : "text-slate-500"
                  }`}
                >
                  {formatTime(m.at)}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {interim ? (
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl rounded-br-md bg-sky-600/40 px-3.5 py-2 text-sm italic text-sky-100">
              {interim}
            </div>
          </div>
        ) : null}
      </div>

      {pendingCandidates.length > 0 ? (
        <div className="relative z-10 flex flex-wrap gap-2 border-t border-white/5 px-3 py-2">
          <span className="w-full text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Pick one
          </span>
          {pendingCandidates.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => send(String(i + 1))}
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 active:scale-95"
            >
              {i + 1}. {c.name}
              <span className="ml-1 text-slate-500">({c.folder})</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-wrap gap-2 border-t border-white/5 px-3 py-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => send(chip)}
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 active:scale-95"
          >
            {chip}
          </button>
        ))}
      </div>

      {showSilentTip ? (
        <div className="relative z-10 border-t border-white/5 px-3 py-2">
          <p className="rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            {SILENT_MODE_TIP}{" "}
            <button
              type="button"
              className="text-sky-400 underline"
              onClick={() => setShowSilentTip(false)}
            >
              Dismiss
            </button>
          </p>
        </div>
      ) : null}

      {/* Mic + input */}
      <div className="relative z-10 border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-3 flex flex-col items-center gap-2">
          {voiceSupported ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={status === "listening"}
                aria-label={
                  status === "listening" ? "Stop listening" : "Start listening"
                }
                className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 ${
                  status === "listening"
                    ? "bg-sky-500 text-white shadow-[0_0_0_8px_rgba(56,189,248,0.25)] mic-pulse"
                    : "bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-900/40"
                }`}
              >
                <MicIcon listening={status === "listening"} />
              </button>
              <p className="text-center text-[11px] text-slate-500">
                {status === "listening"
                  ? "Listening… tap again to stop"
                  : "Tap mic to toggle · Safari: allow mic · Silent Mode may mute TTS"}
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-xs text-slate-400">
              Voice not supported here. Type below — or open in Safari and Add
              to Home Screen for best mic support.
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask or update…"
            autoComplete="off"
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={listening ? "animate-pulse" : undefined}
    >
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        fill="currentColor"
      />
      <path
        d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-3.07A7 7 0 0 0 19 11Z"
        fill="currentColor"
      />
    </svg>
  );
}
