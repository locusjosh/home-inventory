"use client";

import { Suspense } from "react";
import ItemDetailClient from "../ItemDetailClient";

export default function ItemEditPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
          Loading item…
        </div>
      }
    >
      <ItemDetailClient />
    </Suspense>
  );
}
