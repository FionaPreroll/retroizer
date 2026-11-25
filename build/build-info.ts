/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/* Build metadata baked into the bundle (shown in the About dialog). */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { BuildInfo } from "../src/build-info.ts";

function git(...args: string[]): string | null {
    try {
        return execFileSync("git", args, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return null;
    }
}

export function collectBuildInfo(env: NodeJS.ProcessEnv = process.env): BuildInfo {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        version: string;
        repository: { url: string };
    };
    const onCi = env["GITHUB_ACTIONS"] === "true";
    const server = env["GITHUB_SERVER_URL"] ?? "https://github.com";
    const repository = env["GITHUB_REPOSITORY"];
    const repositoryUrl = repository
        ? `${server}/${repository}`
        : pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

    return {
        version: pkg.version,
        commit: env["GITHUB_SHA"] ?? git("rev-parse", "HEAD"),
        branch: env["GITHUB_REF_NAME"] ?? git("rev-parse", "--abbrev-ref", "HEAD"),
        dirty: !onCi && (git("status", "--porcelain", "--untracked-files=no") ?? "") !== "",
        builtAt: new Date().toISOString(),
        repositoryUrl,
        ci:
            onCi && repository && env["GITHUB_RUN_ID"]
                ? {
                      workflow: env["GITHUB_WORKFLOW"] ?? "CI",
                      runNumber: env["GITHUB_RUN_NUMBER"] ?? "?",
                      runAttempt: env["GITHUB_RUN_ATTEMPT"] ?? "1",
                      url: `${server}/${repository}/actions/runs/${env["GITHUB_RUN_ID"]}`,
                  }
                : null,
    };
}
