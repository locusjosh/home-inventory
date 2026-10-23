"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { STOCK_FOLDERS } from "@/lib/types";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { MiniStepper } from "@/components/ui/Controls";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { ActionSheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { PhotoInputs, usePhotoInputIds } from "@/components/PhotoInputs";
import { photoErrorMessage, prepareItemPhoto } from "@/components/ItemPhotoEditor";
import { savePhoto } from "@/lib/photoStore";

export default function AddItemPage() {
  const { addItem } = useInventory();
  const router = useRouter();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("Kitchen");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("units");
  const [minLevel, setMinLevel] = useState<string>("1");
  const [price, setPrice] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const { cameraId, libraryId } = usePhotoInputIds("add-photo");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const onPhoto = async (file: File) => {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const out = await prepareItemPhoto(file);
      setPhoto({ ...out, url: URL.createObjectURL(out.blob) });
    } catch (err) {
      console.error(err);
      setPhotoError(photoErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || saving || photoBusy) return;
    setSaving(true);
    const item = addItem({
      name: name.trim(),
      folder,
      quantity,
      unit: unit.trim() || "units",
      minLevel: minLevel === "" ? null : Number(minLevel),
      price: price === "" ? null : Number(price),
      vendor: vendor.trim() || null,
      notes: notes.trim() || null,
      attributes: [],
    });
    if (photo) {
      try {
        await savePhoto(item.id, photo.blob, { width: photo.width, height: photo.height });
      } catch (err) {
        console.error(err);
      }
    }
    router.push(`/items/edit/?id=${encodeURIComponent(item.id)}`);
  };

  return (
    <Page
      title="New Item"
      back={{ href: "/more", label: "More", useHistory: true }}
      actions={
        <Button variant="plain" onClick={() => void submit()} disabled={!name.trim() || saving || photoBusy} className="font-semibold">
          Add
        </Button>
      }
    >
      <PhotoInputs cameraId={cameraId} libraryId={libraryId} onFile={(f) => void onPhoto(f)} disabled={photoBusy} />
      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setPhotoSheet(true)}
            disabled={photoBusy}
            aria-hidden
            tabIndex={-1}
            className="pressable focus-ring relative h-32 w-32 overflow-hidden rounded-[22px] bg-bg-grouped-2"
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="New item photo" className="h-full w-full object-cover" data-testid="add-photo-preview" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-tint" aria-hidden>
                <Icon name="camera" size={40} strokeWidth={1.6} />
              </span>
            )}
            {photoBusy ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-footnote font-semibold text-white">
                Preparing…
              </span>
            ) : null}
          </button>
          <Button variant="plain" size="sm" onClick={() => setPhotoSheet(true)} disabled={photoBusy}>
            {photo ? "Edit Photo" : "Add Photo"}
          </Button>
          {photoError ? (
            <p role="alert" className="max-w-xs text-center text-subhead text-sys-red-text">
              {photoError}
            </p>
          ) : null}
        </div>

        <div className="ios-group overflow-hidden rounded-card bg-bg-grouped-2">
          <FieldRow label="Name">
            <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="Paper Towels" autoFocus />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput value={folder} onChange={(e) => setFolder(e.target.value)}>
              {STOCK_FOLDERS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
        </div>

        <div className="ios-group overflow-hidden rounded-card bg-bg-grouped-2">
          <div className="ios-row flex items-center">
            <div className="ios-row-inner ml-4 flex min-h-tap flex-1 items-center justify-between gap-3 py-1 pr-3">
              <span className="text-body text-label">Quantity</span>
              <div className="w-36">
                <MiniStepper value={quantity} onChange={setQuantity} label="New item" />
              </div>
            </div>
          </div>
          <FieldRow label="Unit">
            <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
          </FieldRow>
          <FieldRow label="Keep at Least">
            <TextInput type="number" min={0} step="any" inputMode="decimal" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} placeholder="Optional" />
          </FieldRow>
        </div>

        <div className="ios-group overflow-hidden rounded-card bg-bg-grouped-2">
          <FieldRow label="Price">
            <TextInput type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Optional" />
          </FieldRow>
          <FieldRow label="Store">
            <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" />
          </FieldRow>
          <FieldRow label="Notes" stacked>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Brand, size, where it’s kept…" />
          </FieldRow>
        </div>

        <Button type="submit" variant="primary" size="lg" block disabled={!name.trim() || saving || photoBusy}>
          Add Item
        </Button>
      </form>
      <ActionSheet
        open={photoSheet}
        onClose={() => setPhotoSheet(false)}
        title={photo ? "Item Photo" : "Add a Photo"}
        actions={[
          { label: "Take Photo", htmlFor: cameraId, onSelect: () => {} },
          { label: "Choose from Library", htmlFor: libraryId, onSelect: () => {} },
          ...(photo ? [{ label: "Remove Photo", destructive: true, onSelect: () => setPhoto(null) }] : []),
        ]}
      />
    </Page>
  );
}
