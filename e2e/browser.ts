/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { chromium, type Browser, type Page } from "playwright";
import { drawSyntheticImage } from "./synthetic-image.ts";

/** Launch Chromium; CHROMIUM_PATH selects a specific binary. */
export function launchBrowser(): Promise<Browser> {
    const executablePath = process.env["CHROMIUM_PATH"];
    return chromium.launch(executablePath ? { executablePath } : {});
}

/** Make `window.drawSyntheticImage(width, height)` available in the page. */
export async function installSyntheticImage(page: Page): Promise<void> {
    // The function is already plain JS at runtime (Node strips the types).
    await page.evaluate(`
        window.drawSyntheticImage = async (width, height) => {
            const canvas = document.getElementById("canvas");
            canvas.width = width;
            canvas.height = height;
            (${drawSyntheticImage.toString()})(canvas.getContext("2d"), width, height);
            await window.retroizer?.adoptCanvas?.();
        };
    `);
}

declare global {
    interface Window {
        drawSyntheticImage?: (width: number, height: number) => Promise<void>;
    }
}
