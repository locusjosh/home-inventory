"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { STOCK_FOLDERS } from "@/lib/types";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { MiniStepper } from "@/components/ui/Controls";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { PhotoGallery } from "@/components/PhotoGallery";
import { photoErrorMessage, prepareItemPhoto } from "@/components/ItemPhotoEditor";
import { ProductUrlField } from "@/components/ProductLink";
import { savePhoto } from "@/lib/photoStore";
import { MAX_PHOTOS, moveSlot, newPhotoKey } from "@/lib/photoOrder";
import { uid } from "@/lib/utils";

type Pending = { id: string; kind: "user"; blob: Blob; url: string; width: number; height: number };

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
  const [itemId] = useState(() => uid("local"));
  const [photos, setPhotos] = useState<Pending[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [urlValid, setUrlValid] = useState(true);
  const [saving, setSaving] = useState(false);

  // Revoke preview URLs on unmount.
  const [urlsToRevoke] = useState<Set<string>>(() => new Set());
  useEffect(() => () => urlsToRevoke.forEach((u) => URL.revokeObjectURL(u)), [urlsToRevoke]);

  const onPhoto = async (file: File) => {
    setPhotoError(null);
    if (photos.length >= MAX_PHOTOS) {
      setPhotoError(`An item can have up to ${MAX_PHOTOS} photos. Delete one to add another.`);
      return;
    }
    setPhotoBusy(true);
    try {
      const out = await prepareItemPhoto(file);
      const url = URL.createObjectURL(out.blob);
      urlsToRevoke.add(url);
      setPhotos((p) => [...p, { ...out, url, kind: "user" as const, id: newPhotoKey(itemId) }].slice(0, MAX_PHOTOS));
    } catch (err) {
      console.error(err);
      setPhotoError(photoErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || saving || photoBusy || !urlValid) return;
    setSaving(true);
    // Write photos first so the new item's cover is there when the detail page opens.
    const saved: string[] = [];
    for (const p of photos) {
      try {
        await savePhoto(p.id, p.blob, { width: p.width, height: p.height });
        saved.push(p.id);
      } catch (err) {
        console.error(err);
      }
    }
    const item = addItem({
      id: itemId,
      productUrl,
      photoOrder: saved,
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
    router.push(`/items/edit/?id=${encodeURIComponent(item.id)}`);
  };

  return (
    <Page
      title="New Item"
      back={{ href: "/more", label: "More", useHistory: true }}
      actions={
        <Button variant="plain" onClick={() => void submit()} disabled={!name.trim() || saving || photoBusy || !urlValid} className="font-semibold">
          Add
        </Button>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        <div className="rounded-card bg-bg-grouped-2 p-3">
          <PhotoGallery
            idPrefix="add-photo"
            emptyClassName="h-40"
            name={name.trim() || "new item"}
            slots={photos}
            busy={photoBusy}
            error={photoError}
            onAddFile={(f) => void onPhoto(f)}
            onMove={(from, to) => setPhotos((p) => moveSlot(p.map((x) => x.id), from, to).map((id) => p.find((x) => x.id === id)!))}
            onMakeCover={(i) => setPhotos((p) => moveSlot(p.map((x) => x.id), i, 0).map((id) => p.find((x) => x.id === id)!))}
            onDelete={(i) => setPhotos((p) => p.filter((_, j) => j !== i))}
          />
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
          <ProductUrlField value={productUrl} onCommit={setProductUrl} onValidityChange={setUrlValid} />
          <FieldRow label="Notes" stacked>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Brand, size, where it’s kept…" />
          </FieldRow>
        </div>

        <Button type="submit" variant="primary" size="lg" block disabled={!name.trim() || saving || photoBusy || !urlValid}>
          Add Item
        </Button>
      </form>
    </Page>
  );
}
