"use client";

import { noteSettingChanged } from "@/lib/sync/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import {
  handleChatMessage,
  SUGGESTION_CHIPS,
  type ChatResult,
} from "@/lib/chatbot";
import type { InventoryItem } from "@/lib/types";
import { formatQty } from "@/lib/utils";
import { Page } from "./ui/Page";
import { IconButton } from "./ui/Button";
import { Icon } from "./ui/Icon";
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
  /** Kept for compatibility; the assistant now always renders full-screen. */
  variant?: "full" | "compact";
};

const STORAGE_KEY = "home-inventory-chat-v1";
const WELCOME =
  "Hi Josh. Ask what’s running low, how many of something you have, or say things like “used 2 paper towels”.";
const TIP_KEY = "home-inventory-assist-tip-dismissed";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function InventoryChat(_props: InventoryChatProps = {}) {
  const {
    myItems,
    ideaItems,
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
          text: WELCOME,
          at: Date.now(),
        },
      ]);
      lastAssistantRef.current = WELCOME;
    }
    setVoiceSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    setVoiceReplies(loadVoiceRepliesEnabled());
    const onSettings = () => setVoiceReplies(loadVoiceRepliesEnabled());
    window.addEventListener("hi-settings-changed", onSettings);
    setHydrated(true);
    ensureVoicesLoaded();

    return () => {
      window.removeEventListener("hi-settings-changed", onSettings);
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
    if (!hydrated) return;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, [messages, interim, hydrated]);

  const applyAction = useCallback(
    (result: ChatResult) => {
      if (!result.action) return;
      const a = result.action;
      if (a.type === "setQuantity") {
        updateQuantity(a.itemId, a.quantity);
      } else if (a.type === "adjustQuantity") {
        const item = myItems.find((i) => i.id === a.itemId) ?? ideaItems.find((i) => i.id === a.itemId);
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
    [myItems, ideaItems, logPurchase, markRestocked, updateQuantity]
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
        myItems,
        ideaItems,
        lowStockItems,
        needsCountItems,
        pendingCandidates: pendingCandidatesRef.current,
        lastAssistantText: lastAssistantRef.current,
      });
      applyAction(result);

      let replyText = result.reply;
      if (result.action?.type === "markRestocked") {
        const item = myItems.find((i) => i.id === result.action!.itemId) ?? ideaItems.find((i) => i.id === result.action!.itemId);
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

      if (!opts?.fromVoice) requestAnimationFrame(() => inputRef.current?.focus());
    },
    [
      myItems,
      ideaItems,
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
      noteSettingChanged("voiceReplies");
      if (!next) stopSpeaking();
      return next;
    });
  };

  const [tipDismissed, setTipDismissed] = useState(true);
  useEffect(() => {
    try {
      setTipDismissed(localStorage.getItem(TIP_KEY) === "1");
    } catch {
      setTipDismissed(false);
    }
  }, []);
  const dismissTip = () => {
    setTipDismissed(true);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const listening = status === "listening";
  const speaking = status === "speaking";
  const statusLabel = listening
    ? "Listening…"
    : speaking
      ? "Speaking…"
      : voiceSupported
        ? "On this iPhone"
        : "Voice unavailable here";

  return (
    <Page
      title="Assistant"
      subtitle={statusLabel}
      actions={
        ttsSupported ? (
          <IconButton
            label={voiceReplies ? "Turn off spoken replies" : "Turn on spoken replies"}
            onClick={toggleVoiceReplies}
            aria-pressed={voiceReplies}
          >
            <Icon name={voiceReplies ? "speaker" : "speaker.slash"} size={24} />
          </IconButton>
        ) : null
      }
    >
      {toast ? (
        <div
          role="status"
          className="animate-fade-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+52px)] z-[55] max-w-[90vw] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2.5 text-center text-footnote font-semibold text-white backdrop-blur"
        >
          {toast}
        </div>
      ) : null}

      {!tipDismissed ? (
        <div className="mb-4 flex items-start gap-3 rounded-card bg-bg-grouped-2 p-4">
          <span className="mt-0.5 text-tint">
            <Icon name="info.circle" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-headline text-label">Voice works best from the Home Screen</p>
            <p className="mt-1 text-subhead text-label-2">
              Allow the microphone when Safari asks. If replies are silent, turn off Silent Mode.
              Everything stays on this iPhone.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissTip}
            aria-label="Dismiss tip"
            className="pressable -mr-2 -mt-2 flex h-11 w-11 items-center justify-center text-label-2"
          >
            <Icon name="xmark" size={18} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="space-y-1 pb-[calc(env(safe-area-inset-bottom)+170px)]"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((m, i) => {
          const mine = m.role === "user";
          const next = messages[i + 1];
          const lastOfRun = !next || next.role !== m.role;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"} ${lastOfRun ? "pb-2" : ""}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-body ${
                  mine ? "bg-tint-fill text-white" : "bg-bubble text-label"
                } ${lastOfRun ? (mine ? "rounded-br-[6px]" : "rounded-bl-[6px]") : ""}`}
              >
                {m.text}
              </div>
              {lastOfRun && m.at ? (
                <span className="mt-1 px-2 text-caption text-label-2">{formatTime(m.at)}</span>
              ) : null}
            </div>
          );
        })}
        {interim ? (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[18px] rounded-br-[6px] bg-tint-soft px-3.5 py-2 text-body italic text-tint">
              {interim}
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer — pinned above the tab bar */}
      <div
        className="ios-bar hairline-t fixed inset-x-0 z-40"
        style={{ bottom: "calc(49px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-2xl px-3 pb-2 pt-2">
          {showSilentTip ? (
            <div className="mb-2 flex items-center gap-2 rounded-[12px] bg-bg-grouped-2 py-1 pl-3 pr-1">
              <p className="min-w-0 flex-1 text-footnote text-label-2">{SILENT_MODE_TIP}</p>
              <button
                type="button"
                className="pressable min-h-tap shrink-0 px-2 text-subhead font-semibold text-tint"
                onClick={() => setShowSilentTip(false)}
              >
                OK
              </button>
            </div>
          ) : null}

          <div className="-mx-3 overflow-x-auto px-3 scrollbar-none">
            <div className="flex w-max gap-2 pb-2">
              {pendingCandidates.length > 0
                ? pendingCandidates.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => send(String(i + 1))}
                      className="pressable focus-ring min-h-tap shrink-0 rounded-full bg-tint-soft px-4 text-subhead font-semibold text-tint"
                    >
                      {c.name}
                      <span className="ml-1.5 font-normal">· {c.folder}</span>
                    </button>
                  ))
                : SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => send(chip)}
                      className="pressable focus-ring min-h-tap shrink-0 rounded-full bg-bg-grouped-2 px-4 text-subhead font-semibold text-label shadow-[inset_0_0_0_0.5px_var(--separator)]"
                    >
                      {chip}
                    </button>
                  ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            {voiceSupported ? (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Speak"}
                className={`pressable focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
                  listening ? "mic-pulse bg-sys-red" : "bg-tint-fill"
                }`}
              >
                <Icon name={listening ? "stop" : "mic"} size={22} />
              </button>
            ) : null}
            <div className="flex min-h-tap min-w-0 flex-1 items-center rounded-full bg-bg-grouped-2 pl-4 pr-1 shadow-[inset_0_0_0_0.5px_var(--separator)]">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? "Listening…" : "Ask about your stock"}
                aria-label="Message"
                autoComplete="off"
                enterKeyHint="send"
                className="min-h-tap min-w-0 flex-1 bg-transparent text-body text-label outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="pressable focus-ring flex h-11 w-11 shrink-0 items-center justify-center"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    input.trim() ? "bg-tint-fill text-white" : "bg-fill-3 text-label-2"
                  }`}
                >
                  <Icon name="arrow.up" size={18} strokeWidth={2.6} />
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Page>
  );
}
