# Home Inventory

Live: https://locusjosh.github.io/home-inventory/
Receipt OCR scan at /receipt (on-device tesseract.js).

## Features
- Receipt (/receipt): photo/upload, on-device OCR, fuzzy-match, confirm purchases
- Assist (/assist): voice + chat
- Purchase tracking from Restock, chat, or receipt
- Count mode, PWA, import/export JSON (purchases + receipt metadata)

## Receipt OCR
- On-device only; images never uploaded
- tesseract.js worker/core/lang from jsDelivr CDN
- OCR text + metadata stored; optional thumbnail; drops image if storage tight
- Review matches before confirm; lighting and flat receipts help accuracy

## Deploy
Build static export, touch out/.nojekyll, publish out/ to gh-pages branch of locusjosh/home-inventory.

## Tech
Next.js 15 static export, basePath /home-inventory, Tailwind, localStorage, tesseract.js dynamic import on /receipt
