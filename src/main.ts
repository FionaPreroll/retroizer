/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import "./style.css";

import { NES_PALETTE } from "./core/palettes.ts";
import type { Operation, OperationParams } from "./core/types.ts";
import { Renderer } from "./renderer.ts";
import { byId } from "./ui/dom.ts";
import { History } from "./ui/history.ts";
import { PaletteView } from "./ui/palette-view.ts";
import { StatusDisplay } from "./ui/status.ts";

const CAT_IMAGE_URL =
    "https://images.unsplash.com/photo-1544376543-c3dd0266dc86?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=cassidy-james-blaede-TA22tc6YyMw-unsplash.jpg&w=640";

type ParamName = "pixelSize" | "colors" | "scale";
const DEFAULTS: Record<ParamName, number> = { pixelSize: 4, colors: 16, scale: 1 };

const canvas = byId("canvas", HTMLCanvasElement);
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) throw new Error("Canvas 2D is not supported");
const ctx: CanvasRenderingContext2D = context;

const status = new StatusDisplay();
const paletteView = new PaletteView();
const history = new History<ImageData>(10);
const renderer = new Renderer();

const controls: Record<ParamName, { slider: HTMLInputElement; input: HTMLInputElement }> = {
    pixelSize: {
        slider: byId("pixelSize", HTMLInputElement),
        input: byId("pixelSizeInput", HTMLInputElement),
    },
    colors: {
        slider: byId("colors", HTMLInputElement),
        input: byId("colorsInput", HTMLInputElement),
    },
    scale: {
        slider: byId("scale", HTMLInputElement),
        input: byId("scaleInput", HTMLInputElement),
    },
};

/** Buttons that must not be used while an operation is running. */
const busyButtons = [
    "renderButton",
    "renderPalettizeButton",
    "renderPixelizeButton",
    "undoButton",
    "redoButton",
    "resetToOriginal",
].map((id) => byId(id, HTMLButtonElement));

/** The last loaded source image, for "Reset to Original" and "Copy Original Image". */
let originalImage: ImageBitmap | null = null;
let busy = false;

// ---------------------------------------------------------------------------
// Parameters

function readParam(name: ParamName): number {
    const { slider } = controls[name];
    const value = Number(slider.value);
    const clamped = Math.min(Number(slider.max), Math.max(Number(slider.min), value));
    return Number.isFinite(clamped) ? clamped : DEFAULTS[name];
}

function setParam(name: ParamName, value: number): void {
    controls[name].slider.value = String(value);
    controls[name].input.value = String(value);
}

function bindParam(name: ParamName, onChange: () => void = () => undefined): void {
    const { slider, input } = controls[name];
    slider.addEventListener("input", () => {
        input.value = slider.value;
        onChange();
    });
    input.addEventListener("input", () => {
        slider.value = input.value;
        onChange();
    });
}

function updateScale(): void {
    const scale = readParam("scale");
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
}

function resetSettings(): void {
    for (const name of Object.keys(DEFAULTS) as ParamName[]) setParam(name, DEFAULTS[name]);
    updateScale();
}

// ---------------------------------------------------------------------------
// Canvas helpers

function snapshot(): ImageData {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function restore(imageData: ImageData): void {
    if (canvas.width !== imageData.width || canvas.height !== imageData.height) {
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        updateScale();
    }
    ctx.putImageData(imageData, 0, 0);
}

function drawImage(image: ImageBitmap): void {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    updateScale();
}

/** Show a new source image. A paste can be undone; other sources start a fresh history. */
function loadImage(image: ImageBitmap, { undoable = false } = {}): void {
    if (undoable) history.push(snapshot());
    else history.clear();
    originalImage = image;
    drawImage(image);
    status.update("READY", "Image loaded");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Image sources

async function handleFileUpload(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        status.update("BUSY", "LOADING");
        loadImage(await createImageBitmap(file));
    } catch (error) {
        console.error("Failed to load file:", error);
        status.update("ERROR", "Could not load image file");
    }
}

async function pasteFromClipboard(): Promise<void> {
    try {
        status.update("BUSY", "PASTING");
        const items = await navigator.clipboard.read();
        for (const item of items) {
            const type = item.types.find((t) => t.startsWith("image/"));
            if (!type) continue;
            const blob = await item.getType(type);
            loadImage(await createImageBitmap(blob), { undoable: true });
            return;
        }
        status.update("ERROR", "No image in clipboard");
    } catch (error) {
        console.error("Failed to read clipboard contents:", error);
        status.update("ERROR", "Failed to read clipboard contents. Ensure an image is copied.");
    }
}

async function importCatImage(): Promise<void> {
    try {
        status.update("BUSY", "FETCHING IMAGE");
        const response = await fetch(CAT_IMAGE_URL, { mode: "cors" });
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        loadImage(await createImageBitmap(await response.blob()));
    } catch (error) {
        console.error("Failed to import cat image:", error);
        status.update("ERROR", errorMessage(error));
    }
}

function resetToOriginalImage(): void {
    if (!originalImage) {
        status.update("ERROR", "No original image");
        return;
    }
    history.clear();
    drawImage(originalImage);
    status.update("READY", "Original restored");
}

// ---------------------------------------------------------------------------
// Export

function toPngBlob(source: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        source.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not encode PNG"));
        }, "image/png");
    });
}

