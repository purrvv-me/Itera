import struct
from pathlib import Path


def blend(dst: tuple[int, int, int, int], src: tuple[int, int, int, int], alpha: float) -> tuple[int, int, int, int]:
    alpha = max(0.0, min(1.0, alpha)) * (src[3] / 255)
    inv = 1.0 - alpha
    return (
        round(dst[0] * inv + src[0] * alpha),
        round(dst[1] * inv + src[1] * alpha),
        round(dst[2] * inv + src[2] * alpha),
        255,
    )


def capsule_alpha(px: float, py: float, x1: float, y1: float, x2: float, y2: float, radius: float) -> float:
    vx = x2 - x1
    vy = y2 - y1
    wx = px - x1
    wy = py - y1
    length_sq = vx * vx + vy * vy
    if length_sq == 0:
        distance = ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    else:
        t = max(0.0, min(1.0, (wx * vx + wy * vy) / length_sq))
        cx = x1 + t * vx
        cy = y1 + t * vy
        distance = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
    return max(0.0, min(1.0, radius + 0.9 - distance))


def flame_alpha(px: float, py: float, cx: float, top: float, bottom: float, width: float) -> float:
    if py < top or py > bottom:
        return 0.0
    t = (py - top) / (bottom - top)
    curve_width = width * (1.0 - abs(t - 0.58) * 1.65)
    curve_width = max(width * 0.05, curve_width)
    curve_center = cx + width * 0.15 * (t - 0.45)
    distance = abs(px - curve_center)
    return max(0.0, min(1.0, curve_width + 0.8 - distance))


def rgba_icon(size: int) -> bytes:
    pixels = []
    bg = (3, 8, 20, 255)
    edge = (1, 3, 10, 255)
    orange = (255, 138, 66, 255)
    flame = (255, 177, 63, 255)
    flame_inner = (255, 237, 163, 255)
    wood = (222, 149, 72, 255)
    wood_light = (255, 218, 158, 255)
    head = (32, 18, 11, 255)
    center = size / 2
    max_radius = (2 * (center ** 2)) ** 0.5

    for y in range(size):
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            distance = ((px - center) ** 2 + (py - center) ** 2) ** 0.5
            edge_alpha = max(0.0, min(1.0, (distance - size * 0.18) / max_radius))
            color = blend(bg, edge, edge_alpha)

            wood_alpha = capsule_alpha(
                px,
                py,
                size * 0.50,
                size * 0.43,
                size * 0.50,
                size * 0.84,
                max(1.7, size * 0.065),
            )
            color = blend(color, wood, wood_alpha)

            highlight_alpha = capsule_alpha(
                px,
                py,
                size * 0.475,
                size * 0.44,
                size * 0.475,
                size * 0.80,
                max(0.8, size * 0.018),
            )
            color = blend(color, wood_light, highlight_alpha * 0.75)

            head_alpha = capsule_alpha(
                px,
                py,
                size * 0.465,
                size * 0.405,
                size * 0.535,
                size * 0.455,
                max(2.2, size * 0.075),
            )
            color = blend(color, head, head_alpha)

            outer_alpha = flame_alpha(px, py, size * 0.50, size * 0.08, size * 0.51, size * 0.18)
            color = blend(color, orange, outer_alpha)

            mid_alpha = flame_alpha(px, py, size * 0.505, size * 0.19, size * 0.47, size * 0.11)
            color = blend(color, flame, mid_alpha)

            inner_alpha = flame_alpha(px, py, size * 0.50, size * 0.28, size * 0.44, size * 0.055)
            color = blend(color, flame_inner, inner_alpha)

            pixels.append(color)

    height = size * 2
    header = struct.pack(
        "<IIIHHIIIIII",
        40,
        size,
        height,
        1,
        32,
        0,
        size * size * 4,
        0,
        0,
        0,
        0,
    )

    xor = bytearray()
    for y in range(size - 1, -1, -1):
        for x in range(size):
            r, g, b, a = pixels[y * size + x]
            xor.extend((b, g, r, a))

    mask_stride = ((size + 31) // 32) * 4
    and_mask = bytes(mask_stride * size)
    return header + bytes(xor) + and_mask


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "assets" / "itera.ico"
    out.parent.mkdir(parents=True, exist_ok=True)

    sizes = [16, 32, 48, 256]
    images = [rgba_icon(size) for size in sizes]
    header_size = 6 + 16 * len(images)
    offset = header_size

    directory = bytearray(struct.pack("<HHH", 0, 1, len(images)))
    for size, image in zip(sizes, images):
        directory.extend(
            struct.pack(
                "<BBBBHHII",
                0 if size == 256 else size,
                0 if size == 256 else size,
                0,
                0,
                1,
                32,
                len(image),
                offset,
            )
        )
        offset += len(image)

    out.write_bytes(bytes(directory) + b"".join(images))
    print(out)


if __name__ == "__main__":
    main()
