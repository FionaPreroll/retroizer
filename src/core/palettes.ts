/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Palette } from "./types.ts";

/** NES-style palette, shown before the first palettize run. */
export const NES_PALETTE: Palette = [
    [124, 124, 124], // Light Gray
    [0, 0, 252], // Blue
    [0, 0, 188], // Dark Blue
    [68, 40, 188], // Purple
    [148, 0, 132], // Magenta
    [168, 0, 32], // Red
    [168, 16, 0], // Dark Red
    [136, 20, 0], // Brown
    [80, 48, 0], // Dark Brown
    [0, 120, 0], // Green
    [0, 104, 0], // Dark Green
    [0, 88, 0], // Darker Green
    [0, 64, 88], // Teal
    [0, 0, 0], // Black
    [188, 188, 188], // Light Gray
    [60, 188, 252], // Light Blue
    [104, 136, 252], // Blue
    [152, 120, 248], // Lavender
    [248, 120, 248], // Pink
    [248, 88, 152], // Light Red
    [248, 120, 88], // Orange
    [252, 160, 68], // Light Orange
    [248, 184, 0], // Yellow
    [184, 248, 24], // Light Green
    [88, 216, 84], // Light Green
    [88, 248, 152], // Pale Green
    [0, 232, 216], // Aqua
    [120, 120, 120], // Gray
];
