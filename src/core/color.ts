/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { RGB } from "./types.ts";

/** Format a colour as "#RRGGBB". Fractional channels are rounded and clamped. */
export function rgbToHex(color: RGB): string {
    const hex = color.map((channel) =>
        Math.min(255, Math.max(0, Math.round(channel)))
            .toString(16)
            .padStart(2, "0"),
    );
    return `#${hex.join("")}`.toUpperCase();
}
