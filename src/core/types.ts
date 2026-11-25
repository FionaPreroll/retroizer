/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** An sRGB colour with integer channels 0–255. */
export type RGB = readonly [r: number, g: number, b: number];

/** A list of distinct colours. */
export type Palette = readonly RGB[];

export type Operation = "palettize" | "pixelize" | "retroize";

export interface OperationParams {
    /** Number of palette colours (2–256). */
    readonly colors: number;
    /** Edge length of a pixel block (1–20). */
    readonly pixelSize: number;
}

export interface Progress {
    /** 0–100 */
    readonly value: number;
    readonly phase: string;
    /** Palette so far (k-means preview, or the final palette). */
    readonly palette?: Palette;
}

export interface OperationResult {
    /** The computed palette, or null when the operation does not palettize. */
    readonly palette: Palette | null;
}
