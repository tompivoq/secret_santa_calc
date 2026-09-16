import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
	open: boolean;
	/** Called however the dialog was dismissed — the close button, Esc, or the backdrop. */
	onClose: () => void;
	title: string;
	children: ReactNode;
}

/**
 * A modal built on the native `<dialog>`, which brings focus trapping, Esc
 * to dismiss, and an inert background with it — all things a div behind an
 * overlay has to reimplement, usually incompletely.
 */
export const Modal = ({ open, onClose, title, children }: ModalProps) => {
	const dialogRef = useRef<HTMLDialogElement>(null);

	// Synchronising a prop with an imperative DOM API, which is what effects
	// are for: there's no attribute that opens a dialog *modally*, only
	// showModal(). The `open` attribute alone renders it non-modal.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		<dialog
			ref={dialogRef}
			onClose={onClose}
			// A click lands on the dialog element itself only when it hit the
			// backdrop — everything visible sits inside the child below.
			onClick={(event) => {
				if (event.target === dialogRef.current) {
					onClose();
				}
			}}
			// `m-auto` is not decoration: the browser centres a modal dialog by
			// giving it `margin: auto` against `inset: 0`, and Tailwind's
			// Preflight resets `margin` to 0 on everything — which drops it into
			// the top-left corner. This puts the centering back.
			// max-h/overflow keep a long form scrollable instead of overflowing
			// the viewport.
			className="bg-blue-spruce-950 text-metallic-gold-50 m-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-400 p-0 backdrop:bg-black/60"
		>
			<div className="flex flex-col gap-4 p-5 text-left">
				<div className="flex flex-row items-center justify-between">
					<h2 className="text-lg font-medium">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="cursor-pointer px-2 text-xl leading-none"
					>
						×
					</button>
				</div>
				{children}
			</div>
		</dialog>
	);
};
