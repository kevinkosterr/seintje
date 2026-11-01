import {
  Bell,
  CircleCheck,
  CircleX,
  createElement,
  type IconNode,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide";
import type { ToastType } from "./types";

/** Lucide icon per toast type. */
const ICONS: Record<ToastType, IconNode> = {
  neutral: Bell,
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
  loading: LoaderCircle,
};

const draw = (node: IconNode, size: number): SVGElement => {
  const svg = createElement(node, {
    width: size,
    height: size,
    "stroke-width": 2,
    "aria-hidden": "true",
    focusable: "false",
  });
  return svg;
};

export function createIcon(type: ToastType): SVGElement {
  const svg = draw(ICONS[type], 18);
  if (type === "loading") svg.setAttribute("data-seintje-spin", "");
  return svg;
}

/** Small cross used by the dismiss button. */
export const createCloseIcon = (): SVGElement => draw(X, 14);
