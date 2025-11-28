import os
import random
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = os.path.join(os.path.dirname(__file__), 'fonts', 'Geologica-Bold.ttf')
FONT_SIZE = 120

GRADIENTS = [
    ["#ff6b6b", "#ff8e8e", "#ffafbd"],
    ["#667eea", "#764ba2", "#5ee7df"],
    ["#fa709a", "#fee140", "#ff6b6b"],
    ["#43e97b", "#38f9d7", "#4facfe"],
    ["#cd9cf2", "#f6f3ff", "#a18cd1"],
    ["#ff9a9e", "#fad0c4", "#f5576c"],
    ["#4facfe", "#00f2fe", "#43e97b"],
    ["#ffecd2", "#fcb69f", "#ff9a9e"],
    ["#00dbde", "#fc00ff", "#00c6ff"],
    ["#ff9a8b", "#ff6a88", "#ff99ac"],
    ["#6a11cb", "#2575fc", "#4facfe"],
    ["#d4fc79", "#96e6a1", "#00cdac"],
    ["#a3bded", "#6991c7", "#a3bded"],
    ["#ffecd2", "#fcb69f", "#ff9a9e"],
    ["#0ba360", "#3cba92", "#30dd8a"],
    ["#ff9a9e", "#fecfef", "#fecfef"],
    ["#0093e9", "#80d0c7", "#0093e9"],
    ["#a8edea", "#fed6e3", "#a8edea"],
    ["#ffd89b", "#19547b", "#ffd89b"],
    ["#ff6b6b", "#ffd93d", "#6bcf7f"],
]

def generate_avatar(fio: str, size=256) -> BytesIO:
    initials = ''.join([x[0] for x in fio.split() if x]) or 'A'
    gradient = random.choice(GRADIENTS)

    img = Image.new('RGB', (size, size), color=gradient[0])
    draw = ImageDraw.Draw(img)

    for y in range(size):
        ratio = y / size
        r = int(int(gradient[0][1:3],16)*(1-ratio) + int(gradient[-1][1:3],16)*ratio)
        g = int(int(gradient[0][3:5],16)*(1-ratio) + int(gradient[-1][3:5],16)*ratio)
        b = int(int(gradient[0][5:7],16)*(1-ratio) + int(gradient[-1][5:7],16)*ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)

    draw.text(
        (size/2, size/2),
        initials,
        font=font,
        fill='white',
        anchor='mm'
    )

    output = BytesIO()
    img.save(output, format='PNG')
    output.seek(0)
    return output