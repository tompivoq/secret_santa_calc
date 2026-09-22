/**
 * jsdom renders `<dialog>` but hasn't implemented `showModal()`/`close()` —
 * they need the top layer, which it doesn't have. Without this, any test
 * touching a modal dies on "dialog.showModal is not a function".
 *
 * The shim only makes the dialog open and closed, which is all the tests
 * assert on. The parts it can't reproduce — focus trapping, Esc, an inert
 * background — are the browser's job and the whole reason for preferring
 * `<dialog>` over a div and an overlay in the first place.
 *
 * Guarded because this file also loads for tests running in the node
 * environment, where there is no DOM at all.
 */
if (typeof HTMLDialogElement !== "undefined") {
	if (!HTMLDialogElement.prototype.showModal) {
		HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
			this.open = true;
		};
	}
	if (!HTMLDialogElement.prototype.close) {
		HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
			this.open = false;
			this.dispatchEvent(new Event("close"));
		};
	}
}

/**
 * jsdom does no layout, so it leaves out the geometry calls the notes
 * editor (ProseMirror, under Tiptap) makes to map the cursor to the screen
 * and back. These answer "nothing is anywhere", which is enough for it to
 * carry on — the tests assert on content and requests, never on position.
 */
if (typeof Range !== "undefined") {
	const noRect = () => new DOMRect(0, 0, 0, 0);
	const noRects = () =>
		Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList;
	Range.prototype.getBoundingClientRect ??= noRect;
	Range.prototype.getClientRects ??= noRects;
	// Not part of Text in the DOM spec (hence the cast), but ProseMirror asks
	// text nodes too.
	const text = Text.prototype as unknown as Pick<
		Element,
		"getBoundingClientRect" | "getClientRects"
	>;
	text.getBoundingClientRect ??= noRect;
	text.getClientRects ??= noRects;
	document.elementFromPoint ??= () => null;
}
