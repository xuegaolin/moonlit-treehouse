"""生成微信小程序 tabBar 图标：81x81 PNG，普通态 + 选中态"""
from PIL import Image, ImageDraw
import os

OUT = os.path.dirname(os.path.abspath(__file__))
SIZE = 81
PURPLE = "#6B5CE7"    # 月光紫（选中态）
GRAY = "#9C97B8"      # 普通态
BG = (0, 0, 0, 0)     # 透明背景


def draw_home(color_hex, filename):
    """画"树屋"图标：屋顶三角 + 房子主体 + 月亮"""
    img = Image.new("RGBA", (SIZE, SIZE), BG)
    d = ImageDraw.Draw(img)
    c = color_hex

    # 月亮（右上角小圆）
    d.ellipse([56, 6, 72, 22], fill=c)

    # 屋顶（三角形）
    d.polygon([(40, 14), (12, 42), (68, 42)], fill=c)

    # 房子主体（矩形）
    d.rectangle([18, 42, 62, 72], fill=c)

    # 门（小矩形，镂空）
    d.rectangle([34, 52, 46, 72], fill=BG)

    # 窗户（小方块，镂空）
    d.rectangle([22, 46, 32, 56], fill=BG)
    d.rectangle([48, 46, 58, 56], fill=BG)

    path = os.path.join(OUT, filename)
    img.save(path, "PNG")
    print(f"OK {filename}")


def draw_user(color_hex, filename):
    """画"我的"图标：人头圆形 + 肩膀半圆"""
    img = Image.new("RGBA", (SIZE, SIZE), BG)
    d = ImageDraw.Draw(img)
    c = color_hex

    # 头（圆形）
    d.ellipse([28, 10, 52, 34], fill=c)

    # 肩膀（大半圆）
    d.pieslice([18, 38, 62, 78], 180, 360, fill=c)

    path = os.path.join(OUT, filename)
    img.save(path, "PNG")
    print(f"OK {filename}")


if __name__ == "__main__":
    # 普通态
    draw_home(GRAY, "icon-home.png")
    draw_user(GRAY, "icon-user.png")
    # 选中态
    draw_home(PURPLE, "icon-home-active.png")
    draw_user(PURPLE, "icon-user-active.png")
    print("Done")
