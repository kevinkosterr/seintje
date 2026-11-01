// happy-dom's Web Animations rejects `finished` on cancel with nobody listening,
// which browsers don't surface. Without it, motion uses its own JS engine.
// biome-ignore lint/suspicious/noExplicitAny: test environment patch
delete (Element.prototype as any).animate;
