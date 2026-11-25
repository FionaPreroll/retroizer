/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { byId } from "./dom.ts";

export type StatusState = "READY" | "BUSY" | "ERROR";

const DISPLAY_LENGTH = 24;
const SPINNER = ["-", "\\", "|", "/"] as const;
const LED_COLORS: Record<StatusState, string> = { READY: "green", BUSY: "orange", ERROR: "red" };

/** Fit a status line into the fixed-width display. */
export function formatStatusLine(state: StatusState, message = ""): string {
    const line = message === "" ? state : `${state}: ${message}`;
    return line.length > DISPLAY_LENGTH
        ? `${line.slice(0, DISPLAY_LENGTH - 2)}..`
        : line.padEnd(DISPLAY_LENGTH, " ");
}

/** The retro status display: LED, text line with spinner, and progress bar. */
export class StatusDisplay {
    private readonly led = byId("ledIndicator", HTMLDivElement);
    private readonly text = byId("statusText", HTMLSpanElement);
    private readonly display = byId("statusDisplay", HTMLDivElement);
    private readonly progress = byId("renderProgress", HTMLProgressElement);
    private state: StatusState | null = null;
    private blinkTimer: number | undefined;
    private spinnerTimer: number | undefined;
    private spinnerIndex = 0;

    get current(): StatusState | null {
        return this.state;
    }

    update(state: StatusState, message = ""): void {
        this.setLed(state);
        this.display.title = message;
        this.text.textContent = formatStatusLine(state, message);
    }

    /** @param value 0–100 */
    setProgress(value: number): void {
        this.progress.value = value;
    }

    private setLed(state: StatusState): void {
        if (state === this.state) return;
        this.state = state;

        window.clearInterval(this.blinkTimer);
        window.clearInterval(this.spinnerTimer);
        this.led.style.backgroundColor = LED_COLORS[state];
        this.led.style.opacity = "1";

        if (state === "BUSY") {
            this.blinkTimer = window.setInterval(() => {
                this.led.style.opacity = this.led.style.opacity === "1" ? "0.3" : "1";
            }, 500);
            this.spinnerTimer = window.setInterval(() => {
                this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER.length;
                const line = this.text.textContent.padEnd(DISPLAY_LENGTH, " ");
                const spinner = SPINNER[this.spinnerIndex] ?? "";
                this.text.textContent = line.slice(0, DISPLAY_LENGTH - 1) + spinner;
            }, 100);
        }
    }
}
