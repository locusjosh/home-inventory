"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { STOCK_FOLDERS } from "@/lib/types";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { MiniStepper } from "@/components/ui/Controls";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/ui/Form";

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

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
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
    router.push(`/items/edit/?id=${encodeURIComponent(item.id)}`);
  };

  return (
    <Page
      title="New Item"
      back={{ href: "/more", label: "More", useHistory: true }}
      actions={
        <Button variant="plain" onClick={() => submit()} disabled={!name.trim()} className="font-semibold">
          Add
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-6">
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

        <Button type="submit" variant="primary" size="lg" block disabled={!name.trim()}>
          Add Item
        </Button>
      </form>
    </Page>
  );
}
