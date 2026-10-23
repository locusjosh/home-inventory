"use client";

import { Suspense } from "react";
import ItemDetailClient from "../ItemDetailClient";

export default function ItemEditPage() {
  return (
    <Suspense
      fallback={null}
    >
      <ItemDetailClient />
    </Suspense>
  );
}
