/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/* Minimal static file server for the benchmark and soak scripts. */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};

export interface StaticServer {
    readonly url: string;
    close(): Promise<void>;
}

/** Serve `directory` on a random local port. */
export async function serveDirectory(directory: string): Promise<StaticServer> {
    const root = resolve(directory);
    const server: Server = createServer((request, response) => {
        void (async () => {
            const path = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname);
            let file = normalize(join(root, path));
            if (file !== root && !file.startsWith(root + sep)) {
                response.writeHead(403).end();
                return;
            }
            try {
                if ((await stat(file)).isDirectory()) file = join(file, "index.html");
                await stat(file);
                response.writeHead(200, {
                    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
                });
                createReadStream(file).pipe(response);
            } catch {
                response.writeHead(404).end("Not found");
            }
        })();
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}/`,
        close: () =>
            new Promise<void>((done, fail) => {
                server.close((error) => {
                    if (error) fail(error);
                    else done();
                });
            }),
    };
}
