"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { STOCK_FOLDERS, type ItemDraft } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { Button, buttonClass } from "@/components/ui/Button";
import { PhotoInputs, usePhotoInputIds } from "@/components/PhotoInputs";
import { ImageDecodeError, isHeic, isImageFile, sniffHeic, toJpeg } from "@/lib/imageFile";
import { Icon } from "@/components/ui/Icon";
import { ListSection } from "@/components/ui/List";
import { FieldRow, SelectInput, TextInput } from "@/components/ui/Form";
import { SegmentedControl, StatusTag } from "@/components/ui/Controls";
import { EmptyState } from "@/components/EmptyState";
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

function ocrErrorMessage(err: unknown): string {
  if (err instanceof ImageDecodeError) return err.message;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/decode|image|bitmap|read image/i.test(msg))
    return "This photo couldn’t be opened. Try another photo, or retake it.";
  if (typeof navigator !== "undefined" && navigator.onLine === false && /fetch|network|load/i.test(msg))
    return "The text reader hasn’t finished downloading. Open the app once while online, then try again.";
  return "Couldn’t read this receipt. Try again with the receipt flat, in bright light, filling the frame.";
}

export default function ReceiptPage() {
  const router = useRouter();
  const { myItems, confirmReceiptAllocation } = useInventory();
  const { cameraId, libraryId } = usePhotoInputIds("receipt");
  const [preparing, setPreparing] = useState(false);

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

  const onPick = async (picked: File | null) => {
    if (!isImageFile(picked)) {
      setError("Please choose a photo of your receipt (JPEG, PNG or HEIC).");
      return;
    }
    setError(null);
    setPhase("capture");
    setParsed(null);
    setLines([]);
    let f: File = picked;
    // HEIC (iPhone default) can't go to OCR / canvas directly in most browsers:
    // convert to JPEG first. Large enough to keep small receipt text legible.
    if (isHeic(picked) || !picked.type || (await sniffHeic(picked))) {
      setPreparing(true);
      try {
        const { blob } = await toJpeg(picked, { maxEdge: 2400, quality: 0.9 });
        f = new File([blob], picked.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      } catch (err) {
        console.error(err);
        setError(err instanceof ImageDecodeError ? err.message : "This photo couldn’t be opened. Try another one.");
        setPreparing(false);
        return;
      }
      setPreparing(false);
    }
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
          const match = matchLineToInventory(l.description, myItems);
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
    [myItems]
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
      setError(ocrErrorMessage(err));
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

  const confTag = (c: "high" | "medium" | "low") =>
    c === "high" ? (
      <StatusTag tone="green">Clear read</StatusTag>
    ) : c === "medium" ? (
      <StatusTag tone="orange">Check this line</StatusTag>
    ) : (
      <StatusTag tone="orange">Hard to read</StatusTag>
    );

  const resetCapture = () => {
    setPhase("capture");
    setFile(null);
    setPreviewUrl(null);
    setLines([]);
    setParsed(null);
    setError(null);
  };

  const selectedCount = lines.filter((l) => l.action !== "skip").length;
  const sortedItems = myItems.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page
      title="Scan Receipt"
      back={{ href: "/more", label: "More", useHistory: true }}
      subtitle={phase === "review" ? "Check each line, then confirm." : undefined}
    >
      <PhotoInputs cameraId={cameraId} libraryId={libraryId} onFile={(f) => void onPick(f)} disabled={preparing} />

      {phase === "capture" || phase === "error" ? (
        <section className="space-y-4">
          {previewUrl ? (
            <div className="glass overflow-hidden rounded-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Receipt preview" className="max-h-[52vh] w-full rounded-[10px] object-contain" />
            </div>
          ) : (
            <div className="flex flex-col items-center glass rounded-card px-6 py-10 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-tint-soft text-tint" aria-hidden>
                <Icon name="camera" size={40} strokeWidth={1.6} />
              </span>
              <h2 className="mt-4 text-title3 text-label">Photograph a Receipt</h2>
              <p className="mt-1.5 max-w-xs text-subhead text-label-2">
                Lay it flat in good light and fill the frame. Items are matched to your stock on this iPhone.
              </p>
            </div>
          )}

          {error ? (
            <p className="flex items-start gap-2 glass rounded-card px-4 py-3 text-subhead text-sys-red-text" role="alert">
              <Icon name="exclamationmark.triangle" size={18} />
              <span>{error}</span>
            </p>
          ) : null}

          {preparing ? (
            <p className="glass rounded-card px-4 py-3 text-center text-subhead text-label-2" aria-live="polite">
              Preparing photo…
            </p>
          ) : file ? (
            <div className="space-y-2">
              <Button variant="primary" size="lg" block onClick={() => void runOcr()}>
                Read Receipt
              </Button>
              <label htmlFor={cameraId} role="button" className={buttonClass({ variant: "plain", block: true, className: "cursor-pointer" })}>
                Retake Photo
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor={cameraId} role="button" className={buttonClass({ variant: "primary", size: "lg", block: true, className: "cursor-pointer" })}>
                <Icon name="camera" size={20} strokeWidth={2} />
                Take Photo
              </label>
              <label htmlFor={libraryId} role="button" className={buttonClass({ variant: "plain", block: true, className: "cursor-pointer" })}>
                Choose from Library
              </label>
            </div>
          )}

          <p className="px-4 text-footnote text-label-2">
            Works best with Costco, Walmart and grocery receipts. Nothing is uploaded.
          </p>
        </section>
      ) : null}

      {phase === "reading" ? (
        <section className="glass rounded-card px-6 py-10 text-center" aria-live="polite">
          <p className="text-headline text-label">{progressLabel}</p>
          <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-fill-3">
            <div className="h-full rounded-full bg-tint transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
          <p className="mt-3 text-footnote text-label-2">Reading text on this iPhone…</p>
        </section>
      ) : null}

      {phase === "review" ? (
        <section className="space-y-6">
          <ListSection
            header="Receipt"
            footer={
              <>
                {parsed?.total != null ? `Total ${formatPrice(parsed.total)} · ` : ""}
                {parsed?.tax != null ? `Tax ${formatPrice(parsed.tax)} · ` : ""}
                Lines add up to {formatPrice(lineSum)}
                {parsed?.subtotal != null && Math.abs(parsed.subtotal - lineSum) > 0.5
                  ? ` — subtotal says ${formatPrice(parsed.subtotal)}, check for misses.`
                  : "."}
                {` Read confidence ${Math.round(ocrConfidence)}%.`}
                {storageWarn ? " Photo not saved to save space." : ""}
              </>
            }
          >
            <FieldRow label="Store">
              <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Costco, Walmart…" />
            </FieldRow>
            <FieldRow label="Date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FieldRow>
          </ListSection>

          {lines.length === 0 ? (
            <EmptyState
              icon="doc.text"
              title="No Items Found"
              description="Try another photo with better light, flatter paper, and the whole receipt in frame."
              action={
                <Button variant="secondary" onClick={() => setPhase("capture")}>
                  Try Again
                </Button>
              }
            />
          ) : (
            lines.map((line, idx) => (
              <section key={line.key}>
                <div className="flex items-end justify-between px-4 pb-1.5">
                  <h3 className="text-footnote font-semibold text-label-2">Line {idx + 1}</h3>
                  {confTag(line.ocrConfidence)}
                </div>
                <div className="ios-group glass overflow-hidden rounded-card">
                  <FieldRow label="Item" stacked>
                    <input
                      value={line.description}
                      onChange={(e) => {
                        const description = e.target.value;
                        const match = matchLineToInventory(description, myItems);
                        updateLine(line.key, {
                          description,
                          match,
                          selectedItemId: line.action === "match" ? match.itemId : line.selectedItemId,
                        });
                      }}
                      className="min-h-[34px] w-full bg-transparent text-body text-label outline-none"
                    />
                  </FieldRow>
                  <FieldRow label="Quantity">
                    <TextInput
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step="any"
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) || 1 })}
                      className="w-24"
                    />
                  </FieldRow>
                  <FieldRow label="Paid">
                    <TextInput
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={line.price}
                      onChange={(e) => updateLine(line.key, { price: Number(e.target.value) || 0 })}
                      className="w-28 font-semibold"
                    />
                  </FieldRow>
                  <FieldRow label="Discount">
                    <TextInput
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={line.discountAmount ?? ""}
                      placeholder="None"
                      onChange={(e) =>
                        updateLine(line.key, {
                          discountAmount: e.target.value === "" ? null : Number(e.target.value) || 0,
                        })
                      }
                      className="w-28"
                    />
                  </FieldRow>
                  <div className="ios-row">
                    <div className="ios-row-inner ml-4 py-2 pr-4">
                      <SegmentedControl<AllocAction>
                        ariaLabel={`What to do with line ${idx + 1}`}
                        value={line.action}
                        onChange={(a) =>
                          updateLine(line.key, {
                            action: a,
                            selectedItemId: a === "match" ? line.match.itemId ?? line.selectedItemId : line.selectedItemId,
                          })
                        }
                        options={[
                          { value: "match", label: "Match" },
                          { value: "create", label: "New Item" },
                          { value: "skip", label: "Skip" },
                        ]}
                      />
                    </div>
                  </div>
                  {line.action === "match" ? (
                    <FieldRow label="Stock Item">
                      <SelectInput
                        value={line.selectedItemId ?? ""}
                        onChange={(e) => updateLine(line.key, { selectedItemId: e.target.value || null })}
                        className="max-w-[12rem]"
                      >
                        <option value="">Choose…</option>
                        {line.match.candidates.length > 0 ? (
                          <optgroup label="Best matches">
                            {line.match.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        <optgroup label="All items">
                          {sortedItems.map((i) => (
                            <option key={`all-${i.id}`} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </optgroup>
                      </SelectInput>
                    </FieldRow>
                  ) : null}
                  {line.action === "create" ? (
                    <FieldRow label="Room">
                      <SelectInput value={line.newFolder} onChange={(e) => updateLine(line.key, { newFolder: e.target.value })}>
                        {STOCK_FOLDERS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </SelectInput>
                    </FieldRow>
                  ) : null}
                </div>
              </section>
            ))
          )}

          {error ? (
            <p className="px-4 text-subhead text-sys-red-text" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Button variant="primary" size="lg" block onClick={confirm} disabled={selectedCount === 0}>
              {selectedCount ? `Add ${selectedCount} to Stock` : "Nothing Selected"}
            </Button>
            <Button
              variant="plain"
              block
              onClick={() => {
                setPhase("capture");
                setError(null);
              }}
            >
              Back to Photo
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "done" ? (
        <section className="flex flex-col items-center glass rounded-card px-6 py-10 text-center">
          <span className="text-sys-green" aria-hidden>
            <Icon name="checkmark.circle" size={56} strokeWidth={1.6} />
          </span>
          <h2 className="mt-3 text-title2 text-label">
            Logged {doneCount} {doneCount === 1 ? "Purchase" : "Purchases"}
          </h2>
          <p className="mt-1.5 max-w-xs text-subhead text-label-2">
            Quantities, prices and stores are updated. The receipt text is saved on this iPhone.
          </p>
          <div className="mt-6 w-full space-y-2">
            <Button variant="primary" size="lg" block onClick={() => router.push("/restock")}>
              Back to Restock
            </Button>
            <Button variant="plain" block onClick={resetCapture}>
              Scan Another
            </Button>
          </div>
        </section>
      ) : null}
    </Page>
  );
}
