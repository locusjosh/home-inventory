"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import {
  handleChatMessage,
  SUGGESTION_CHIPS,
  type ChatResult,
} from "@/lib/chatbot";
import { formatQty } from "@/lib/utils";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
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

export function InventoryChat() {
  const {
    activeItems,
    lowStockItems,
    needsCountItems,
    updateQuantity,
    markRestocked,
  } = useInventory();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hist = loadHistory();
    if (hist.length) {
      setMessages(hist);
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: "Hey! Ask about stock or update counts — stays on this phone. Try a chip below or say “help”.",
        },
      ]);
    }
    setHydrated(true);
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
  }, [messages]);

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
      }
    },
    [activeItems, markRestocked, updateQuantity]
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      const userMsg: Msg = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        text,
      };

      // Resolve against current inventory snapshot
      const result = handleChatMessage(text, {
        activeItems,
        lowStockItems,
        needsCountItems,
      });
      applyAction(result);

      // After markRestocked / set, reply already has confirmation; for adjust we used pre-update qty in engine which is correct.
      let replyText = result.reply;
      if (result.action?.type === "markRestocked") {
        // Refresh confirmation with new qty after action — look up item from current state before re-render
        const item = activeItems.find((i) => i.id === result.action!.itemId);
        if (item) {
          // markRestocked logic mirrors context: bump to min or +1
          const min = item.minLevel ?? 0;
          const nextQty = item.quantity < min ? Math.max(min, 1) : item.quantity + 1;
          replyText = `Marked ${item.name} restocked → ${formatQty(nextQty)} ${item.unit}. Nice catch-up.`;
        }
      }

      const botMsg: Msg = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        text: replyText,
      };

      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInput("");
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [activeItems, applyAction, lowStockItems, needsCountItems]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <section className="flex flex-col rounded-2xl bg-surface p-4 shadow-soft">
      <div className="mb-3">
        <h2 className="font-semibold text-ink">Inventory chat</h2>
        <p className="text-sm text-ink-muted">
          Ask about stock or update counts — stays on this phone, no cloud.
        </p>
      </div>

      <div
        ref={listRef}
        className="mb-3 max-h-72 space-y-2 overflow-y-auto overscroll-contain rounded-xl bg-surface-2/80 p-3"
        role="log"
        aria-live="polite"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-accent text-white"
                  : "rounded-bl-md bg-surface text-ink shadow-soft"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => send(chip)}
            className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent active:scale-95"
          >
            {chip}
          </button>
        ))}
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
          className="min-w-0 flex-1 rounded-xl border border-surface-3 bg-surface-2 px-3.5 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
