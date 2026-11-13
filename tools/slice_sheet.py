"""把 ChatGPT 產生的 4×4 角色大圖切成 16 張貼圖，自動去背，放進 chars/<主題>/。

用法：
  python tools/slice_sheet.py 大圖.png 主題代號
  主題代號：dawn（晨光）、lotus（蓮池）、elephant（調象）、moon（月夜）、forest（山林）、ocean（海洋）
  前兩列（8 格）是引導者，後兩列（8 格）是學員。
  python tools/slice_sheet.py 大圖.png dawn --layout wise    第三個角色的 4×2 大圖（8 格）
  python tools/slice_sheet.py 大圖.png moon --layout trio    三個角色畫在同一張 4×4

大圖的格子順序（由左到右、由上到下）照 LAYOUT。背景是透明的就直接用；
是純色（白色或淡色）的，會從每格的邊緣往內把背景去掉（角色要有深色粗外框，才不會被吃掉）。
做完會更新 chars/files.js，並在 tools/out/ 放一張預覽圖方便檢查。
"""
import argparse, json, os, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUT = ["guide-happy", "guide-cheer", "guide-calm", "guide-gentle",
          "guide-think", "guide-love", "guide-wow", "guide-fight",
          "learner-happy", "learner-sleepy", "learner-distracted", "learner-confused",
          "learner-think", "learner-sit", "learner-cheer", "learner-sad"]
# 第三個角色（首頁「慧」那格）：晨光、蓮池、調象另外補一張 4×2（8 格）
WISE = ["wise-happy", "wise-think", "wise-wow", "wise-gentle",
        "wise-cheer", "wise-calm", "wise-love", "wise-fight"]
# 月夜、山林、海洋：一張 4×4 畫齊三個角色（引導者 5、學員 6、第三個角色 5）
TRIO = ["guide-happy", "guide-cheer", "guide-calm", "guide-gentle",
        "guide-think", "learner-happy", "learner-sleepy", "learner-distracted",
        "learner-confused", "learner-sit", "learner-sad", "wise-happy",
        "wise-think", "wise-wow", "wise-gentle", "wise-cheer"]
# 三個角色一張，但第一個角色只畫了 4 格、第二個畫了 7 格（例如山林）
TRIO47 = ["guide-happy", "guide-cheer", "guide-calm", "guide-gentle",
          "learner-think", "learner-happy", "learner-sleepy", "learner-distracted",
          "learner-confused", "learner-sit", "learner-sad", "wise-happy",
          "wise-think", "wise-wow", "wise-gentle", "wise-cheer"]
LAYOUTS = {"pair": LAYOUT, "wise": WISE, "trio": TRIO, "trio47": TRIO47}
THEMES = ["dawn", "lotus", "elephant", "moon", "forest", "ocean"]
KEY = (255, 0, 255, 255)


def has_alpha(img):
    a = img.getchannel("A")
    w, h = img.size
    corners = [a.getpixel((x, y)) for x in (0, w - 1) for y in (0, h - 1)]
    return min(corners) < 200


