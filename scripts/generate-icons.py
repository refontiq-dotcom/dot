"""Génère les icônes de l'application « Dot » (texte seul, serif bleu nuit et blanc).

Usage : python3 scripts/generate-icons.py   (nécessite Pillow et la police Liberation Serif Bold)
"""
from PIL import Image, ImageDraw, ImageFont

BLUE = (11, 47, 115, 255)      # --deep
WHITE = (255, 255, 255, 255)
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'
TEXT = 'Dot'
BIG = 1024  # dessin haute définition puis réduction pour des bords nets


def draw_icon(width_ratio: float, radius_ratio: float | None) -> Image.Image:
    """width_ratio : part de la largeur occupée par le mot ; radius_ratio : coins arrondis (None = carré plein)."""
    img = Image.new('RGBA', (BIG, BIG), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if radius_ratio is None:
        d.rectangle((0, 0, BIG, BIG), fill=BLUE)
    else:
        d.rounded_rectangle((0, 0, BIG - 1, BIG - 1), radius=int(BIG * radius_ratio), fill=BLUE)
    size = 100
    while True:  # ajuste la taille de police pour que le mot occupe la largeur voulue
        font = ImageFont.truetype(FONT, size)
        left, top, right, bottom = d.textbbox((0, 0), TEXT, font=font)
        if right - left >= BIG * width_ratio:
            break
        size += 4
    left, top, right, bottom = d.textbbox((0, 0), TEXT, font=font)
    x = (BIG - (right - left)) / 2 - left
    y = (BIG - (bottom - top)) / 2 - top
    d.text((x, y), TEXT, font=font, fill=WHITE)
    return img


def save(img: Image.Image, path: str, size: int) -> None:
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)
    print('écrit', path, size)


rounded = draw_icon(0.70, 0.22)      # icône « any » : coins arrondis
maskable = draw_icon(0.50, None)     # « maskable » : plein cadre, mot dans la zone sûre (80 %)
apple = draw_icon(0.66, None)        # iOS arrondit lui-même : carré plein
favicon = draw_icon(0.86, 0.18)      # favicon : mot plus grand pour rester lisible en 16 px

save(rounded, 'public/icons/icon-192.png', 192)
save(rounded, 'public/icons/icon-512.png', 512)
save(maskable, 'public/icons/icon-maskable-512.png', 512)
save(apple, 'src/app/apple-icon.png', 180)
save(favicon, 'src/app/icon.png', 512)
favicon.resize((48, 48), Image.LANCZOS).save('src/app/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('écrit src/app/favicon.ico')
