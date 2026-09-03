# Home Inventory

**Live:** https://locusjosh.github.io/home-inventory/

Count mode, PWA, restock shop links, **Jarvis Assist** (voice + chat), **purchase tracking** for inflation. Static export basePath `/home-inventory`.

## Features
- **Assist** (/assist): on-device voice + chat (Web Speech, no cloud AI)
- **Purchase tracking**: log price paid / list / promo from Restock (2 taps) or chat
- Count mode (/count): room-by-room, stamps lastCountedAt
- Stock home: Needs count, summary strip, sort options
- Use 1; Restock shop links + Mark restocked + Copy list
- PWA: manifest, icons, Add to Home Screen tip, shell SW
- Import/Export JSON (incl. purchases) + CSV

## iPhone tips
- Safari ← Allow Microphone for voice
- **Silent Mode** (ringer switch) can mute spoken replies — turn it off to hear TTS
- Tap mic to toggle listen (no hold-to-talk)

## Deploy

```bash
npm run build
touch out/.nojekyll
npx gh-pages -d out -r https://github.com/locusjosh/home-inventory.git
```

## Tech

Next.js 15 static export, basePath /home-inventory, Tailwind, localStorage
