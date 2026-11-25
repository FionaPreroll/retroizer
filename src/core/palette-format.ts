/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { rgbToHex } from "./color.ts";
import type { Palette } from "./types.ts";

/** "#RRGGBB, #RRGGBB, …" */
export function toHexList(palette: Palette): string {
    return palette.map(rgbToHex).join(", ");
}

/** GIMP palette (.gpl), also read by Aseprite, Inkscape and Krita. */
export function toGimpPalette(palette: Palette, name = "Retroizer"): string {
    const safeName = name.replace(/[\r\n]+/g, " ").trim() || "Retroizer";
    const rows = palette.map((color) => {
        const [r, g, b] = color.map((c) => Math.min(255, Math.max(0, Math.round(c))));
        const channels = [r, g, b].map((c) => String(c).padStart(3, " ")).join(" ");
        return `${channels}\t${rgbToHex(color)}`;
    });
    return ["GIMP Palette", `Name: ${safeName}`, "Columns: 8", "#", ...rows, ""].join("\n");
}
