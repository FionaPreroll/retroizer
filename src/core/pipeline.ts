/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { pixelize } from "./pixelize.ts";
import { applyPalette, generatePalette } from "./quantize.ts";
import type { Operation, OperationParams, OperationResult, Progress } from "./types.ts";

export const OPERATIONS: readonly Operation[] = ["palettize", "pixelize", "retroize"];

export function isOperation(value: unknown): value is Operation {
    return OPERATIONS.includes(value as Operation);
}

/**
 * Run one image operation on RGBA data, in place.
 *
 * "retroize" is palettize followed by pixelize, exactly like pressing both
 * buttons in a row.
 */
export function runOperation(
    operation: Operation,
    data: Uint8ClampedArray,
    width: number,
    height: number,
    params: OperationParams,
    onProgress: (progress: Progress) => void = () => undefined,
): OperationResult {
    if (!isOperation(operation)) {
        throw new Error(`Unknown operation: ${String(operation)}`);
    }

    const withPalettize = operation !== "pixelize";
    const withPixelize = operation !== "palettize";
    const paletteEnd = withPixelize ? 90 : 100;
    let palette = null;

    if (withPalettize) {
        onProgress({ value: 0, phase: "Palettizing" });
        palette = generatePalette(data, params.colors, {
            onIteration(iteration, maxIterations, preview) {
                const value = 10 + (iteration / maxIterations) * (paletteEnd - 20);
                onProgress({ value, phase: "Palettizing", palette: preview });
            },
        });

        onProgress({ value: paletteEnd - 10, phase: "Applying palette", palette });
        applyPalette(data, palette);
    }

    if (withPixelize) {
        onProgress({ value: paletteEnd, phase: "Pixelizing" });
        pixelize(data, width, height, params.pixelSize);
    }

    onProgress({ value: 100, phase: "Done" });
    return { palette };
}
