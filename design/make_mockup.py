"""Generates design/mockup_v1.png - a preview of the game screen for the team to iterate on.
Run: python design/make_mockup.py"""
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 900
BG = (8, 12, 18)
PANEL = (14, 20, 30)
LINE = (40, 60, 80)
CYAN = (90, 220, 255)
RED = (255, 70, 70)
AMBER = (255, 180, 60)
GREEN = (90, 230, 140)
DIM = (120, 140, 160)
WHITE = (230, 238, 245)

F = "C:/Windows/Fonts/"
def font(name, size):
    try:
        return ImageFont.truetype(F + name, size)
    except OSError:
        return ImageFont.load_default()

H1 = font("bahnschrift.ttf", 30); H2 = font("bahnschrift.ttf", 20); H3 = font("bahnschrift.ttf", 16)
MONO = font("consola.ttf", 16); MONO_S = font("consola.ttf", 13); BIG = font("bahnschrift.ttf", 40)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

def panel(x, y, w, h, title=None, accent=LINE):
    d.rounded_rectangle([x, y, x + w, y + h], 10, fill=PANEL, outline=accent, width=2)
    if title:
        d.text((x + 14, y + 10), title, font=H3, fill=CYAN)

# ---------- top bar ----------
d.rectangle([0, 0, W, 60], fill=(10, 16, 24))
d.line([0, 60, W, 60], fill=LINE, width=2)
d.text((20, 13), "ANATOMY PARK", font=H1, fill=RED)
d.text((248, 24), "(working title)", font=MONO_S, fill=DIM)
d.text((420, 20), "PATIENT: SAM, 21  ·  CLOCK 17:42 (x60)  ·  DAY 1", font=H2, fill=WHITE)
d.rounded_rectangle([1060, 12, 1580, 48], 8, fill=(60, 10, 10), outline=RED, width=2)
d.text((1076, 19), "SEV-1 INCIDENT · ROOT CAUSE: UNKNOWN", font=H2, fill=RED)

# ---------- left: scan modes (Arkham-style detective vision) ----------
panel(20, 80, 230, 520, "SCAN MODE  [1-6]")
modes = [("SKELETAL", (220, 220, 200)), ("CIRCULATORY", RED), ("RESPIRATORY", CYAN), ("NERVOUS", AMBER), ("DIGESTIVE", (200, 140, 90)), ("ORGANS", (210, 120, 200))]
for i, (m, c) in enumerate(modes):
    y = 120 + i * 76
    active = m == "CIRCULATORY"
    d.rounded_rectangle([36, y, 234, y + 60], 8, fill=(40, 12, 14) if active else (18, 26, 36), outline=c if active else LINE, width=3 if active else 1)
    d.ellipse([48, y + 20, 68, y + 40], fill=c)
    d.text((80, y + 10), m, font=H2, fill=WHITE if active else DIM)
    d.text((80, y + 36), "clues: 2" if m in ("CIRCULATORY", "RESPIRATORY") else "clues: ?", font=MONO_S, fill=c if active else DIM)

# timeline of the patient's live day
panel(20, 615, 230, 265, "PATIENT'S DAY (LIVE)")
for i, (t, e, c) in enumerate([("08:00", "coffee", DIM), ("09:30", "6h flight", AMBER), ("16:00", "football", DIM), ("17:20", "chest pain!", RED), ("17:42", "breathless", RED)]):
    y = 650 + i * 44
    d.ellipse([36, y + 4, 48, y + 16], fill=c)
    if i < 4:
        d.line([42, y + 16, 42, y + 48], fill=LINE, width=2)
    d.text((60, y), t, font=MONO, fill=WHITE)
    d.text((120, y), e, font=MONO, fill=c)

# ---------- centre: the body (circulatory scan active) ----------
cx, top = 680, 90
scan = Image.new("RGB", (W, H), BG)
s = ImageDraw.Draw(scan)
# scan-mode tint field
for r in range(380, 0, -6):
    a = int(10 + 30 * (1 - r / 380))
    s.ellipse([cx - r, 480 - r * 1.15, cx + r, 480 + r * 1.15], fill=(a, int(a * 0.25), int(a * 0.3)))
img.paste(scan.filter(ImageFilter.GaussianBlur(20)), (0, 0), Image.new("L", (W, H), 0).point(lambda _: 0))
d = ImageDraw.Draw(img)
glow = Image.new("RGB", (W, H), (0, 0, 0)); g = ImageDraw.Draw(glow)

body = (35, 55, 75)
outline = (70, 110, 140)
# silhouette
d.ellipse([cx - 52, top + 10, cx + 52, top + 125], fill=body, outline=outline, width=2)          # head
d.rectangle([cx - 20, top + 120, cx + 20, top + 150], fill=body)                                  # neck
d.rounded_rectangle([cx - 115, top + 145, cx + 115, top + 470], 60, fill=body, outline=outline, width=2)  # torso
for sgn in (-1, 1):
    ax = cx + sgn * 150
    d.polygon([(cx + sgn * 105, top + 165), (cx + sgn * 140, top + 160), (ax + sgn * 25, top + 420), (ax - sgn * 5, top + 425)], fill=body, outline=outline)  # arms
    d.polygon([(cx + sgn * 15, top + 460), (cx + sgn * 105, top + 455), (cx + sgn * 80, top + 790), (cx + sgn * 30, top + 790)], fill=body, outline=outline)  # legs

