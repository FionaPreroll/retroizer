/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { byId } from "./dom.ts";

export type PreviewState = "idle" | "busy" | "done";

/**
 * A small floating thumbnail of the canvas, shown only while the viewport is
 * scrolled out of sight (typically on phones, while adjusting parameters
 * further down). It shows the result without scrolling, lights up while
 * rendering and jumps back to the viewport when tapped.
 */
export class PreviewFab {
    private readonly button = byId("previewFab", HTMLButtonElement);
    private readonly thumb = byId("previewThumb", HTMLCanvasElement);
    private readonly target: HTMLElement;
    private readonly source: HTMLCanvasElement;
    private viewportVisible = true;
    private hasImage = false;
    private doneTimer: number | undefined;

    constructor(target: HTMLElement, source: HTMLCanvasElement) {
        this.target = target;
        this.source = source;

        new IntersectionObserver(
            ([entry]) => {
                this.viewportVisible = entry?.isIntersecting ?? true;
                this.updateVisibility();
            },
            { threshold: 0.2 },
        ).observe(target);

        this.button.addEventListener("click", () => {
            const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            this.target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
        });
    }

    setState(state: PreviewState): void {
        window.clearTimeout(this.doneTimer);
        this.button.dataset["state"] = state;
        this.button.setAttribute(
            "aria-label",
            state === "busy" ? "Rendering… show image" : "Show image",
        );
        if (state === "done") {
            this.doneTimer = window.setTimeout(() => {
                this.button.dataset["state"] = "idle";
            }, 2600);
        }
    }

    /** Redraw the thumbnail from the canvas (center crop, hard pixels). */
    refresh(): void {
        const { width, height } = this.source;
        this.hasImage = width > 0 && height > 0;
        const ctx = this.thumb.getContext("2d");
        if (ctx && this.hasImage) {
            const side = Math.min(width, height);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, this.thumb.width, this.thumb.height);
            ctx.drawImage(
                this.source,
                (width - side) / 2,
                (height - side) / 2,
                side,
                side,
                0,
                0,
                this.thumb.width,
                this.thumb.height,
            );
        }
        this.updateVisibility();
    }

    private updateVisibility(): void {
        this.button.hidden = !this.hasImage || this.viewportVisible;
    }
}
