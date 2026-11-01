const SVG_NS = "http://www.w3.org/2000/svg";

export interface GooeyCanvas {
  svg: SVGSVGElement;
  /** The rounded pill behind the header. */
  pill: SVGRectElement;
  /** The panel behind the expanded body. */
  panel: SVGRectElement;
  setRadius(radius: number): void;
}

let filterCounter = 0;

const el = <K extends keyof SVGElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
};

/**
 * Builds the SVG that draws the toast's shape. The pill and panel are blurred
 * together and then cut back to a hard edge with an alpha threshold, so they
 * melt into one blob where they touch. The original shapes are composited on
 * top to keep their edges crisp.
 */
export function createGooeyCanvas(doc: Document, width: number): GooeyCanvas {
  const id = `seintje-goo-${++filterCounter}`;
  const svg = el(doc, "svg", { width, height: 1, "aria-hidden": "true", focusable: "false" });
  svg.dataset.seintjeCanvas = "";

  const filter = el(doc, "filter", {
    id,
    x: "-20%",
    y: "-20%",
    width: "140%",
    height: "140%",
    "color-interpolation-filters": "sRGB",
  });
  const blur = el(doc, "feGaussianBlur", { in: "SourceGraphic", stdDeviation: 7, result: "soft" });
  const threshold = el(doc, "feColorMatrix", {
    in: "soft",
    type: "matrix",
    values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -9",
    result: "blob",
  });
  const crisp = el(doc, "feComposite", { in: "SourceGraphic", in2: "blob", operator: "atop" });
  filter.append(blur, threshold, crisp);

  const defs = el(doc, "defs", {});
  defs.append(filter);

  const group = el(doc, "g", { filter: `url(#${id})` });
  const pill = el(doc, "rect", { x: 0, y: 0, width: 0, height: 0 });
  pill.dataset.seintjePill = "";
  const panel = el(doc, "rect", { x: 0, y: 0, width, height: 0 });
  panel.dataset.seintjePanel = "";
  group.append(pill, panel);
  svg.append(defs, group);

  return {
    svg,
    pill,
    panel,
    setRadius(radius) {
      for (const rect of [pill, panel]) {
        rect.setAttribute("rx", String(radius));
        rect.setAttribute("ry", String(radius));
      }
      blur.setAttribute("stdDeviation", String(Math.max(0.01, radius * 0.4)));
    },
  };
}
