"""Build the Melatonyne wordmark SVGs from the bundled Montserrat font.

Two assets come out:
  welcome-brand.svg  lockup (monogram + wordmark) for the welcome window
  wordmark.svg       text only, for the sidebar which already shows the mark

Outlines (not live text) keep the assets self-contained; an <img> cannot use a
webfont, and the sidebar renders the wordmark as an image.
"""
import math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = 'welcome/lib/welcome/montserrat-medium.woff2'
OUT_LOCKUP = 'welcome/renderer/assets/welcome-brand.svg'
OUT_TEXT = 'welcome/renderer/assets/wordmark.svg'
TEXT = 'elatonyne'  # the monogram supplies the capital M
SIZE = 30.0
BASELINE = 30.0
HEIGHT = 40.0
TRACKING = 1.0

font = TTFont(FONT)
cmap = font.getBestCmap()
glyph_set = font.getGlyphSet()
hmtx = font['hmtx']
upem = font['head'].unitsPerEm
scale = SIZE / upem

mono_w, mono_x, mono_y, mono_h = 26.0, 3.0, 7.0, 26.0
mono = (
    f'M{mono_x:.2f} {mono_y + mono_h:.2f}'
    f'V{mono_y:.2f}'
    f'L{mono_x + mono_w / 2:.2f} {mono_y + mono_h * 0.58:.2f}'
    f'L{mono_x + mono_w:.2f} {mono_y:.2f}'
    f'V{mono_y + mono_h:.2f}'
)


def text_paths(start_x: float):
    cursor = start_x
    out = []
    for ch in TEXT:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(glyph_set)
        glyph_set[gname].draw(pen)
        d = pen.getCommands()
        if d:
            out.append(
                f'<path d="{d}" transform="translate({cursor:.2f} {BASELINE:.2f}) '
                f'scale({scale:.6f} {-scale:.6f})"/>'
            )
        cursor += hmtx[gname][0] * scale + TRACKING
    return out, cursor


glyph_paths, end = text_paths(mono_x + mono_w + 12.0)
width = math.ceil(end + 3)
style = (
    '<style>\n'
    '  :root { --ml-ink: #0f1115; }\n'
    '  @media (prefers-color-scheme: dark) { :root { --ml-ink: #f9fafb; } }\n'
    '</style>\n'
)
mono_group = (
    '<g fill="var(--ml-ink)" stroke="var(--ml-ink)">\n'
    f'  <path d="{mono}" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>\n'
    '</g>\n'
)
def doc(w: int, inner: str) -> str:
    return (
        f'<svg width="{w}" height="{HEIGHT:.0f}" viewBox="0 0 {w} {HEIGHT:.0f}" '
        'fill="none" xmlns="http://www.w3.org/2000/svg">\n'
        f'{style}{inner}</svg>\n'
    )

lockup = doc(width, mono_group + '<g fill="var(--ml-ink)">\n' + '\n'.join(glyph_paths) + '\n</g>\n')

text_only_paths, text_end = text_paths(2.0)
text_width = math.ceil(text_end + 2)
text_only = doc(text_width, '<g fill="var(--ml-ink)">\n' + '\n'.join(text_only_paths) + '\n</g>\n')

open(OUT_LOCKUP, 'w', encoding='utf-8', newline='\n').write(lockup)
open(OUT_TEXT, 'w', encoding='utf-8', newline='\n').write(text_only)
print('lockup width', width, '| text width', text_width)
