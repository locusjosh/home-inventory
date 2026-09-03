# Home Inventory

Mobile-first home inventory webapp (Sortly replacement) built with Next.js App Router, TypeScript, and Tailwind CSS.

## Features

- **Stock count mode** — browse by folder with large +/- controls and typed quantities; autosaves to localStorage
- **Folders** — Bathroom, Cleaning, Family, Kitchen, Laundry, Maintenance, Outside, Suggested Items
- **Low stock** — items where quantity < minLevel (skips null min levels), with nav badge
- **Search** — filter by name
- **Item detail** — edit name, folder, quantity, unit, minLevel, price, vendor, notes, attributes; archive or delete
- **Add items** — create new entries
- **Suggested Items** — wishlist with one-tap move into a real folder
- **Restock list** — low-stock grouped by vendor with notes/price
- **Import / Export** — JSON import, JSON + CSV export, reset to seed
- **Dark mode** — optional toggle (persisted)

## Seed data

`data/seed.json` contains **97** items. Duplicate Sortly SIDs were uniquified (`id` gets `-2` suffix; original kept in `sortlyId`):

- Disposable Forks / Disposable Spoons (`SBO59T3193`)
- Detergent Pods / Scent Booster Beads (`SBO59T3199`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

```bash
npm run build
npm start
```

## Tech

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Client-side persistence via localStorage (seeded on first load)
- No auth / no backend

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Stock counts, folder chips, search |
| `/low-stock` | Low-stock list |
| `/restock` | Shopping / restock list by vendor |
| `/items/[id]` | Edit item details |
| `/add` | Add item |
| `/data` | Export / import / reset |
