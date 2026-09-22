import { lazy, Suspense } from "react";
import { useNoteQuery } from "../../../store/notesApi";
import { Button } from "../../shared";

// The editor is by far the largest thing on the page, so it's fetched only
// once this section is shown rather than bundled with the rest of the app.
const NotesEditor = lazy(() => import("./NotesEditor"));

/**
 * The person's private notepad, on the account page so their match and
 * their questions stay in view while writing. Available before the draw
 * as well as after.
 */
export const Notes = () => {
	// Fresh on every visit, so a note saved on another device is what the
	// editor starts from — the editor itself only reads this once.
	const {
		data: note,
		isFetching,
		isError,
		refetch,
	} = useNoteQuery(undefined, {
		refetchOnMountOrArgChange: true,
	});

	return (
		<section aria-labelledby="notes-heading" className="flex flex-col gap-3 rounded-xl border p-5">
			<div>
				<h2 id="notes-heading" className="text-lg">
					Mine noter
				</h2>
				<p className="text-text-muted text-sm">
					Kun du kan se dine noter. De gemmes automatisk, mens du skriver.
				</p>
			</div>

			{isError ? (
				<div className="text-error flex flex-row flex-wrap items-center gap-2 text-sm">
					<span>Kunne ikke hente dine noter.</span>
					<Button behaviour="neutral" onClick={() => void refetch()}>
						Prøv igen
					</Button>
				</div>
			) : !note || isFetching ? (
				<p className="text-text-muted text-sm">Henter dine noter…</p>
			) : (
				<Suspense fallback={<p className="text-text-muted text-sm">Henter editor…</p>}>
					<NotesEditor note={note} />
				</Suspense>
			)}
		</section>
	);
};