def remove_bg(cell, tol):
    """從格子四邊往內 flood fill，跟邊緣相連、顏色相近的都當背景。"""
    rgb = cell.convert("RGB")
    w, h = rgb.size
    step = max(4, min(w, h) // 40)
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
            [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for s in seeds:
        if rgb.getpixel(s) != KEY[:3]:
            ImageDraw.floodfill(rgb, s, KEY[:3], thresh=tol)
    mask = Image.new("L", (w, h), 255)
    px, mp = rgb.load(), mask.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == KEY[:3]:
                mp[x, y] = 0
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = cell.convert("RGBA")
    out.putalpha(mask)
    return out


def drop_specks(img, min_frac=0.004):
    """去掉跟主體不相連的小碎塊（例如隔壁格子露出來的一角）。"""
    a = img.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    w, h = a.size
    seen = Image.new("1", (w, h), 0)
    ap, sp = a.load(), seen.load()
    comps = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if ap[x, y] and not sp[x, y]:
                stack, pts = [(x, y)], []
                sp[x, y] = 1
                while stack:
                    cx, cy = stack.pop(); pts.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and ap[nx, ny] and not sp[nx, ny]:
                            sp[nx, ny] = 1; stack.append((nx, ny))
                comps.append(pts)
    if not comps:
        return img
    big = max(len(c) for c in comps)
    alpha = img.getchannel("A")
    al = alpha.load()
    for c in comps:
        if len(c) < big * 0.08 and len(c) < w * h * min_frac * 10:
            for x, y in c:
                al[x, y] = 0
    img.putalpha(alpha)
    return img


def fit_square(img, size=320, margin=0.04):
    bbox = img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = int(max(w, h) * (1 + margin * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("theme", choices=THEMES)
    ap.add_argument("--layout", choices=list(LAYOUTS), default="pair",
                    help="pair＝引導者＋學員各 8 格（4×4）；wise＝第三個角色 8 格（4×2）；trio＝三個角色一張（4×4）")
    ap.add_argument("--rows", type=int, default=0, help="列數；不填就依版型（pair、trio 是 4，wise 是 2）")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--tol", type=int, default=38, help="去背的顏色容許度，背景沒去乾淨就調大，角色被吃掉就調小")
    ap.add_argument("--inset", type=float, default=0.0, help="每格往內縮的比例（大圖格子之間有框線時用，例如 0.02）")
    a = ap.parse_args()
    lay = LAYOUTS[a.layout]
    a.rows = a.rows or (2 if a.layout == "wise" else 4)

    src = Image.open(a.image).convert("RGBA")
    W, H = src.size
    keep_alpha = has_alpha(src)
    print("大圖 %dx%d，%s" % (W, H, "透明背景，直接切" if keep_alpha else "純色背景，自動去背"))
    out_dir = os.path.join(ROOT, "chars", a.theme)
    os.makedirs(out_dir, exist_ok=True)
    cw, ch = W / a.cols, H / a.rows
    tiles = []
    for i, name in enumerate(lay[: a.rows * a.cols]):
        r, c = divmod(i, a.cols)
        ix, iy = cw * a.inset, ch * a.inset
        box = (int(c * cw + ix), int(r * ch + iy), int((c + 1) * cw - ix), int((r + 1) * ch - iy))
        cell = src.crop(box)
        cell = cell if keep_alpha else remove_bg(cell, a.tol)
        cell = fit_square(drop_specks(cell))
        cell.save(os.path.join(out_dir, name + ".png"), optimize=True)
        tiles.append(cell)
        print("  %-20s ok" % name)

    # 更新 chars/files.js
    files = {}
    for th in THEMES:
        d = os.path.join(ROOT, "chars", th)
        if os.path.isdir(d):
            names = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".png"))
            if names:
                files[th] = names
    js = "/* 由 tools/slice_sheet.py 自動產生：每個主題已有的角色圖 */\nwindow.CHAR_FILES=" + json.dumps(files, ensure_ascii=False) + ";\n"
    open(os.path.join(ROOT, "chars", "files.js"), "w", encoding="utf-8").write(js)

    # 預覽圖（棋盤底，看得出哪裡沒去乾淨）
    os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True)
    T = 160
    pv = Image.new("RGBA", (T * a.cols, T * a.rows), (255, 255, 255, 255))
    d = ImageDraw.Draw(pv)
    for y in range(0, pv.size[1], 16):
        for x in range(0, pv.size[0], 16):
            if (x // 16 + y // 16) % 2:
                d.rectangle([x, y, x + 15, y + 15], fill=(225, 220, 240, 255))
    for i, t in enumerate(tiles):
        r, c = divmod(i, a.cols)
        pv.paste(t.resize((T, T), Image.LANCZOS), (c * T, r * T), t.resize((T, T), Image.LANCZOS))
    pv_path = os.path.join(ROOT, "tools", "out", a.theme + "_preview.png")
    pv.save(pv_path)
    print("完成：chars/%s/（%d 張），預覽：%s" % (a.theme, len(tiles), pv_path))


if __name__ == "__main__":
    main()
