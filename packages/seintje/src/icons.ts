import type { BuiltInToastType, ToastType } from "./types";

/*!
 * The icons below are from Lucide (https://lucide.dev): bell, circle-check,
 * circle-x, info, loader-circle, triangle-alert and x.
 *
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Lucide's info and x icons are derived from Feather (https://feathericons.com):
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Child elements of a 24×24 stroked icon, as tag and attributes. */
type IconNode = ReadonlyArray<readonly [tag: string, attrs: Readonly<Record<string, string>>]>;

const circle = ["circle", { cx: "12", cy: "12", r: "10" }] as const;

/** Icon per toast type. */
const ICONS: Record<BuiltInToastType, IconNode> = {
  neutral: [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
    [
      "path",
      {
        d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
      },
    ],
  ],
  success: [circle, ["path", { d: "m16 9-5.5 5.5L8 12" }]],
  info: [circle, ["path", { d: "M12 16v-4" }], ["path", { d: "M12 8h.01" }]],
  warning: [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  error: [circle, ["path", { d: "m15 9-6 6" }], ["path", { d: "m9 9 6 6" }]],
  loading: [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }]],
};

const CLOSE: IconNode = [
  ["path", { d: "M18 6 6 18" }],
  ["path", { d: "m6 6 12 12" }],
];

const draw = (node: IconNode, size: number): SVGElement => {
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs: Record<string, string> = {
    width: String(size),
    height: String(size),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  };
  for (const [name, value] of Object.entries(attrs)) svg.setAttribute(name, value);
  for (const [tag, childAttrs] of node) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(childAttrs)) child.setAttribute(name, value);
    svg.append(child);
  }
  return svg;
};

/** Draws the icon of a built-in type. Custom types get the neutral icon. */
export function createIcon(type: ToastType): SVGElement {
  const node = Object.hasOwn(ICONS, type) ? ICONS[type as BuiltInToastType] : ICONS.neutral;
  const svg = draw(node, 18);
  if (type === "loading") svg.setAttribute("data-seintje-spin", "");
  return svg;
}

/** Small cross used by the dismiss button. */
export const createCloseIcon = (): SVGElement => draw(CLOSE, 14);

/** True when `value` is SVG markup rather than plain text. */
export const isSvgMarkup = (value: string): boolean => /^\s*<svg[\s>]/i.test(value);

/**
 * Parses inline SVG markup into an element. Scripts, foreign objects and
 * event handler attributes are stripped. Returns `null` for invalid markup.
 */
export function parseSvg(doc: Document, markup: string): SVGElement | null {
  // Template content is inert, and the HTML parser does not require `xmlns`.
  const template = doc.createElement("template");
  template.innerHTML = markup.trim();
  const root = template.content.firstElementChild;
  if (!root || root.namespaceURI !== SVG_NS || root.localName !== "svg") return null;

  for (const unsafe of root.querySelectorAll("script, foreignObject")) unsafe.remove();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const { name, value } of [...element.attributes]) {
      const isHandler = name.toLowerCase().startsWith("on");
      const isScriptLink = /href$/i.test(name) && /^\s*javascript:/i.test(value);
      if (isHandler || isScriptLink) element.removeAttribute(name);
    }
  }
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("focusable", "false");
  return doc.importNode(root, true) as SVGElement;
}