/** Copy a canvas to the clipboard as PNG. */
function copyToClipboard(source: HTMLCanvasElement, doneMessage: string): void {
    if (typeof ClipboardItem === "undefined") {
        status.update(
            "ERROR",
            "Your browser does not support copying images to the clipboard. Please save the image instead.",
        );
        return;
    }
    // Passing a promise keeps the clipboard write inside the user gesture (Safari).
    navigator.clipboard
        .write([new ClipboardItem({ "image/png": toPngBlob(source) })])
        .then(() => {
            status.update("READY", doneMessage);
        })
        .catch((error: unknown) => {
            console.error("Error copying to clipboard:", error);
            status.update("ERROR", "Failed to copy to clipboard.");
        });
}

function copyOriginalImage(): void {
    if (!originalImage) {
        status.update("ERROR", "No original image");
        return;
    }
    const copy = document.createElement("canvas");
    copy.width = originalImage.width;
    copy.height = originalImage.height;
    copy.getContext("2d")?.drawImage(originalImage, 0, 0);
    copyToClipboard(copy, "Original copied");
}

async function saveToFile(): Promise<void> {
    const url = URL.createObjectURL(await toPngBlob(canvas));
    const link = document.createElement("a");
    link.download = "pixelated_image.png";
    link.href = url;
    link.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);
}

// ---------------------------------------------------------------------------
// Rendering

function setBusy(value: boolean): void {
    busy = value;
    for (const button of busyButtons) button.disabled = value;
}

const LABELS: Record<Operation, string> = {
    palettize: "Palettizing",
    pixelize: "Pixelizing",
    retroize: "RENDERING",
};

/** Run an operation on the current canvas content. Resolves when the result is shown. */
async function render(operation: Operation): Promise<void> {
    if (busy) return;
    if (canvas.width === 0 || canvas.height === 0) {
        status.update("ERROR", "No image");
        return;
    }

    setBusy(true);
    status.update("BUSY", LABELS[operation]);
    status.setProgress(0);

    const params: OperationParams = {
        colors: readParam("colors"),
        pixelSize: readParam("pixelSize"),
    };
    if (operation !== "pixelize") {
        paletteView.setExpanded(true);
        paletteView.show([], "Palette (calculating...)");
    }

    const before = snapshot();
    const started = performance.now();
    try {
        const input = new ImageData(
            new Uint8ClampedArray(before.data),
            before.width,
            before.height,
        );
        const { imageData, palette } = await renderer.run(operation, input, params, (progress) => {
            status.setProgress(progress.value);
            if (progress.palette) paletteView.show(progress.palette);
        });

        history.push(before);
        restore(imageData);
        if (palette) {
            paletteView.show(palette, `Palette (${palette.length} colors)`);
            console.log("Final Color Palette:", palette);
        }
        const seconds = ((performance.now() - started) / 1000).toFixed(2);
        status.update("READY", `Done in ${seconds}s`);
    } catch (error) {
        console.error(`Error during ${operation}:`, error);
        status.update("ERROR", `${LABELS[operation]} failed`);
    } finally {
        setBusy(false);
    }
}

function undo(): void {
    const previous = history.undo(snapshot());
    if (previous) restore(previous);
}

function redo(): void {
    const next = history.redo(snapshot());
    if (next) restore(next);
}

// ---------------------------------------------------------------------------
// Wiring

function onClick(id: string, handler: () => unknown): void {
    byId(id, HTMLButtonElement).addEventListener("click", () => {
        void handler();
    });
}

bindParam("pixelSize");
bindParam("colors");
bindParam("scale", updateScale);

byId("fileInput", HTMLInputElement).addEventListener("change", (event) => {
    void handleFileUpload(event);
});
onClick("pasteClipboard", pasteFromClipboard);
onClick("importImage", importCatImage);
onClick("resetButton", resetSettings);
onClick("resetToOriginal", resetToOriginalImage);
onClick("copyOriginalImage", copyOriginalImage);
onClick("copyCanvas", () => {
    copyToClipboard(canvas, "Canvas copied");
});
onClick("saveCanvas", saveToFile);
onClick("renderPalettizeButton", () => render("palettize"));
onClick("renderPixelizeButton", () => render("pixelize"));
onClick("renderButton", () => render("retroize"));
onClick("undoButton", undo);
onClick("redoButton", redo);

paletteView.show(NES_PALETTE, "Palette (initialized)");
status.update("READY");

/** Hook for the benchmark/soak scripts and for debugging in the console. */
export interface RetroizerDebugApi {
    readonly render: (operation: Operation) => Promise<void>;
    readonly undo: () => void;
    readonly redo: () => void;
    readonly setParam: (name: ParamName, value: number) => void;
    readonly usesWorker: () => boolean;
}

declare global {
    interface Window {
        retroizer?: RetroizerDebugApi;
    }
}

window.retroizer = {
    render,
    undo,
    redo,
    setParam,
    usesWorker: () => renderer.usesWorker,
};
