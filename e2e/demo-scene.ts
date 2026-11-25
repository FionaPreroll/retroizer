/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Draw a deterministic, photo-like landscape (dusk sky, sun, mountain
 * ranges, lake with reflection, pine silhouettes, film grain) for the
 * showcase screenshots. Generated, so no image file is needed.
 *
 * Kept self-contained: the scripts inject its source into the page.
 */
export function drawDemoScene(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    let seed = 20261125;
    const random = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const horizon = Math.round(height * 0.64);

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#1d1b4f");
    sky.addColorStop(0.45, "#6b3d7d");
    sky.addColorStop(0.75, "#e0765f");
    sky.addColorStop(1, "#f6c27a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);

    for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,255,240,${0.3 + random() * 0.6})`;
        ctx.fillRect(random() * width, random() * horizon * 0.4, 1.5, 1.5);
    }

    const sunX = width * 0.62;
    const sunY = horizon - height * 0.07;
    const sunR = height * 0.11;
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 3.5);
    glow.addColorStop(0, "rgba(255,214,140,0.65)");
    glow.addColorStop(1, "rgba(255,214,140,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, horizon);
    ctx.fillStyle = "#ffe6a8";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    const ridge = (
        base: number,
        amplitude: number,
        frequency: number,
        phase: number,
        color: string,
    ) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        for (let x = 0; x <= width; x += 4) {
            const t = x / width;
            const y =
                base -
                amplitude *
                    (0.55 * Math.sin(t * frequency + phase) +
                        0.3 * Math.sin(t * frequency * 2.7 + phase * 1.7) +
                        0.15 * Math.sin(t * frequency * 6.1 + phase * 0.3));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, horizon);
        ctx.closePath();
        ctx.fill();
    };
    ridge(horizon - height * 0.16, height * 0.1, 5, 1.2, "#8a4f86");
    ridge(horizon - height * 0.09, height * 0.08, 7, 3.1, "#55305f");
    ridge(horizon - height * 0.03, height * 0.05, 11, 0.4, "#2f1d3e");

    const lake = ctx.createLinearGradient(0, horizon, 0, height);
    lake.addColorStop(0, "#d77a63");
    lake.addColorStop(0.35, "#5b3566");
    lake.addColorStop(1, "#17142f");
    ctx.fillStyle = lake;
    ctx.fillRect(0, horizon, width, height - horizon);

    for (let y = horizon + 3; y < height; y += 3 + (y - horizon) * 0.04) {
        const spread = sunR * (0.6 + (y - horizon) / height);
        ctx.fillStyle = `rgba(255,224,160,${0.55 - ((y - horizon) / (height - horizon)) * 0.5})`;
        ctx.fillRect(sunX - spread * (0.6 + random() * 0.6), y, spread * (1.2 + random()), 1.5);
    }

    ctx.fillStyle = "#120e22";
    for (let i = 0; i < 26; i++) {
        const x = (i < 13 ? random() * 0.3 : 0.78 + random() * 0.22) * width;
        const h = height * (0.12 + random() * 0.16);
        const w = h * 0.32;
        const baseY = horizon + height * 0.02 + random() * height * 0.03;
        ctx.beginPath();
        ctx.moveTo(x, baseY - h);
        ctx.lineTo(x - w / 2, baseY);
        ctx.lineTo(x + w / 2, baseY);
        ctx.closePath();
        ctx.fill();
    }

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
        const grain = (random() - 0.5) * 14;
        data[i] = (data[i] ?? 0) + grain;
        data[i + 1] = (data[i + 1] ?? 0) + grain;
        data[i + 2] = (data[i + 2] ?? 0) + grain;
    }
    ctx.putImageData(image, 0, 0);
}
