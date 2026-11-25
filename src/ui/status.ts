/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { byId } from "./dom.ts";

export type StatusState = "READY" | "BUSY" | "ERROR";

const DISPLAY_LENGTH = 24;
const SEGMENTS = 24;
const SPINNER = ["-", "\\", "|", "/"] as const;

/** Fit a status line into the fixed-width display. */
export function formatStatusLine(state: StatusState, message = ""): string {
    const line = message === "" ? state : `${state}: ${message}`;
    return line.length > DISPLAY_LENGTH
        ? `${line.slice(0, DISPLAY_LENGTH - 2)}..`
        : line.padEnd(DISPLAY_LENGTH, " ");
}

/** Number of lit progress segments for a progress value of 0–100. */
export function litSegments(value: number, segments = SEGMENTS): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round((Math.min(100, Math.max(0, value)) / 100) * segments);
}

/** The retro status display: LED, 24-cell LCD with spinner, segmented progress bar. */
export class StatusDisplay {
    private readonly led = byId("ledIndicator", HTMLDivElement);
    private readonly text = byId("statusText", HTMLSpanElement);
    private readonly display = byId("statusDisplay", HTMLDivElement);
    private readonly progress = byId("renderProgress", HTMLDivElement);
    private readonly segments: HTMLSpanElement[];
    private state: StatusState | null = null;
    private spinnerTimer: number | undefined;
    private spinnerIndex = 0;

    constructor() {
        this.segments = Array.from({ length: SEGMENTS }, () => {
            const segment = document.createElement("span");
            segment.className = "status__segment";
            return segment;
        });
        this.progress.replaceChildren(...this.segments);
    }

    get current(): StatusState | null {
        return this.state;
    }

    update(state: StatusState, message = ""): void {
        this.setState(state);
        this.display.title = message;
        this.text.textContent = formatStatusLine(state, message);
    }

    /** @param value 0–100 */
    setProgress(value: number): void {
        const lit = litSegments(value);
        this.segments.forEach((segment, index) => {
            segment.toggleAttribute("data-lit", index < lit);
        });
        this.progress.setAttribute("aria-valuenow", String(Math.round(value)));
    }

    private setState(state: StatusState): void {
        if (state === this.state) return;
        this.state = state;
        this.led.dataset["state"] = state; // colour and blinking come from CSS
        this.led.setAttribute("aria-label", `Status ${state}`);

        window.clearInterval(this.spinnerTimer);
        if (state === "BUSY") {
            this.spinnerTimer = window.setInterval(() => {
                this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER.length;
                const line = this.text.textContent.padEnd(DISPLAY_LENGTH, " ");
                const spinner = SPINNER[this.spinnerIndex] ?? "";
                this.text.textContent = line.slice(0, DISPLAY_LENGTH - 1) + spinner;
            }, 100);
        }
    }
}
