/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "@fontsource/press-start-2p/latin-400.css";
import "./style.css";

import { BUILD_INFO, THIRD_PARTY } from "./build-info.ts";
import { toGimpPalette, toHexList } from "./core/palette-format.ts";
import { NES_PALETTE } from "./core/palettes.ts";
import type { Operation, OperationParams } from "./core/types.ts";
import { Renderer } from "./renderer.ts";
import { AboutDialog } from "./ui/about.ts";
import { byId } from "./ui/dom.ts";
import { History } from "./ui/history.ts";
import { PaletteView } from "./ui/palette-view.ts";
import { PreviewFab } from "./ui/preview-fab.ts";
import { StatusDisplay } from "./ui/status.ts";
import { bindThemePicker, preferences } from "./ui/theme.ts";

const CAT_IMAGE_URL =
    "https://images.unsplash.com/photo-1544376543-c3dd0266dc86?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=cassidy-james-blaede-TA22tc6YyMw-unsplash.jpg&w=640";
const SCANLINES_STORAGE_KEY = "retroizer.scanlines";

type ParamName = "pixelSize" | "colors" | "scale";
const DEFAULTS: Record<ParamName, number> = { pixelSize: 4, colors: 16, scale: 1 };

const READOUTS: Record<ParamName, (value: number) => string> = {
    pixelSize: (value) => `${String(value).padStart(2, "0")} PX`,
    colors: (value) => String(value).padStart(3, "0"),
    scale: (value) => `${value.toFixed(1)}×`,
};

const canvas = byId("canvas", HTMLCanvasElement);
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) throw new Error("Canvas 2D is not supported");
const ctx: CanvasRenderingContext2D = context;
const originalCanvas = byId("originalCanvas", HTMLCanvasElement);
const bay = byId("canvas-container", HTMLDivElement);

const status = new StatusDisplay();
const previewFab = new PreviewFab(bay, canvas);
const history = new History<ImageData>(10);
const renderer = new Renderer();
const about = new AboutDialog(BUILD_INFO, THIRD_PARTY);
const paletteView = new PaletteView((hex) => {
    void copyText(hex, `${hex} copied`);
});

const controls: Record<ParamName, { slider: HTMLInputElement; readout: HTMLOutputElement }> = {
    pixelSize: {
        slider: byId("pixelSize", HTMLInputElement),
        readout: byId("pixelSizeInput", HTMLOutputElement),
    },
    colors: {
        slider: byId("colors", HTMLInputElement),
        readout: byId("colorsInput", HTMLOutputElement),
    },
    scale: {
        slider: byId("scale", HTMLInputElement),
        readout: byId("scaleInput", HTMLOutputElement),
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

const undoButton = byId("undoButton", HTMLButtonElement);
const redoButton = byId("redoButton", HTMLButtonElement);
const historyInfo = byId("historyInfo", HTMLSpanElement);
const viewportInfo = byId("viewportInfo", HTMLParagraphElement);
const showOriginalButton = byId("showOriginal", HTMLButtonElement);
const showRetroButton = byId("showRetro", HTMLButtonElement);
const scanlinesToggle = byId("scanlinesToggle", HTMLButtonElement);

/** The last loaded source image, for "Revert to original", "Copy original" and the compare view. */
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

function updateReadout(name: ParamName): void {
    controls[name].readout.value = READOUTS[name](readParam(name));
}

function setParam(name: ParamName, value: number): void {
    controls[name].slider.value = String(value);
    updateReadout(name);
    if (name === "scale") updateScale();
}

function bindParam(name: ParamName, onChange: () => void = () => undefined): void {
    controls[name].slider.addEventListener("input", () => {
        updateReadout(name);
        onChange();
    });
    updateReadout(name);
}

function updateScale(): void {
    const scale = readParam("scale");
    for (const target of [canvas, originalCanvas]) {
        target.style.width = `${target.width * scale}px`;
        target.style.height = `${target.height * scale}px`;
    }
    updateViewportInfo();
}

function resetSettings(): void {
    for (const name of Object.keys(DEFAULTS) as ParamName[]) setParam(name, DEFAULTS[name]);
}

// ---------------------------------------------------------------------------
// Viewport

function updateViewportInfo(): void {
    const parts = originalImage
        ? [
              `${canvas.width} × ${canvas.height} px`,
              `Zoom ${Math.round(readParam("scale") * 100)} %`,
          ]
        : ["No image"];
    viewportInfo.replaceChildren(
        ...["Viewport", ...parts].map((text) => {
            const span = document.createElement("span");
            span.textContent = text;
            return span;
        }),
    );
}

function setView(view: "original" | "retro"): void {
    const showOriginal = view === "original" && originalImage !== null;
    bay.dataset["view"] = showOriginal ? "original" : "retro";
    showOriginalButton.setAttribute("aria-pressed", String(showOriginal));
    showRetroButton.setAttribute("aria-pressed", String(!showOriginal));
}

function setScanlines(on: boolean): void {
    bay.dataset["scanlines"] = String(on);
    scanlinesToggle.setAttribute("aria-pressed", String(on));
    preferences.set(SCANLINES_STORAGE_KEY, on ? "on" : "off");
}

function updateHistoryInfo(): void {
    historyInfo.textContent = `History ${history.size} / ${history.capacity}`;
    if (!busy) {
        undoButton.disabled = !history.canUndo;
        redoButton.disabled = !history.canRedo;
    }
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
    previewFab.refresh();
}

function drawImage(image: ImageBitmap): void {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    updateScale();
    previewFab.refresh();
}

function drawOriginal(image: ImageBitmap): void {
    originalCanvas.width = image.width;
    originalCanvas.height = image.height;
    originalCanvas.getContext("2d")?.drawImage(image, 0, 0);
}

/** Show a new source image. A paste can be undone; other sources start a fresh history. */
function loadImage(image: ImageBitmap, { undoable = false } = {}): void {
    if (undoable && originalImage) history.push(snapshot());
    else history.clear();
    originalImage = image;
    drawOriginal(image);
    drawImage(image);
    bay.dataset["empty"] = "false";
    showOriginalButton.disabled = false;
    setView("retro");
    updateHistoryInfo();
    status.update("READY", "Image loaded");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Image sources

async function loadFile(file: File | undefined): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        status.update("ERROR", "Not an image file");
        return;
    }
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
    setView("retro");
    updateHistoryInfo();
    status.update("READY", "Original restored");
}

/** Drag & drop onto the drop zone or the viewport. */
function bindDropTarget(target: HTMLElement): void {
    target.addEventListener("dragover", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        target.toggleAttribute("data-dragging", true);
    });
    target.addEventListener("dragleave", () => {
        target.toggleAttribute("data-dragging", false);
    });
    target.addEventListener("drop", (event) => {
        event.preventDefault();
        target.toggleAttribute("data-dragging", false);
        void loadFile(event.dataTransfer?.files[0]);
    });
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

async function copyText(text: string, doneMessage: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        status.update("READY", doneMessage);
    } catch (error) {
        console.error("Error copying text:", error);
        status.update("ERROR", "Failed to copy to clipboard.");
    }
}

