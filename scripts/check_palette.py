"""Check colour palettes: WCAG 2.2 contrast and status colours under colour-vision deficiency.

Usage:
    python3 scripts/check_palette.py [palettes.json]   (default: docs/design-plan/palettes.json)

Each theme needs: bg, surface, text, muted, primary, on_primary, line, and the
status colours in_office, in_class, busy, away. Checks:
  * text, muted text and primary-as-text: 4.5:1 on bg and surface;
  * status colours (icons, UI components): 3:1 on bg and surface;
  * on_primary text on the primary colour: 4.5:1;
  * how far apart the four status colours stay (CIE76 delta E) for normal
    vision and simulated protanopia / deuteranopia (Machado et al. 2009).
    Status is always icon + label + colour, so colour only needs to support
    the shape and the word; the plan targets a minimum delta E of 20.
Exits with status 1 if any contrast check fails or a delta E falls below 20.
"""
import itertools, json, math, sys

def hex_rgb(h): h = h.lstrip("#"); return [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def unlin(c): c = max(0, min(1, c)); return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def luminance(h): r, g, b = map(lin, hex_rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True); return (la + 0.05) / (lb + 0.05)

# Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
CVD = {
    "protanopia": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deuteranopia": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
}
def simulate(h, kind):
    v = [lin(c) for c in hex_rgb(h)]; m = CVD[kind]
    out = [unlin(sum(m[i][j] * v[j] for j in range(3))) for i in range(3)]
    return "#" + "".join(f"{round(c * 255):02x}" for c in out)
def lab(h):
    r, g, b = map(lin, hex_rgb(h))
    x, y, z = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z); return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
def delta_e(a, b): return math.dist(lab(a), lab(b))  # CIE76

def check(name, theme):
    p = theme
    fails = []
    rows = []
    def need(label, fg, bg, minimum):
        r = contrast(fg, bg); ok = r >= minimum; rows.append((label, fg, bg, round(r, 2), minimum, ok))
        if not ok: fails.append(label)
    for bg_name in ("bg", "surface"):
        need(f"text on {bg_name}", p["text"], p[bg_name], 4.5)
        need(f"muted text on {bg_name}", p["muted"], p[bg_name], 4.5)
        need(f"primary (as text/links) on {bg_name}", p["primary"], p[bg_name], 4.5)
        for s in ("in_office", "in_class", "busy", "away"):
            need(f"status {s} (icon, UI 3:1) on {bg_name}", p[s], p[bg_name], 3.0)
    need("text on primary button", p["on_primary"], p["primary"], 4.5)
    need("hairline vs surface (decorative, informational only)", p["line"], p["surface"], 1.0)
    statuses = ["in_office", "in_class", "busy", "away"]
    cvd = {}
    for kind in ("normal", "protanopia", "deuteranopia"):
        col = {s: (p[s] if kind == "normal" else simulate(p[s], kind)) for s in statuses}
        cvd[kind] = {f"{a}/{b}": round(delta_e(col[a], col[b]), 1) for a, b in itertools.combinations(statuses, 2)}
    return rows, fails, cvd

MIN_DELTA_E = 20

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "docs/design-plan/palettes.json"
    themes = json.load(open(path, encoding="utf-8"))
    failed = False
    for name, theme in themes.items():
        rows, fails, cvd = check(name, theme)
        weak = [k for k, pairs in cvd.items() if min(pairs.values()) < MIN_DELTA_E]
        failed |= bool(fails or weak)
        print(f"\n=== {name}: {'PASS' if not (fails or weak) else 'FAIL ' + ', '.join(fails + weak)}")
        for label, fg, bg, r, m, ok in rows:
            print(f"  {'ok ' if ok else 'BAD'} {r:>5}:1 (min {m})  {label:<45} {fg} on {bg}")
        for kind, pairs in cvd.items():
            worst = min(pairs.items(), key=lambda kv: kv[1])
            print(f"  ΔE {kind:<12} min {worst[1]:>5} ({worst[0]})   " + "  ".join(f"{k}={v}" for k, v in pairs.items()))
    sys.exit(1 if failed else 0)
