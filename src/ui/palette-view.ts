/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { rgbToHex } from "../core/color.ts";
import type { Palette } from "../core/types.ts";
import { byId } from "./dom.ts";

/** The collapsible palette panel with one swatch per colour. */
export class PaletteView {
    private readonly container = byId("colorPaletteContainer", HTMLDivElement);
    private readonly swatches = byId("colorPalette", HTMLDivElement);
    private readonly toggleButton = byId("togglePaletteButton", HTMLButtonElement);
    private readonly title: HTMLSpanElement;
    private palette: Palette = [];
    private pendingTitle: string | undefined;
    private pendingFrame: number | null = null;

    constructor() {
        const title = byId("paletteTitle", HTMLDivElement).querySelector("span");
        if (!title) throw new Error("#paletteTitle needs a <span>");
        this.title = title;

        this.toggleButton.addEventListener("click", () => {
            this.setExpanded(!this.isExpanded());
        });
        this.swatches.addEventListener("click", (event) => {
            if (!(event.target instanceof HTMLElement)) return;
            const index = event.target.dataset["index"];
            if (index !== undefined) this.showColorInfo(Number(index));
        });
    }

    isExpanded(): boolean {
        return this.container.classList.contains("expanded");
    }

    setExpanded(expanded: boolean): void {
        this.container.classList.toggle("expanded", expanded);
        this.swatches.style.display = expanded ? "flex" : "none";
        this.toggleButton.textContent = expanded ? "Collapse" : "Expand";
    }

    /**
     * Render a palette. Calls within one frame are coalesced, so a stream of
     * k-means previews costs at most one DOM update per frame.
     */
    show(palette: Palette, title?: string): void {
        this.palette = palette;
        if (title !== undefined) this.pendingTitle = title;
        if (this.pendingFrame !== null) return;
        this.pendingFrame = requestAnimationFrame(() => {
            this.pendingFrame = null;
            this.render();
        });
    }

    private render(): void {
        const fragment = document.createDocumentFragment();
        this.palette.forEach((color, index) => {
            const swatch = document.createElement("div");
            swatch.className = "colorSwatch";
            swatch.dataset["index"] = String(index);
            swatch.title = rgbToHex(color);
            swatch.style.backgroundColor = `rgb(${color[0]},${color[1]},${color[2]})`;
            fragment.appendChild(swatch);
        });
        this.swatches.replaceChildren(fragment);
        if (this.pendingTitle !== undefined) {
            this.title.textContent = this.pendingTitle;
            this.pendingTitle = undefined;
        }
    }

    private showColorInfo(index: number): void {
        const color = this.palette[index];
        if (!color) return;
        const csv = this.palette.map(rgbToHex).join(", ");
        window.alert(`Selected Color: ${rgbToHex(color)}\n\nPalette:\n${csv}`);
    }
}
