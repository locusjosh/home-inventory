# Home Inventory

**Live:** https://locusjosh.github.io/home-inventory/

Count mode, PWA, restock shop links, Use 1, Needs count, sort options. Static export basePath /home-inventory.

See Features in app: /count, /restock, Add to Home Screen tip on /data.
## Features
- Count mode (/count): room-by-room, stamps lastCountedAt
- Stock home: Needs count, summary strip, sort options
- Use 1; Restock shop links + Mark restocked + Copy list
- PWA: manifest, icons, Add to Home Screen tip, shell SW
- Import/Export JSON+CSV, low stock, folders, dark mode

## Deploy

npm run build then touch out/.nojekyll then gh-pages -d out

## Tech

Next.js 15 static export, basePath /home-inventory, Tailwind, localStorage
