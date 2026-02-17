# The Cork - Wine Cellar Inventory App

## Quick Reference

| Item | Value |
|------|-------|
| **Stack** | Vanilla JS + Firebase (Realtime DB, Auth, Hosting, Cloud Functions) |
| **Language** | Dutch (UI), English (code) |
| **Project ID** | `the-cork-claude` |
| **Dev URL** | dev-the-cork-claude.web.app |
| **Prod URL** | the-cork-claude.web.app |
| **Cache version** | `?v=41` in index.html (increment on JS/CSS changes) |

## Project Structure

```
├── index.html              # Single-page app (Dutch UI)
├── app.js                  # Main app logic — WineCellar class (~2800 lines)
├── config.js               # Firebase config + API endpoints
├── styles.css              # iOS-inspired design system (~2900 lines)
├── logo.svg / logo.png     # Branding assets
├── firebase.json           # Hosting config (2 sites: prod + dev)
├── .firebaserc             # Project aliases
├── functions/
│   ├── index.js            # Cloud Functions (Node.js 20)
│   └── package.json        # firebase-functions v4.5.0
└── .github/workflows/
    ├── firebase-hosting-dev.yml        # Deploy on push to dev
    └── firebase-hosting-production.yml # Deploy on push to main
```

## Deploy

- **Dev**: Commit + push to `dev` branch → GitHub Actions deploys automatically.
- **Prod**: Merge `dev` into `main` + push → GitHub Actions deploys automatically.
- **Functions only**: `firebase deploy --only functions --project the-cork-claude`
- **NEVER** run `firebase deploy` manually for hosting. Always use git push.
- **Cache busting**: After changing app.js, styles.css, or config.js, increment `?v=N` on all script/link tags in index.html.

## Architecture

### Frontend
- Single HTML page, one JS file (`app.js` with `WineCellar` class), one CSS file.
- Firebase SDK 10.7.1 (compat version) loaded via CDN.
- No build step, no bundler, no framework.
- Mobile-first, iOS Human Interface Guidelines inspired.

### Backend — Cloud Functions

| Function | Model/API | Purpose |
|----------|-----------|---------|
| `analyzeWineLabel` | Gemini 2.5 Flash (Vision) | Full wine label → metadata |
| `quickAnalyzeWineLabel` | Gemini 2.0 Flash-Lite | Fast 6-field extraction |
| `lookupWinePrice` | Gemini 2.5 Flash + Google Search | EUR price lookup |
| `searchWineImage` | Serper.dev Images | Product photo (CORS proxy) |
| `deepAnalyzeWineLabel` | Gemini 2.5 Flash + Search | Text-based enrichment |
| `health` | — | Status check |

All functions require Firebase Auth (Bearer token). API keys via `functions.config()`.

### Database
- Firebase Realtime Database (europe-west1).
- Path: `/users/{uid}/wines/` and `/users/{uid}/archive/`.
- Real-time sync via `setupFirebaseListener()`.
- localStorage as offline fallback.

## Code Conventions

- **Variables/methods**: camelCase
- **Classes**: PascalCase (`WineCellar`, `SwipeHandler`)
- **Constants**: UPPERCASE (`CONFIG`)
- **Commit messages**: Dutch, short description of the change
- **No semicolons** in app.js — follow existing style
- **Comments**: Dutch or English, match surrounding context
- **Error handling**: try/catch with toast notifications to user
- **HTML IDs**: descriptive camelCase (`addModal`, `archiveBtn`, `yearModal`)

## Key Patterns

- **Fuzzy matching**: `matchExistingWine()` normalizes accents, removes titles like "Château"/"Domaine" for dedup.
- **Background enrichment**: After scan, price/image/details are fetched in parallel via `enrichWineInBackground()`.
- **Year prompt**: When Gemini can't extract vintage, a year picker modal (grid buttons) appears.
- **Swipe actions**: `SwipeHandler` class provides iOS-style left-swipe for archive/delete.
- **Demo mode**: If Cloud Functions are unavailable, app falls back to demo data.

## Design System

- **Primary color**: #722F37 (wine burgundy)
- **Fonts**: Outfit (logo/headlines), Space Grotesk (body), Inter (fine text)
- **Touch targets**: 44pt minimum (iOS standard)
- **Breakpoints**: 600px (mobile), 768px (tablet)
- **Wine type colors**: Red #722F37, White #E8D5A0, Rosé #E8B4B8, Sparkling #F5E6C8, Dessert #C4956A

## Wine Object Schema

```javascript
{
  id, enrichId, name, producer, type,  // type: red|white|rosé|sparkling|dessert
  year, region, grape,
  boldness, tannins, acidity,          // 1-5 scale
  price,                               // EUR float or null
  quantity, store,
  drinkFrom, drinkUntil,               // years (integers)
  notes, image,                        // image: data URI (compressed)
  addedAt                              // ISO 8601
}
```

## Things to Watch Out For

- **No test suite** — be careful with changes, test manually.
- **app.js is large** (~2800 lines) — read relevant sections before editing.
- **Cache busting is manual** — always update `?v=N` in index.html when changing JS/CSS.
- **functions.config()** is deprecated — migration to parameterized config planned.
- **Node.js 20** EOL April 2026 — upgrade planned.
