/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { BuildInfo, ThirdPartyEntry } from "../build-info.ts";
import { byId } from "./dom.ts";

export const CONTACT = { name: "Fiona", email: "fipreroll+app@gmail.com" } as const;
export const LICENSE_ID = "GPL-3.0-only";

type Child = Node | string;

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<Record<"className" | "href" | "title", string>> = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props))
        element.setAttribute(key === "className" ? "class" : key, value);
    element.append(...children);
    return element;
}

function link(href: string, ...children: Child[]): HTMLAnchorElement {
    const a = el("a", { href }, ...children);
    if (/^https?:/.test(href)) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
    }
    return a;
}

function facts(rows: readonly (readonly [string, Child])[]): HTMLDListElement {
    const list = el("dl", { className: "about__facts" });
    for (const [term, value] of rows) list.append(el("dt", {}, term), el("dd", {}, value));
    return list;
}

function section(title: string, ...children: Child[]): HTMLElement {
    return el("section", { className: "about__section" }, el("h3", {}, title), ...children);
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Build the About dialog's content (pure DOM, no innerHTML). */
export function renderAbout(build: BuildInfo, thirdParty: readonly ThirdPartyEntry[]): Node[] {
    const repo = build.repositoryUrl;
    const ref = build.commit ?? "main";
    const repoLabel = repo.replace(/^https?:\/\//, "");

    const intro = el(
        "p",
        {},
        "Turns images into retro pixel art: k-means palette reduction and pixelization, computed entirely in your browser. Your images never leave your device.",
    );

    const project = section(
        "Project",
        facts([
            ["Version", build.version],
            ["Contact", link(`mailto:${CONTACT.email}`, `${CONTACT.name} <${CONTACT.email}>`)],
            ["Source", link(repo, repoLabel)],
            ["Licence", link(`${repo}/blob/${ref}/LICENSE`, LICENSE_ID)],
        ]),
    );

    const commit: Child = build.commit
        ? link(`${repo}/commit/${build.commit}`, el("code", {}, build.commit.slice(0, 7)))
        : "unknown";
    const buildRows: (readonly [string, Child])[] = [
        ["Commit", build.dirty ? el("span", {}, commit, " (with local changes)") : commit],
        ["Branch", build.branch ?? "unknown"],
        ["Built", formatDate(build.builtAt)],
        [
            "CI run",
            build.ci
                ? link(
                      build.ci.url,
                      `${build.ci.workflow} #${build.ci.runNumber}, attempt ${build.ci.runAttempt}`,
                  )
                : "Local build",
        ],
    ];
    const buildSection = section("Build", facts(buildRows));

    const credits = el(
        "ul",
        { className: "about__credits" },
        ...thirdParty.map((entry) =>
            el(
                "li",
                { className: "about__credit" },
                el(
                    "div",
                    { className: "about__credit-head" },
                    link(entry.url, entry.version ? `${entry.name} ${entry.version}` : entry.name),
                    el("span", { className: "about__credit-license" }, entry.license),
                ),
                el("p", {}, entry.purpose),
            ),
        ),
    );
    const thirdPartySection = section(
        "Third-party",
        el(
            "p",
            {},
            "No third-party code runs in the app. It ships two fonts, and fetches one photo on request. Build tools such as Vite and TypeScript are not part of the app.",
        ),
        credits,
        el("p", {}, link("third-party-licenses.txt", "Full licence texts")),
    );

    return [intro, project, buildSection, thirdPartySection];
}

/** The About dialog: closes via its buttons, Escape, or a click outside the panel. */
export class AboutDialog {
    private readonly dialog = byId("aboutDialog", HTMLDialogElement);
    private readonly content = byId("aboutContent", HTMLDivElement);
    private readonly build: BuildInfo;
    private readonly thirdParty: readonly ThirdPartyEntry[];
    private rendered = false;

    constructor(build: BuildInfo, thirdParty: readonly ThirdPartyEntry[]) {
        this.build = build;
        this.thirdParty = thirdParty;
        for (const button of this.dialog.querySelectorAll<HTMLButtonElement>("[data-close]")) {
            button.addEventListener("click", () => {
                this.close();
            });
        }
        // The panel fills the dialog box, so a click that lands on the dialog itself is on the backdrop.
        this.dialog.addEventListener("click", (event) => {
            if (event.target === this.dialog) this.close();
        });
    }

    open(): void {
        if (!this.rendered) {
            this.content.replaceChildren(...renderAbout(this.build, this.thirdParty));
            this.rendered = true;
        }
        this.dialog.showModal();
    }

    close(): void {
        this.dialog.close();
    }
}
