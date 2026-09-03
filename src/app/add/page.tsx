"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { FOLDERS } from "@/lib/types";

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Add item</h1>
        <p className="text-sm text-ink-muted">Create a new inventory entry</p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-surface p-4 shadow-soft">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Folder</span>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
          >
            {FOLDERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Quantity</span>
            <input
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Unit</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Min level</span>
            <input
              type="number"
              min={0}
              step="any"
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
              placeholder="optional"
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Price</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="optional"
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Vendor</span>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Save item
        </button>
      </form>
    </div>
  );
}
