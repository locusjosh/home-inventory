# Home Inventory

**Live:** https://locusjosh.github.io/home-inventory/

Count mode, PWA, restock shop links, Use 1, Needs count, **local inventory chat** on Data. Static export basePath `/home-inventory`.

## Features
- **Inventory chat** (/data): ask stock / update counts on-device (no API)
- Count mode (/count): room-by-room, stamps lastCountedAt
- Stock home: Needs count, summary strip, sort options
- Use 1; Restock shop links + Mark restocked + Copy list
- PWA: manifest, icons, Add to Home Screen tip, shell SW
- Import/Export JSON+CSV, low stock, folders, dark mode

## Deploy

```bash
npm run build
touch out/.nojekyll
npx gh-pages -d out
```

## Tech

Next.js 15 static export, basePath /home-inventory, Tailwind, localStorage