# faint organs (other layers, dimmed)
d.ellipse([cx - 32, top + 35, cx + 32, top + 95], outline=(80, 70, 110), width=2)  # brain
for sgn in (-1, 1):
    d.ellipse([cx + sgn * 20 - (70 if sgn < 0 else 0), top + 180, cx + sgn * 20 + (0 if sgn < 0 else 70), top + 330], outline=(60, 120, 150), width=2)  # lungs
d.polygon([(cx + 10, top + 370), (cx + 95, top + 345), (cx + 80, top + 395), (cx + 10, top + 400)], outline=(110, 80, 60))  # liver

# circulatory layer: vessels (active scan, glowing)
def vessel(pts, col, w):
    d.line(pts, fill=col, width=w, joint="curve")
    g.line(pts, fill=col, width=w + 8, joint="curve")
heart = (cx + 12, top + 265)
vessel([heart, (cx + 5, top + 200), (cx, top + 150), (cx, top + 60)], (230, 60, 60), 5)                        # carotid
vessel([heart, (cx - 5, top + 320), (cx - 8, top + 440), (cx - 50, top + 500), (cx - 60, top + 620), (cx - 58, top + 770)], (230, 60, 60), 5)  # aorta -> left leg
vessel([(cx - 8, top + 440), (cx + 50, top + 500), (cx + 60, top + 620), (cx + 58, top + 770)], (230, 60, 60), 5)                  # right leg
vessel([heart, (cx + 60, top + 200), (cx + 135, top + 200), (cx + 160, top + 330), (cx + 168, top + 420)], (230, 60, 60), 4)        # arm
vessel([heart, (cx - 60, top + 200), (cx - 135, top + 200), (cx - 160, top + 330), (cx - 168, top + 420)], (230, 60, 60), 4)
vessel([(cx + 22, top + 255), (cx + 22, top + 330), (cx + 18, top + 450), (cx + 40, top + 520), (cx + 48, top + 760)], (90, 110, 240), 4)  # vena cava
vessel([(cx + 5, top + 250), (cx - 45, top + 240), (cx - 60, top + 270)], (90, 110, 240), 3)   # pulmonary to lungs
vessel([(cx + 5, top + 250), (cx + 50, top + 240), (cx + 65, top + 270)], (90, 110, 240), 3)
# heart
d.ellipse([heart[0] - 24, heart[1] - 22, heart[0] + 24, heart[1] + 22], fill=(200, 40, 50), outline=(255, 120, 120), width=2)
g.ellipse([heart[0] - 34, heart[1] - 32, heart[0] + 34, heart[1] + 32], fill=(200, 40, 50))

# hotspots (clues)
def hotspot(x, y, label, col=RED):
    for r, a in ((34, 60), (24, 120), (14, 255)):
        g.ellipse([x - r, y - r, x + r, y + r], fill=tuple(int(c * a / 255) for c in col))
    d.ellipse([x - 12, y - 12, x + 12, y + 12], outline=col, width=3)
    d.line([x + 14, y - 10, x + 60, y - 40], fill=col, width=2)
    d.rounded_rectangle([x + 58, y - 58, x + 58 + 9 * len(label) + 20, y - 30], 6, fill=(40, 10, 12), outline=col)
    d.text((x + 68, y - 54), label, font=MONO_S, fill=WHITE)
hotspot(cx - 62, top + 640, "L calf: swollen, warm")
hotspot(cx - 55, top + 265, "pulmonary artery: blocked?", AMBER)

# nanobot (the player) + trail
for i in range(14):
    t = i / 13
    x = cx - 8 - 42 * t; y = top + 440 + 60 * t
    r = 2 + 4 * t
    d.ellipse([x - r, y - r, x + r, y + r], fill=(int(40 + 50 * t), int(120 + 100 * t), 255))
bx, by = cx - 50, top + 500
g.ellipse([bx - 26, by - 26, bx + 26, by + 26], fill=(40, 160, 220))
d.ellipse([bx - 11, by - 11, bx + 11, by + 11], fill=CYAN, outline=WHITE, width=2)
d.text((bx - 120, by + 14), "YOU (nanobot)", font=MONO_S, fill=CYAN)