function copyOriginalImage(): void {
    if (!originalImage) {
        status.update("ERROR", "No original image");
        return;
    }
    copyToClipboard(originalCanvas, "Original copied");
}

function download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);
}

async function saveToFile(): Promise<void> {
    if (!originalImage) {
        status.update("ERROR", "No image");
        return;
    }
    download(await toPngBlob(canvas), "pixelated_image.png");
}

function exportPalette(): void {
    const palette = paletteView.current;
    const text = toGimpPalette(palette, `Retroizer ${palette.length} colours`);
    download(new Blob([text], { type: "text/plain" }), "retroizer.gpl");
    status.update("READY", "Palette exported");
}

// ---------------------------------------------------------------------------
// Rendering

function setBusy(value: boolean): void {
    busy = value;
    for (const button of busyButtons) button.disabled = value;
    if (!value) updateHistoryInfo();
}

const LABELS: Record<Operation, string> = {
    palettize: "Palettizing",
    pixelize: "Pixelizing",
    retroize: "RENDERING",
};

/** Run an operation on the current canvas content. Resolves when the result is shown. */
async function render(operation: Operation): Promise<void> {
    if (busy) return;
    if (canvas.width === 0 || canvas.height === 0 || bay.dataset["empty"] === "true") {
        status.update("ERROR", "No image");
        return;
    }

    setBusy(true);
    setView("retro");
    previewFab.setState("busy");
    status.update("BUSY", LABELS[operation]);
    status.setProgress(0);

    const params: OperationParams = {
        colors: readParam("colors"),
        pixelSize: readParam("pixelSize"),
    };
    if (operation !== "pixelize") paletteView.show([], "calculating...");

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
        if (palette) paletteView.show(palette, `${palette.length} colours · k-means`);
        const seconds = ((performance.now() - started) / 1000).toFixed(2);
        status.update("READY", `Done in ${seconds}s`);
        previewFab.setState("done");
    } catch (error) {
        console.error(`Error during ${operation}:`, error);
        status.update("ERROR", `${LABELS[operation]} failed`);
        previewFab.setState("idle");
    } finally {
        setBusy(false);
    }
}

function undo(): void {
    const previous = history.undo(snapshot());
    if (previous) restore(previous);
    updateHistoryInfo();
}

function redo(): void {
    const next = history.redo(snapshot());
    if (next) restore(next);
    updateHistoryInfo();
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

const fileInput = byId("fileInput", HTMLInputElement);
fileInput.addEventListener("change", () => {
    void loadFile(fileInput.files?.[0]).finally(() => {
        fileInput.value = ""; // allow loading the same file again
    });
});
bindDropTarget(byId("dropZone", HTMLLabelElement));
bindDropTarget(bay);

onClick("loadButton", () => {
    fileInput.click();
});
onClick("emptyLoadButton", () => {
    fileInput.click();
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
onClick("showOriginal", () => {
    setView("original");
});
onClick("showRetro", () => {
    setView("retro");
});
onClick("scanlinesToggle", () => {
    setScanlines(bay.dataset["scanlines"] !== "true");
});
onClick("copyPaletteButton", () => copyText(toHexList(paletteView.current), "Palette copied"));
onClick("exportPaletteButton", exportPalette);
onClick("aboutButton", () => {
    about.open();
});

bindThemePicker(document.querySelectorAll<HTMLInputElement>('input[name="theme"]'));
setScanlines(preferences.get(SCANLINES_STORAGE_KEY) !== "off");
showOriginalButton.disabled = true;
updateHistoryInfo();
updateViewportInfo();
paletteView.show(NES_PALETTE, "NES preset");
status.update("READY");
status.setProgress(0);

/** Hook for the benchmark/soak scripts and for debugging in the console. */
export interface RetroizerDebugApi {
    readonly render: (operation: Operation) => Promise<void>;
    readonly undo: () => void;
    readonly redo: () => void;
    readonly setParam: (name: ParamName, value: number) => void;
    readonly usesWorker: () => boolean;
    /** Treat whatever is drawn on the canvas as a freshly loaded image. */
    readonly adoptCanvas: () => Promise<void>;
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
    adoptCanvas: async () => {
        loadImage(await createImageBitmap(canvas));
    },
};
