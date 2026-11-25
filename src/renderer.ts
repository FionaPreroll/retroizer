/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { runOperation } from "./core/pipeline.ts";
import type { Operation, OperationParams, Palette, Progress } from "./core/types.ts";
import type { RenderRequest, RenderResponse } from "./protocol.ts";

export interface RenderResult {
    readonly imageData: ImageData;
    readonly palette: Palette | null;
}

type ProgressCallback = (progress: Progress) => void;

interface Job {
    readonly operation: Operation;
    readonly width: number;
    readonly height: number;
    readonly params: OperationParams;
    readonly onProgress: ProgressCallback;
    /** Copy of the input, to re-run on the main thread if the worker dies. */
    readonly backup: Uint8ClampedArray<ArrayBuffer>;
    readonly resolve: (result: RenderResult) => void;
    readonly reject: (error: Error) => void;
}

const nextFrame = (): Promise<void> =>
    new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
    });

/**
 * Runs image operations in a Web Worker so the page stays responsive, and
 * falls back to the main thread if workers are unavailable or crash.
 */
export class Renderer {
    private worker: Worker | null = null;
    private readonly pending = new Map<number, Job>();
    private nextId = 1;

    constructor() {
        try {
            this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
            this.worker.addEventListener("message", (event: MessageEvent<RenderResponse>) => {
                this.handleMessage(event.data);
            });
            this.worker.addEventListener("error", (event) => {
                this.handleWorkerFailure(event);
            });
        } catch (error) {
            console.warn("Web Worker unavailable, rendering on the main thread.", error);
            this.worker = null;
        }
    }

    /** Whether operations currently run in a worker. */
    get usesWorker(): boolean {
        return this.worker !== null;
    }

    /**
     * Run an operation. The buffer of `imageData` is handed over to the
     * worker and must not be used afterwards.
     */
    run(
        operation: Operation,
        imageData: ImageData,
        params: OperationParams,
        onProgress: ProgressCallback = () => undefined,
    ): Promise<RenderResult> {
        const { width, height, data } = imageData;
        const worker = this.worker;
        if (!worker) return this.runOnMainThread(operation, imageData, params, onProgress);

        return new Promise<RenderResult>((resolve, reject) => {
            const id = this.nextId++;
            const backup = new Uint8ClampedArray(data);
            this.pending.set(id, {
                operation,
                width,
                height,
                params,
                onProgress,
                backup,
                resolve,
                reject,
            });
            const buffer = data.buffer;
            const request: RenderRequest = { id, operation, buffer, width, height, params };
            worker.postMessage(request, [buffer]);
        });
    }

    private async runOnMainThread(
        operation: Operation,
        imageData: ImageData,
        params: OperationParams,
        onProgress: ProgressCallback,
    ): Promise<RenderResult> {
        await nextFrame(); // let the browser paint the BUSY state first
        const { width, height, data } = imageData;
        const { palette } = runOperation(operation, data, width, height, params, onProgress);
        return { imageData, palette };
    }

    private handleMessage(message: RenderResponse): void {
        const job = this.pending.get(message.id);
        if (!job) return;

        switch (message.type) {
            case "progress":
                job.onProgress(message.progress);
                return;
            case "done": {
                this.pending.delete(message.id);
                const data = new Uint8ClampedArray(message.buffer);
                job.resolve({
                    imageData: new ImageData(data, job.width, job.height),
                    palette: message.palette,
                });
                return;
            }
            case "error":
                this.pending.delete(message.id);
                job.reject(new Error(message.message));
                return;
        }
    }

    private handleWorkerFailure(event: ErrorEvent): void {
        console.warn("Web Worker failed, rendering on the main thread.", event.message);
        event.preventDefault();
        this.worker?.terminate();
        this.worker = null;

        const jobs = [...this.pending.values()];
        this.pending.clear();
        for (const job of jobs) {
            const imageData = new ImageData(job.backup, job.width, job.height);
            this.runOnMainThread(job.operation, imageData, job.params, job.onProgress).then(
                job.resolve,
                job.reject,
            );
        }
    }
}
