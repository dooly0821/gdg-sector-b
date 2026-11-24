"""Rebuild the printed papers shared by the creature models."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "dist/assets"
SIZE = 512
rng = np.random.default_rng(4327)
font = ImageFont.load_default(size=28)
small = ImageFont.load_default(size=18)

def paper():
    y, x = np.indices((SIZE, SIZE))
    grey = 6 * rng.normal(size=x.shape) + 4*np.sin(x*.082+y*.17)*np.cos(y*.061)
    return Image.fromarray(np.uint8(np.clip(
        np.array([219, 195, 160])[None, None, :] + grey[:, :, None], 0, 255
    )))

for name in ("receipt", "barcode", "fragile"):
    image = paper()
    draw = ImageDraw.Draw(image)
    draw.rectangle((24, 26, 488, 486), outline="#ad7959", width=4)
    draw.text((51, 44), "GDG / NIGHT SHIFT", fill="#4b352f", font=font)
    draw.line((49, 91, 462, 91), fill="#815e4a", width=3)
    if name == "fragile":
        draw.polygon([(131, 137), (366, 137), (352, 212), (301, 270), (272, 274),
                      (272, 356), (337, 356), (337, 382), (165, 382),
                      (165, 356), (228, 356), (228, 273), (183, 250), (147, 209)],
                     fill="#934136")
        draw.polygon([(259, 129), (226, 206), (252, 203), (238, 252),
                      (301, 172), (267, 178), (283, 129)], fill="#d8ba8f")
        draw.text((179, 417), "FRAGILE", fill="#7e382e", font=font)
    else:
        barcode_y = 175 if name == "barcode" else 350
        x = 53
        while x < 450:
            width = int(rng.choice([3, 5, 7, 11]))
            draw.rectangle((x, barcode_y, x+width, barcode_y+77), fill="#42302c")
            x += width + int(rng.choice([2, 4, 5, 7]))
        draw.text((56, barcode_y+87), "GDG–C01 / 0472   0118", fill="#483632", font=small)
        if name == "receipt":
            for i, line in enumerate(("C-01  CONTAINMENT", "DO NOT RESCAN",
                                      "RECEIVED AFTER MIDNIGHT", "CONTENTS UNVERIFIED",
                                      "SHIFT: GRAVEYARD", "OPERATOR: —")):
                draw.text((53, 118+i*33), line, fill="#583e34", font=small)
        else:
            draw.text((53, 361), "BAY 02  •  1 / 1", font=font, fill="#754a35")
    image.save(OUT / f"gdg-{name}.webp", quality=90)
