/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { rgbToHex } from "../core/color.ts";
import type { Palette } from "../core/types.ts";
import { byId } from "./dom.ts";

/** The palette panel: one swatch per colour; clicking a swatch reports its index. */
export class PaletteView {
    private readonly swatches = byId("colorPalette", HTMLUListElement);
    private readonly info = byId("paletteInfo", HTMLSpanElement);
    private palette: Palette = [];
    private pendingInfo: string | undefined;
    private pendingFrame: number | null = null;

    constructor(onSwatch: (hex: string) => void) {
        this.swatches.addEventListener("click", (event) => {
            if (!(event.target instanceof Element)) return;
            const swatch = event.target.closest<HTMLElement>("[data-index]");
            const color = this.palette[Number(swatch?.dataset["index"])];
            if (color) onSwatch(rgbToHex(color));
        });
    }

    get current(): Palette {
        return this.palette;
    }

    /**
     * Render a palette. Calls within one frame are coalesced, so a stream of
     * k-means previews costs at most one DOM update per frame.
     */
    show(palette: Palette, info?: string): void {
        this.palette = palette;
        if (info !== undefined) this.pendingInfo = info;
        if (this.pendingFrame !== null) return;
        this.pendingFrame = requestAnimationFrame(() => {
            this.pendingFrame = null;
            this.render();
        });
    }

    private render(): void {
        const items = this.palette.map((color, index) => {
            const hex = rgbToHex(color);
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "swatch";
            button.dataset["index"] = String(index);
            button.setAttribute("aria-label", `Copy ${hex}`);

            const chip = document.createElement("span");
            chip.className = "swatch__chip";
            chip.setAttribute("aria-hidden", "true");
            chip.style.backgroundColor = hex;

            const label = document.createElement("span");
            label.className = "swatch__hex";
            label.textContent = hex;

            button.append(chip, label);
            item.append(button);
            return item;
        });
        this.swatches.replaceChildren(...items);
        if (this.pendingInfo !== undefined) {
            this.info.textContent = this.pendingInfo;
            this.pendingInfo = undefined;
        }
    }
}
