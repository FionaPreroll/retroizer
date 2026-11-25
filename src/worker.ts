/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/* Web Worker: runs image operations off the UI thread. */

/// <reference lib="webworker" />

import { runOperation } from "./core/pipeline.ts";
import type { RenderRequest, RenderResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

function reply(message: RenderResponse, transfer: Transferable[] = []): void {
    self.postMessage(message, transfer);
}

self.addEventListener("message", (event: MessageEvent<RenderRequest>) => {
    const { id, operation, buffer, width, height, params } = event.data;
    try {
        const data = new Uint8ClampedArray(buffer);
        const { palette } = runOperation(operation, data, width, height, params, (progress) => {
            reply({ id, type: "progress", progress });
        });
        reply({ id, type: "done", buffer, palette }, [buffer]);
    } catch (error) {
        reply({
            id,
            type: "error",
            message: error instanceof Error ? error.message : String(error),
        });
    }
});
