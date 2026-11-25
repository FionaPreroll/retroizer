/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Draw a deterministic, photo-like test image (smooth gradients, soft colour
 * blobs and sensor-like noise) so benchmark runs are comparable.
 *
 * Kept self-contained: the scripts inject its source into the page.
 */
export function drawSyntheticImage(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
): void {
    let seed = 12345;
    const random = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#3a6ea5");
    background.addColorStop(0.5, "#e8c07d");
    background.addColorStop(1, "#2d4a22");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 60; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = (0.05 + random() * 0.25) * Math.min(width, height);
        const rgb = [random(), random(), random()].map((v) => Math.floor(v * 255)).join(",");
        const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
        blob.addColorStop(0, `rgba(${rgb},0.9)`);
        blob.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = blob;
        ctx.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
    }

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (random() - 0.5) * 24;
        data[i] = (data[i] ?? 0) + noise;
        data[i + 1] = (data[i + 1] ?? 0) + noise;
        data[i + 2] = (data[i + 2] ?? 0) + noise;
    }
    ctx.putImageData(image, 0, 0);
}
