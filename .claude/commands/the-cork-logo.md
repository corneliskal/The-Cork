---
name: the-cork-logo
description: Use this skill whenever you need to add, display, or reference The Cork app logo or branding. This includes generating the logo SVG inline, creating apple-touch-icon PNGs, adding the logo to HTML pages, creating favicon files, building splash screens, or any branding-related task for The Cork wine cellar inventory app. Trigger whenever the user mentions "logo", "icon", "branding", "favicon", "apple-touch-icon", or "splash screen" in the context of The Cork app.
---

# The Cork — Logo & Branding Skill

This skill provides the official logo, brand assets, and usage guidelines for **The Cork** wine cellar inventory app.

## Logo Concept

The logo is a **wine drop** with a **cork cross-section** at its center — the duality of liquid and stopper. The cork texture is represented by small organic dots within a golden circle.

## Quick Usage

### Inline SVG (preferred for web)

Use this SVG markup to embed the logo directly in HTML. Adjust `width` and `height` as needed:

```html
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8 C50 8 22 44 22 63 C22 78.5 34.5 91 50 91 C65.5 91 78 78.5 78 63 C78 44 50 8 50 8Z" fill="#722f37"/>
  <circle cx="50" cy="60" r="18" fill="#c9a96e"/>
  <circle cx="44" cy="55" r="1.4" fill="#a8854a" opacity="0.6"/>
  <circle cx="53" cy="53" r="1.1" fill="#a8854a" opacity="0.5"/>
  <circle cx="47" cy="62" r="1.5" fill="#a8854a" opacity="0.6"/>
  <circle cx="56" cy="58" r="1.2" fill="#a8854a" opacity="0.5"/>
  <circle cx="43" cy="65" r="1.2" fill="#a8854a" opacity="0.5"/>
  <circle cx="54" cy="66" r="1.3" fill="#a8854a" opacity="0.6"/>
  <circle cx="50" cy="57" r="0.9" fill="#a8854a" opacity="0.4"/>
  <circle cx="58" cy="63" r="1.0" fill="#a8854a" opacity="0.45"/>
</svg>
```

### Simplified SVG (for small sizes ≤ 64px)

At small sizes, reduce the cork texture dots for clarity:

```html
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8 C50 8 22 44 22 63 C22 78.5 34.5 91 50 91 C65.5 91 78 78.5 78 63 C78 44 50 8 50 8Z" fill="#722f37"/>
  <circle cx="50" cy="60" r="18" fill="#c9a96e"/>
  <circle cx="45" cy="56" r="2.2" fill="#a8854a" opacity="0.5"/>
  <circle cx="55" cy="59" r="1.8" fill="#a8854a" opacity="0.5"/>
  <circle cx="49" cy="65" r="2.0" fill="#a8854a" opacity="0.5"/>
</svg>
```

### Generating a PNG (for apple-touch-icon / favicon)

Use this Python script to generate PNG files from the SVG at any size. Requires `cairosvg` (`pip install cairosvg --break-system-packages`).

```bash
python3 /path/to/skill/assets/generate_png.py --size 180 --output logo-180.png
python3 /path/to/skill/assets/generate_png.py --size 32 --output favicon-32.png
```

For a quick alternative without dependencies, use the pre-made SVG file at `assets/logo.svg` and convert with any tool.

## HTML Head Tags

Always include these tags in the `<head>` of The Cork's HTML pages to ensure the logo appears in browser tabs and Safari favorites:

```html
<link rel="apple-touch-icon" sizes="180x180" href="/logo-180.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
```

## Logo + Text Lockups

### Font

Use **Outfit** (Google Fonts) for all text lockups:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Stacked: Icon + Title

```html
<div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
  <!-- SVG logo here at width="64" height="64" -->
  <span style="font-family:'Outfit',sans-serif;font-weight:600;font-size:1.4rem;letter-spacing:0.06em;text-transform:uppercase;">The Cork</span>
</div>
```

### Stacked: Icon + Title + Subtitle

```html
<div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
  <!-- SVG logo here at width="64" height="64" -->
  <div style="text-align:center;">
    <div style="font-family:'Outfit',sans-serif;font-weight:600;font-size:1.4rem;letter-spacing:0.06em;text-transform:uppercase;">The Cork</div>
    <div style="font-family:'Outfit',sans-serif;font-weight:400;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;opacity:0.55;margin-top:4px;">Wine Cellar Inventory</div>
  </div>
</div>
```

### Horizontal: Icon + Title + Subtitle

```html
<div style="display:flex;align-items:center;gap:16px;">
  <!-- SVG logo here at width="48" height="48" -->
  <div>
    <div style="font-family:'Outfit',sans-serif;font-weight:600;font-size:1.5rem;letter-spacing:0.06em;text-transform:uppercase;">The Cork</div>
    <div style="font-family:'Outfit',sans-serif;font-weight:400;font-size:0.58rem;letter-spacing:0.15em;text-transform:uppercase;opacity:0.55;margin-top:2px;">Wine Cellar Inventory</div>
  </div>
</div>
```

## Color Palette

| Name         | Hex       | Usage                              |
|--------------|-----------|-------------------------------------|
| Burgundy     | `#722f37` | Wine drop, primary brand color      |
| Deep Wine    | `#501b22` | Dark backgrounds, gradients         |
| Cork Gold    | `#c9a96e` | Cork circle, accents, headings      |
| Cork Grain   | `#a8854a` | Texture dots, secondary accents     |
| Parchment    | `#f5f0eb` | Light backgrounds                   |
| Cellar Dark  | `#2c1810` | Dark mode backgrounds               |

### CSS Variables

```css
:root {
  --cork-burgundy: #722f37;
  --cork-deep-wine: #501b22;
  --cork-gold: #c9a96e;
  --cork-grain: #a8854a;
  --cork-parchment: #f5f0eb;
  --cork-cellar-dark: #2c1810;
}
```

## Background Variants

The logo works on three backgrounds:

1. **Light** — `#f5f0eb` to `#ede5db` gradient (default)
2. **Dark** — `#2c1810` to `#1a0e08` gradient
3. **Wine** — `#722f37` to `#501b22` gradient (use cream/parchment drop instead of burgundy)

On wine backgrounds, invert the drop fill to `#f5f0eb` with `opacity="0.9"` so it remains visible.

## Do's and Don'ts

- **Do** keep the cork texture dots — they distinguish this from a generic drop icon
- **Do** maintain the proportions of the viewBox (the drop shape and circle position)
- **Do** simplify the texture dots at sizes below 64px
- **Don't** stretch or distort the aspect ratio
- **Don't** change the burgundy/gold color relationship
- **Don't** add outlines or strokes to the drop shape
- **Don't** place on busy backgrounds without sufficient contrast
