/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Pixelize RGBA data in place: every `blockSize`×`blockSize` block takes the
 * colour of its top-left pixel.
 *
 * Works on 32-bit words so each block row is a single `fill()` call.
 */
export function pixelize(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    blockSize: number,
): void {
    if (data.length !== width * height * 4) {
        throw new RangeError(`Expected ${width * height * 4} bytes, got ${data.length}`);
    }
    const size = Math.max(1, Math.floor(blockSize));
    if (size === 1 || width === 0 || height === 0) return;

    const pixels = new Uint32Array(data.buffer, data.byteOffset, width * height);

    for (let blockY = 0; blockY < height; blockY += size) {
        const blockBottom = Math.min(blockY + size, height);
        const sampleRow = blockY * width;

        for (let blockX = 0; blockX < width; blockX += size) {
            const color = pixels[sampleRow + blockX]!;
            const blockRight = Math.min(blockX + size, width);
            for (let y = blockY; y < blockBottom; y++) {
                const row = y * width;
                pixels.fill(color, row + blockX, row + blockRight);
            }
        }
    }
}