img = Image.blend(img, Image.composite(glow.filter(ImageFilter.GaussianBlur(10)), img, Image.new("L", (W, H), 255)), 0.0)
img = Image.fromarray(__import__("numpy").clip(__import__("numpy").asarray(img, dtype="int16") + __import__("numpy").asarray(glow.filter(ImageFilter.GaussianBlur(9)), dtype="int16") // 2, 0, 255).astype("uint8")) if True else img
d = ImageDraw.Draw(img)
# scanlines
for y in range(70, 890, 4):
    d.line([270, y, 1090, y], fill=(14, 20, 28), width=1)
d.text((280, 80), "CIRCULATORY SCAN", font=H2, fill=RED)
d.text((280, 106), "click a glowing structure to run a test · click a vessel to travel", font=MONO_S, fill=DIM)

# ---------- right: live vitals monitor ----------
panel(1110, 80, 470, 250, "LIVE VITALS", RED)
d.rectangle([1126, 118, 1564, 190], fill=(6, 14, 10))
pts = []
for x in range(1126, 1564, 2):
    ph = ((x - 1126) % 62) / 62
    yv = 0
    if 0.30 < ph < 0.34: yv = -8
    elif 0.36 < ph < 0.40: yv = 28
    elif 0.40 < ph < 0.44: yv = -34
    elif 0.44 < ph < 0.48: yv = 10
    elif 0.62 < ph < 0.72: yv = -6 * math.sin((ph - 0.62) / 0.1 * math.pi)
    pts.append((x, 154 - yv))
d.line(pts, fill=GREEN, width=2)
vit = [("HR", "128", "bpm", RED, "▲"), ("BP", "92/60", "", AMBER, "▼"), ("SpO₂", "89%", "", RED, "▼"), ("TEMP", "37.9", "°C", AMBER, ""), ("RR", "26", "/min", RED, "▲")]
for i, (k, v, u, c, arrow) in enumerate(vit):
    x = 1126 + (i % 3) * 150; y = 200 + (i // 3) * 64
    d.text((x, y), k, font=MONO_S, fill=DIM)
    d.text((x, y + 16), v, font=font("bahnschrift.ttf", 32), fill=c)
    d.text((x + 10 + d.textlength(v, font=font("bahnschrift.ttf", 32)), y + 28), (u + " " + arrow).strip(), font=MONO_S, fill=c)
d.rounded_rectangle([1426, 266, 1566, 316], 8, fill=(50, 10, 10), outline=RED)
d.text((1438, 280), "DETERIORATING", font=MONO_S, fill=RED)

# evidence board
panel(1110, 345, 470, 210, "EVIDENCE BOARD (DIFFERENTIAL)")
ev = [(GREEN, "Respiratory scan: low O₂, clear lungs"), (GREEN, "Circulatory scan: L calf swollen + warm"), (AMBER, "Blood test: D-dimer HIGH"), (DIM, "Nervous scan: not checked"), (DIM, "Skeletal scan: not checked")]
for i, (c, t) in enumerate(ev):
    y = 382 + i * 32
    d.ellipse([1128, y + 4, 1140, y + 16], fill=c)
    d.text((1150, y), t, font=MONO, fill=WHITE if c != DIM else DIM)

# treatment choices
panel(1110, 570, 470, 200, "TREAT  (wrong choice = cascade elsewhere)", AMBER)
opts = [("A", "Anticoagulant (blood thinner)"), ("B", "Antibiotics"), ("C", "Steroids"), ("D", "Oxygen + IV fluids")]
for i, (k, t) in enumerate(opts):
    x = 1126 + (i % 2) * 226; y = 606 + (i // 2) * 76
    d.rounded_rectangle([x, y, x + 214, y + 64], 8, fill=(24, 32, 44), outline=LINE)
    d.text((x + 12, y + 8), k, font=H2, fill=AMBER)
    d.multiline_text((x + 40, y + 10), t.replace(" (", "\n("), font=MONO_S, fill=WHITE, spacing=4)

# cascade preview chip
d.rounded_rectangle([1110, 784, 1580, 880], 10, fill=(30, 12, 12), outline=RED, width=2)
d.text((1126, 794), "LAST CASCADE", font=H3, fill=RED)
d.text((1126, 820), "Steroids given for 'infection' -> immune system weakened", font=MONO_S, fill=WHITE)
d.text((1126, 842), "-> NEW: kidneys reporting low output (2 min ago)", font=MONO_S, fill=AMBER)

# ---------- bottom: The Attending (personality, reacts live) ----------
d.rounded_rectangle([270, 790, 1090, 880], 10, fill=(20, 14, 10), outline=AMBER, width=2)
d.ellipse([286, 804, 346, 864], fill=(60, 45, 30), outline=AMBER, width=2)
d.text((299, 820), "Dr", font=H2, fill=AMBER)
d.text((362, 800), "THE ATTENDING  (live)", font=H3, fill=AMBER)
d.text((362, 826), "\"Heart rate 128 and you're sightseeing in the kidneys? He sat on a plane", font=MONO, fill=WHITE)
d.text((362, 848), " for six hours this morning. Look at the leg, genius.\"", font=MONO, fill=WHITE)

out = Path(__file__).with_name("mockup_v1.png")
img.save(out)
print("saved", out)
