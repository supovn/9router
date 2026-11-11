"""Build a subset of the Material Symbols Outlined icon font.

The full font from the `material-symbols` package is ~4 MB (every icon, every
axis). The dashboard uses ~200 icons and only the FILL axis, so this keeps:
  - icons whose ligature name appears as a string/JSX text anywhere in src/ or open-sse/
    (a superset: dynamic `icon` values defined in code are caught too)
  - FILL 0..1 as a variable axis; wght/GRAD/opsz pinned to 400/0/24 to match
    the `.material-symbols-outlined` rules in globals.css

Re-run after merging upstream or adding icons:
    pip install fonttools brotli
    python scripts/subset-material-symbols.py
"""
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FONT_IN = ROOT / "node_modules" / "material-symbols" / "material-symbols-outlined.woff2"
OUT_DIR = ROOT / "src" / "app" / "fonts"
FONT_OUT = OUT_DIR / "material-symbols-outlined.subset.woff2"
LIST_OUT = OUT_DIR / "material-symbols-outlined.icons.txt"

PINNED_AXES = {"wght": 400, "GRAD": 0, "opsz": 24}
LIGATURE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_"
# open-sse/ too: provider registry entries carry `icon` names the dashboard renders.
SOURCE_DIRS = ("src", "open-sse")
SOURCE_GLOBS = ("*.js", "*.jsx", "*.css")
# Quoted strings, and JSX text nodes — which may sit on their own line:
#   <span className="material-symbols-outlined">\n  apps\n</span>
TOKEN_RE = re.compile(r"""["'`]([a-z0-9_]+)["'`]|>\s*([a-z0-9_]+)\s*<""")


def ligature_map(font):
    """Ligature name -> icon glyph, read from the font's GSUB tables."""
    rev = {g: chr(u) for u, g in font.getBestCmap().items()}
    names = {}
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 7:
                st = st.ExtSubTable
            for first, ligs in getattr(st, "ligatures", {}).items():
                for lig in ligs:
                    comps = [first] + lig.Component
                    if all(c in rev for c in comps):
                        names["".join(rev[c] for c in comps)] = lig.LigGlyph
    return names


def used_tokens():
    tokens = set()
    for pattern in SOURCE_GLOBS:
        for path in (p for d in SOURCE_DIRS for p in (ROOT / d).rglob(pattern)):
            for quoted, text in TOKEN_RE.findall(path.read_text(encoding="utf-8", errors="ignore")):
                tokens.add(quoted or text)
    return tokens


def main():
    if not FONT_IN.exists():
        sys.exit(f"Font not found: {FONT_IN} (run the package install first)")

    font = TTFont(FONT_IN)
    names = ligature_map(font)
    icons = sorted(t for t in used_tokens() if t in names)

    cmap = font.getBestCmap()
    glyphs = {names[i] for i in icons} | {cmap[ord(c)] for c in LIGATURE_CHARS if ord(c) in cmap}

    options = Options()
    options.layout_closure = False  # keep only the ligatures whose icon glyph we keep
    options.layout_features = ["rlig", "rclt", "liga"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = Subsetter(options)
    subsetter.populate(glyphs=sorted(glyphs), unicodes=[ord(c) for c in LIGATURE_CHARS])
    subsetter.subset(font)

    # Pin axes after subsetting: far fewer glyphs to instance.
    font = instancer.instantiateVariableFont(font, PINNED_AXES)
    font.flavor = "woff2"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    font.save(FONT_OUT)
    LIST_OUT.write_text("\n".join(icons) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(icons)} icons -> {FONT_OUT.relative_to(ROOT)} ({FONT_OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
