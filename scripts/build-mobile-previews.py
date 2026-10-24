"""Make README media from native simulator/emulator captures (requires Pillow)."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('ios', type=Path)
parser.add_argument('android', type=Path)
parser.add_argument('--output', type=Path, default=Path('docs/previews'))
parser.add_argument('--android-insets', nargs=2, type=int, default=(0, 0), metavar=('TOP', 'BOTTOM'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

def frames(folder):
    files = sorted(folder.glob('0[1-5]-*.png'))
    if len(files) != 5:
        raise SystemExit(f'Expected five native app captures in {folder}, found {len(files)}')
    return [Image.open(file).convert('RGB') for file in files]

def fit(image, width):
    return image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)

groups = {'ios': frames(args.ios), 'android': frames(args.android)}
top, bottom = args.android_insets
if top or bottom:
    groups['android'] = [image.crop((0, top, image.width, image.height-bottom)) for image in groups['android']]
for platform, captures in groups.items():
    fit(captures[0], 600).save(args.output / f'{platform}-phone.png', optimize=True)
    scaled = [fit(image, 420) for image in captures]
    height = max(image.height for image in scaled)
    sequence = []
    for image in scaled:
        frame = Image.new('RGB', (420, height), '#1a202a')
        frame.paste(image, (0, 0))
        sequence.append(frame.quantize(colors=256))
    sequence[0].save(args.output / f'{platform}-phone.gif', save_all=True,
                     append_images=sequence[1:], duration=[2200, 1500, 1800, 2400, 1800], loop=0, disposal=2)

ios, android = (fit(groups[name][0], 400) for name in ['ios', 'android'])
comparison = Image.new('RGB', (840, max(ios.height, android.height) + 74), '#202336')
draw = ImageDraw.Draw(comparison)
try:
    font = ImageFont.truetype('DejaVuSans.ttf', 21)
except OSError:
    font = ImageFont.load_default()
draw.text((20, 20), 'iOS simulator', fill='#eef0df', font=font)
draw.text((440, 20), 'Android emulator', fill='#eef0df', font=font)
comparison.paste(ios, (20, 60)); comparison.paste(android, (440, 60))
comparison.save(args.output / 'native-phone-layouts.png', optimize=True)
print('Saved native phone screenshots and navigation GIFs to', args.output)
