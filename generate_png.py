#!/usr/bin/env python3
"""Generate PNG logo files for The Cork app at any size.

Usage:
    python3 generate_png.py --size 180 --output logo-180.png
    python3 generate_png.py --size 32 --output favicon-32.png
    python3 generate_png.py --size 180 --variant dark --output logo-dark-180.png

Requires: pip install cairosvg --break-system-packages
"""

import argparse
import os

LOGO_SVG = """<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8 C50 8 22 44 22 63 C22 78.5 34.5 91 50 91 C65.5 91 78 78.5 78 63 C78 44 50 8 50 8Z" fill="{drop_fill}" {drop_opacity}/>
  <circle cx="50" cy="60" r="18" fill="#c9a96e"/>
  <circle cx="44" cy="55" r="{dot_r}" fill="{grain}" opacity="0.6"/>
  <circle cx="53" cy="53" r="{dot_r_sm}" fill="{grain}" opacity="0.5"/>
  <circle cx="47" cy="62" r="{dot_r}" fill="{grain}" opacity="0.6"/>
  <circle cx="56" cy="58" r="{dot_r_sm}" fill="{grain}" opacity="0.5"/>
  <circle cx="43" cy="65" r="{dot_r_sm}" fill="{grain}" opacity="0.5"/>
  <circle cx="54" cy="66" r="{dot_r}" fill="{grain}" opacity="0.6"/>
  <circle cx="50" cy="57" r="{dot_r_xs}" fill="{grain}" opacity="0.4"/>
  <circle cx="58" cy="63" r="{dot_r_xs}" fill="{grain}" opacity="0.45"/>
</svg>"""

LOGO_SVG_SIMPLE = """<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8 C50 8 22 44 22 63 C22 78.5 34.5 91 50 91 C65.5 91 78 78.5 78 63 C78 44 50 8 50 8Z" fill="{drop_fill}" {drop_opacity}/>
  <circle cx="50" cy="60" r="18" fill="#c9a96e"/>
  <circle cx="45" cy="56" r="2.2" fill="{grain}" opacity="0.5"/>
  <circle cx="55" cy="59" r="1.8" fill="{grain}" opacity="0.5"/>
  <circle cx="49" cy="65" r="2.0" fill="{grain}" opacity="0.5"/>
</svg>"""

# Background rectangles for icon variants
BG_TEMPLATES = {
    "light": '<rect width="100" height="100" rx="22" fill="#f5f0eb"/>',
    "dark": '<rect width="100" height="100" rx="22" fill="#2c1810"/>',
    "wine": '<rect width="100" height="100" rx="22" fill="#722f37"/>',
    "none": "",
}

VARIANTS = {
    "light": {"drop_fill": "#722f37", "drop_opacity": "", "grain": "#a8854a"},
    "dark": {"drop_fill": "#722f37", "drop_opacity": "", "grain": "#a8854a"},
    "wine": {"drop_fill": "#f5f0eb", "drop_opacity": 'opacity="0.9"', "grain": "#8a6d3a"},
    "none": {"drop_fill": "#722f37", "drop_opacity": "", "grain": "#a8854a"},
}


def build_svg(size: int, variant: str, with_background: bool) -> str:
    v = VARIANTS[variant]

    if size <= 64:
        template = LOGO_SVG_SIMPLE
    else:
        template = LOGO_SVG
        v = {**v, "dot_r": "1.4", "dot_r_sm": "1.2", "dot_r_xs": "0.9"}

    logo_body = template.format(**v)

    if with_background:
        bg = BG_TEMPLATES[variant]
        # Wrap: background rect + scaled logo
        svg = f"""<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  {bg}
  <g transform="translate(15,12) scale(0.7)">
    {logo_body.replace('<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">', '').replace('</svg>', '')}
  </g>
</svg>"""
    else:
        svg = logo_body

    return svg


def main():
    parser = argparse.ArgumentParser(description="Generate The Cork logo PNGs")
    parser.add_argument("--size", type=int, default=180, help="Output size in pixels (default: 180)")
    parser.add_argument("--output", type=str, default="logo.png", help="Output filename")
    parser.add_argument("--variant", choices=["light", "dark", "wine", "none"], default="none",
                        help="Background variant (default: none = transparent)")
    parser.add_argument("--background", action="store_true",
                        help="Add rounded-rect background (for app icons)")
    parser.add_argument("--svg-only", action="store_true",
                        help="Output SVG instead of PNG")
    args = parser.parse_args()

    svg = build_svg(args.size, args.variant, args.background)

    if args.svg_only:
        out_path = args.output.replace(".png", ".svg")
        with open(out_path, "w") as f:
            f.write(svg)
        print(f"SVG saved: {out_path}")
    else:
        try:
            import cairosvg
        except ImportError:
            print("Error: cairosvg is required. Install with:")
            print("  pip install cairosvg --break-system-packages")
            return

        cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            write_to=args.output,
            output_width=args.size,
            output_height=args.size,
        )
        print(f"PNG saved: {args.output} ({args.size}x{args.size}px)")


if __name__ == "__main__":
    main()
