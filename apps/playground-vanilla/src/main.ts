import { createToaster, type MotionPreference, type Position, seintje, type Theme } from "seintje";
import "seintje/styles.css";

const toaster = createToaster(document.body, { position: "bottom-right" });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const demos: Record<string, () => void> = {
  neutral: () => seintje.show("Draft saved"),
  success: () =>
    seintje.success({
      title: "Changes published",
      description: "Your site is live. It can take a minute before every visitor sees it.",
    }),
  info: () => seintje.info({ title: "Heads up", description: "Maintenance tonight from 02:00." }),
  warning: () =>
    seintje.warning({ title: "Storage almost full", description: "92% of your quota is in use." }),
  error: () =>
    seintje.error({ title: "Upload failed", description: "The file is larger than 25 MB." }),
  action: () =>
    seintje.show({
      type: "info",
      title: "Message archived",
      description: "You can find it under Archive.",
      action: { label: "Undo", onClick: () => seintje.success("Restored"), dismiss: true },
    }),
  "action-only": () =>
    seintje.show({
      title: "Draft discarded",
      action: { label: "Undo", onClick: () => seintje.success("Restored"), dismiss: true },
    }),
  "action-below": () =>
    seintje.show({
      title: "Draft discarded",
      action: { label: "Undo", onClick: () => seintje.success("Restored"), dismiss: true },
      actionPlacement: "below",
    }),
  "action-hover": () =>
    seintje.show({
      title: "Draft discarded",
      action: { label: "Undo", onClick: () => seintje.success("Restored"), dismiss: true },
      actionVisibility: "hover",
    }),
  promise: () =>
    void seintje
      .promise(
        wait(1800).then(() => ({ count: 12 })),
        {
          loading: "Syncing",
          success: (result) => ({
            title: "Synced",
            description: `${result.count} items are up to date.`,
          }),
          error: "Sync failed",
        },
      )
      .catch(() => {}),
  persistent: () =>
    seintje.warning({
      title: "Connection lost",
      description: "Trying to reconnect…",
      duration: null,
    }),
  custom: () =>
    seintje.show({
      title: "Custom content",
      description: (slot) => {
        const strong = document.createElement("strong");
        strong.textContent = "DOM nodes";
        slot.append("Rendered with ", strong, " through a renderer.");
        return () => console.log("cleaned up");
      },
    }),
  dismiss: () => seintje.dismiss(),
};

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-demo]")) {
  button.addEventListener("click", () => demos[button.dataset.demo ?? ""]?.());
}

const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
select("position").addEventListener("change", (e) =>
  toaster.update({ position: (e.target as HTMLSelectElement).value as Position }),
);
select("theme").addEventListener("change", (e) =>
  toaster.update({ theme: (e.target as HTMLSelectElement).value as Theme }),
);
select("motion").addEventListener("change", (e) =>
  toaster.update({ motion: (e.target as HTMLSelectElement).value as MotionPreference }),
);
select("limit").addEventListener("change", (e) =>
  toaster.update({ limit: Number((e.target as HTMLSelectElement).value) }),
);

Object.assign(window, { seintje, toaster });
