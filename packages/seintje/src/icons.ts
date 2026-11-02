import type { ToastType } from "./types";

/* Icon shapes adapted from Lucide (https://lucide.dev), ISC License. */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Child elements of a 24×24 stroked icon, as tag and attributes. */
type IconNode = ReadonlyArray<readonly [tag: string, attrs: Readonly<Record<string, string>>]>;

const circle = ["circle", { cx: "12", cy: "12", r: "10" }] as const;

/** Icon per toast type. */
const ICONS: Record<ToastType, IconNode> = {
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

export function createIcon(type: ToastType): SVGElement {
  const svg = draw(ICONS[type], 18);
  if (type === "loading") svg.setAttribute("data-seintje-spin", "");
  return svg;
}

/** Small cross used by the dismiss button. */
export const createCloseIcon = (): SVGElement => draw(CLOSE, 14);
