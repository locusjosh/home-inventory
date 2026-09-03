"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { FOLDERS, type ItemDraft } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import {
  matchLineToInventory,
  parseReceiptText,
  sumItemPrices,
  todayISODate,
  type MatchSuggestion,
  type ParsedReceipt,
} from "@/lib/receiptParse";

type AllocAction = "match" | "skip" | "create";

type ReviewLine = {
  key: string;
  description: string;
  qty: number;
  price: number;
  listPrice: number | null;
  discountAmount: number | null;
  raw: string;
  ocrConfidence: "high" | "medium" | "low";
  match: MatchSuggestion;
  action: AllocAction;
  selectedItemId: string | null;
  /** For create-new */
  newFolder: string;
};

type Phase = "capture" | "reading" | "review" | "done" | "error";

export default function ReceiptPage() {
  const router = useRouter();
  const { activeItems, confirmReceiptAllocation } = useInventory();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Reading…");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [rawText, setRawText] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [storageWarn, setStorageWarn] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      void import("@/lib/receiptOcr").then((m) => m.terminateOcrWorker()).catch(() => {});
    };
  }, [previewUrl]);

  const onPick = (f: File | null) => {
    if (!f || !f.type.startsWith("image/")) {
      setError("Please choose an image file (photo of your receipt).");
      return;
    }
    setError(null);
    setPhase("capture");
    setParsed(null);
    setLines([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setFile(f);
  };

  const buildReviewLines = useCallback(
    (receipt: ParsedReceipt): ReviewLine[] => {
      return receipt.lines
        .filter((l) => l.kind === "item" || (l.kind === "discount" && l.price !== 0))
        .filter((l) => l.kind === "item")
        .map((l, idx) => {
          const match = matchLineToInventory(l.description, activeItems);
          const action: AllocAction = match.itemId ? "match" : "skip";
          return {
            key: `line-${idx}-${l.description.slice(0, 12)}`,
            description: l.description,
            qty: l.qty || 1,
            price: Math.max(0, l.price),
            listPrice: l.listPrice ?? null,
            discountAmount: l.discountAmount ?? null,
            raw: l.raw,
            ocrConfidence: l.confidence,
            match,
            action,
            selectedItemId: match.itemId,
            newFolder: "Kitchen",
          };
        });
    },
    [activeItems]
  );

  const runOcr = async () => {
    if (!file) {
      setError("Add a receipt photo first.");
      return;
    }
    setPhase("reading");
    setProgress(0);
    setProgressLabel("Loading OCR…");
    setError(null);
    try {
      const { recognizeReceipt, compressThumbnail } = await import("@/lib/receiptOcr");
      const thumb = await compressThumbnail(file, 180_000);
      setThumbnail(thumb);
      if (!thumb) setStorageWarn(true);

      const { text, confidence } = await recognizeReceipt(file, (p) => {
        const pct = Math.round((p.progress || 0) * 100);
        setProgress(pct);
        setProgressLabel(
          p.status === "loading" || p.status.includes("load")
            ? `Loading… ${pct}%`
            : `Reading… ${pct}%`
        );
      });

      if (!text.trim()) {
        setPhase("error");
        setError(
          "Couldn’t read any text. Try better lighting, flatten the receipt, and fill the frame."
        );
        return;
      }

      const receipt = parseReceiptText(text);
      setParsed(receipt);
      setRawText(text);
      setOcrConfidence(confidence);
      setVendor(receipt.vendor || "");
      setDate(receipt.date || todayISODate());
      setLines(buildReviewLines(receipt));
      setPhase("review");
    } catch (err) {
      console.error(err);
      setPhase("error");
      setError(
        err instanceof Error
          ? err.message
          : "OCR failed. Check your connection (OCR engine loads from CDN) and try again."
      );
    }
  };

  const updateLine = (key: string, patch: Partial<ReviewLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const lineSum = useMemo(() => sumItemPrices(lines.map((l) => ({ price: l.price, kind: "item" }))), [lines]);

  const confirm = () => {
    const purchasedAt = date
      ? new Date(`${date}T12:00:00`).toISOString()
      : new Date().toISOString();

    const purchaseInputs: Array<{
      itemId: string;
      qty: number;
      pricePaid: number;
      listPrice: number | null;
      discountAmount: number | null;
      promoNotes: string | null;
      vendor: string | null;
      source: "receipt";
      alsoRestock: boolean;
      purchasedAt: string;
      rawLine: string;
      ocrConfidence: number;
      createDraft?: ItemDraft;
    }> = [];

    for (const line of lines) {
      if (line.action === "skip") continue;

      const promoNotes =
        line.discountAmount && line.discountAmount > 0
          ? `Receipt discount $${line.discountAmount.toFixed(2)}`
          : null;

      const base = {
        qty: line.qty > 0 ? line.qty : 1,
        pricePaid: Math.max(0, line.price),
        listPrice: line.listPrice,
        discountAmount: line.discountAmount,
        promoNotes,
        vendor: vendor.trim() || null,
        source: "receipt" as const,
        alsoRestock: true,
        purchasedAt,
        rawLine: line.raw,
        ocrConfidence:
          line.ocrConfidence === "high" ? 85 : line.ocrConfidence === "medium" ? 60 : 35,
      };

      if (line.action === "create") {
        purchaseInputs.push({
          ...base,
          itemId: "",
          createDraft: {
            name: line.description.trim() || "Receipt item",
            folder: line.newFolder || "Kitchen",
            quantity: 0,
            unit: "units",
            minLevel: 1,
            price:
              line.qty > 0
                ? Math.round((line.price / line.qty) * 100) / 100
                : line.price,
            notes: null,
            vendor: vendor.trim() || null,
            attributes: [],
          },
        });
        continue;
      }

      if (!line.selectedItemId) continue;
      purchaseInputs.push({ ...base, itemId: line.selectedItemId });
    }

    if (purchaseInputs.length === 0) {
      setError("Select at least one line to match or create.");
      return;
    }

    const result = confirmReceiptAllocation({
      receipt: {
        vendor: vendor.trim() || null,
        date,
        rawText,
        thumbnailDataUrl: storageWarn ? null : thumbnail,
        lineCount: purchaseInputs.length,
        tax: parsed?.tax ?? null,
        total: parsed?.total ?? null,
      },
      lines: purchaseInputs,
    });

    if (!result) {
      setError("Could not save purchases.");
      return;
    }
    setDoneCount(result.purchases.length);
    setPhase("done");
  };

  const confBadge = (c: "high" | "medium" | "low") => {
    const cls =
      c === "high"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : c === "medium"
          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
          : "bg-danger/10 text-danger";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
        {c}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Scan receipt</h1>
        <p className="text-sm text-ink-muted">
          Photo → on-device OCR → match to inventory → confirm. Nothing leaves your phone.
        </p>
      </div>

      {phase === "capture" || phase === "error" ? (
        <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-soft">
          <p className="rounded-xl bg-accent-soft/50 px-3 py-2 text-xs text-ink-muted">
            Tip: good lighting, fill the frame, flatten the receipt. Works best with Costco / Walmart /
            grocery style receipts.
          </p>

          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="max-h-64 w-full rounded-xl object-contain bg-surface-2"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-2 text-sm text-ink-muted">
              No photo yet
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-white"
            >
              Take photo
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-surface-2 px-3 py-3 text-sm font-medium text-ink"
            >
              Upload image
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          {error ? (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={!file}
            onClick={() => void runOcr()}
            className="w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Read receipt
          </button>
        </section>
      ) : null}

      {phase === "reading" ? (
        <section className="space-y-3 rounded-2xl bg-surface p-6 text-center shadow-soft">
          <p className="font-medium text-ink">{progressLabel}</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <p className="text-xs text-ink-muted">OCR runs on your device · engine loads from CDN</p>
        </section>
      ) : null}

      {phase === "review" ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Review</h2>
              <span className="text-xs text-ink-muted">
                OCR {Math.round(ocrConfidence)}%
              </span>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-muted">Store / vendor</span>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Costco, Walmart…"
                className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-muted">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
              />
            </label>
            {(parsed?.tax != null || parsed?.total != null) && (
              <p className="text-xs text-ink-muted">
                {parsed.tax != null ? `Tax ${formatPrice(parsed.tax)}` : ""}
                {parsed.tax != null && parsed.total != null ? " · " : ""}
                {parsed.total != null ? `Total ${formatPrice(parsed.total)}` : ""}
                {" · "}
                Lines sum {formatPrice(lineSum)}
                {parsed.subtotal != null &&
                Math.abs(parsed.subtotal - lineSum) > 0.5
                  ? ` (receipt subtotal ${formatPrice(parsed.subtotal)} — check diffs)`
                  : ""}
              </p>
            )}
            {storageWarn ? (
              <p className="text-xs text-warn">
                Thumbnail skipped to save space — OCR text will still be stored.
              </p>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <div className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-muted shadow-soft">
              No line items detected. You can retake the photo or edit raw OCR on another try.
              <button
                type="button"
                className="mt-3 block w-full rounded-xl bg-surface-2 px-3 py-2 text-ink"
                onClick={() => setPhase("capture")}
              >
                Try again
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.key} className="rounded-2xl bg-surface p-4 shadow-soft">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {confBadge(line.ocrConfidence)}
                    {line.match.score > 0 ? (
                      <span className="text-[10px] text-ink-muted">
                        match {line.match.score}
                      </span>
                    ) : null}
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs text-ink-muted">Description</span>
                    <input
                      value={line.description}
                      onChange={(e) => {
                        const description = e.target.value;
                        const match = matchLineToInventory(description, activeItems);
                        updateLine(line.key, {
                          description,
                          match,
                          selectedItemId:
                            line.action === "match"
                              ? match.itemId
                              : line.selectedItemId,
                        });
                      }}
                      className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Qty</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0.01}
                        step="any"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.key, {
                            qty: Number(e.target.value) || 1,
                          })
                        }
                        className="w-full rounded-xl border border-surface-3 bg-surface-2 px-2 py-2 text-sm text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Paid ($)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={line.price}
                        onChange={(e) =>
                          updateLine(line.key, {
                            price: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-xl border border-surface-3 bg-surface-2 px-2 py-2 text-sm font-semibold text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Discount</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={line.discountAmount ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          updateLine(line.key, {
                            discountAmount:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-xl border border-surface-3 bg-surface-2 px-2 py-2 text-sm text-ink outline-none focus:border-accent"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(
                      [
                        ["match", "Match"],
                        ["skip", "Skip"],
                        ["create", "Create new"],
                      ] as const
                    ).map(([a, label]) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() =>
                          updateLine(line.key, {
                            action: a,
                            selectedItemId:
                              a === "match"
                                ? line.match.itemId ?? line.selectedItemId
                                : line.selectedItemId,
                          })
                        }
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                          line.action === a
                            ? "bg-accent text-white"
                            : "bg-surface-2 text-ink-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {line.action === "match" ? (
                    <label className="mt-2 block space-y-1">
                      <span className="text-xs text-ink-muted">Inventory item</span>
                      <select
                        value={line.selectedItemId ?? ""}
                        onChange={(e) =>
                          updateLine(line.key, {
                            selectedItemId: e.target.value || null,
                          })
                        }
                        className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                      >
                        <option value="">— Select —</option>
                        {line.match.candidates.length > 0
                          ? line.match.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.score})
                              </option>
                            ))
                          : activeItems
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                        {/* Always include full list as optgroup for override */}
                        {line.match.candidates.length > 0 ? (
                          <optgroup label="All items">
                            {activeItems
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((i) => (
                                <option key={`all-${i.id}`} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </label>
                  ) : null}

                  {line.action === "create" ? (
                    <label className="mt-2 block space-y-1">
                      <span className="text-xs text-ink-muted">Folder for new item</span>
                      <select
                        value={line.newFolder}
                        onChange={(e) =>
                          updateLine(line.key, { newFolder: e.target.value })
                        }
                        className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                      >
                        {FOLDERS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase("capture");
                setError(null);
              }}
              className="flex-1 rounded-xl bg-surface-2 px-3 py-3.5 text-sm font-medium text-ink"
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={lines.every((l) => l.action === "skip")}
              className="flex-[2] rounded-xl bg-accent px-3 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Confirm &amp; update stock
            </button>
          </div>
        </section>
      ) : null}

      {phase === "done" ? (
        <section className="space-y-3 rounded-2xl bg-surface p-6 text-center shadow-soft">
          <p className="text-lg font-semibold text-ink">Logged {doneCount} purchase{doneCount === 1 ? "" : "s"}</p>
          <p className="text-sm text-ink-muted">
            Quantities bumped, prices/vendors updated. Receipt OCR text saved locally (no image upload).
          </p>
          <button
            type="button"
            onClick={() => router.push("/restock")}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white"
          >
            Back to Restock
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("capture");
              setFile(null);
              setPreviewUrl(null);
              setLines([]);
              setParsed(null);
              setError(null);
            }}
            className="w-full rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium text-ink"
          >
            Scan another
          </button>
        </section>
      ) : null}

    </div>
  );
}
