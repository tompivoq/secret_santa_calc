import { useState } from "react";
import { useGetPeopleQuery } from "../store/peopleApi";
import {
	useCurrentDrawQuery,
	useDraftMutation,
	useLockDrawMutation,
	useNotifyMutation,
	type Draw,
} from "../store/matcherApi";
import { Button } from "./shared/Button";

interface MatchRunnerProps {
	selectedIds: Set<number>;
}

/** Narrows RTK Query's opaque mutation error down to "the server returned this HTTP status". */
const errorStatus = (error: unknown): number | undefined =>
	typeof error === "object" &&
	error !== null &&
	"status" in error &&
	typeof error.status === "number"
		? error.status
		: undefined;

const draftErrorMessage = (error: unknown): string => {
	switch (errorStatus(error)) {
		case 422:
			return "No valid match exists for the selected people — check that no one's only possible recipient is their partner.";
		case 409:
			return "The draw is already locked in. Start a new draw to change it.";
		default:
			return "Something went wrong running the match. Please try again.";
	}
};

/**
 * What was drawn. For a blind draw that's deliberately only who took part
 * — the server doesn't send the pairings, so there's nothing to show even
 * if this wanted to.
 */
const DrawSummary = ({ draw, nameById }: { draw: Draw; nameById: Map<number, string> }) => {
	if (!draw.assignments) {
		return (
			<div className="flex flex-col gap-1 text-sm">
				<p>
					<span className="font-medium">{draw.participantIds.length} people</span> were matched:{" "}
					{draw.participantIds.map((id) => nameById.get(id) ?? "Unknown").join(", ")}.
				</p>
				<p className="text-gray-600 dark:text-gray-400">
					Who drew whom is hidden — including from you, so your own match stays a surprise.
				</p>
			</div>
		);
	}

	return (
		<ul className="flex flex-col gap-1 text-sm">
			{draw.assignments.map((assignment) => (
				<li key={assignment.id}>
					<span className="font-medium">{nameById.get(assignment.giverId) ?? "Unknown"}</span> →{" "}
					{nameById.get(assignment.recipientId) ?? "Unknown"}
				</li>
			))}
		</ul>
	);
};

/**
 * Emailing everyone their login link. Only shown for a locked draw —
 * there's deliberately no way to tell anyone about a draft.
 */
const NotifyPanel = ({ draw, nameById }: { draw: Draw; nameById: Map<number, string> }) => {
	const [notify, { data: result, error, isLoading }] = useNotifyMutation();

	const waiting = draw.participantIds.filter((id) => !draw.notifiedIds.includes(id));

	return (
		<div className="border-blue-spruce-400 flex flex-col gap-2 border-t pt-3">
			<p className="text-sm">
				{draw.notifiedIds.length} of {draw.participantIds.length} have been emailed their link.
			</p>

			{waiting.length > 0 ? (
				<div>
					<Button
						type="button"
						behaviour="action"
						disabled={isLoading}
						onClick={() => void notify({})}
					>
						{isLoading ? "Sending…" : `Email the ${waiting.length} still waiting`}
					</Button>
					<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Still to hear: {waiting.map((id) => nameById.get(id) ?? "Unknown").join(", ")}.
					</p>
				</div>
			) : (
				<div>
					<Button
						type="button"
						behaviour="neutral"
						disabled={isLoading}
						onClick={() => void notify({ personIds: draw.participantIds })}
					>
						{isLoading ? "Sending…" : "Send everyone their link again"}
					</Button>
					<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Everyone has been emailed. Sending again issues fresh links and retires the old ones.
					</p>
				</div>
			)}

			{error && (
				<p className="text-sm text-red-600 dark:text-red-400">
					Couldn't send the emails. Please try again.
				</p>
			)}

			{result && result.notified.length > 0 && (
				<p className="text-sm">
					Emailed {result.notified.map((person) => person.name).join(", ")}.
				</p>
			)}

			{result && result.failed.length > 0 && (
				<div className="text-sm text-red-600 dark:text-red-400">
					{/* Named individually: the admin has to know who to chase, and a
					    count alone wouldn't tell them. */}
					<p>These couldn't be emailed — they'll be retried next time:</p>
					<ul className="mt-1 flex flex-col gap-1">
						{result.failed.map((person) => (
							<li key={person.personId}>
								{person.name} — {person.error}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};

function MatchRunner({ selectedIds }: MatchRunnerProps) {
	const { data: people } = useGetPeopleQuery();
	const { data: currentDraw } = useCurrentDrawQuery();
	const [draft, { error: draftError, isLoading: isDrafting, data: draftResult }] =
		useDraftMutation();
	const [lockDraw, { error: lockError, isLoading: isLocking }] = useLockDrawMutation();
	const [confirmingStartOver, setConfirmingStartOver] = useState(false);
	// Defaults to a test run, which shows the pairings — the common case is
	// trying a group out. Unticking it is what makes a draw the real one,
	// hidden from the admin as well so their own match stays a surprise.
	const [testRun, setTestRun] = useState(true);

	const nameById = new Map((people ?? []).map((person) => [person.id, person.name]));
	const selectedCount = selectedIds.size;
	const isLocked = currentDraw?.lockedAt != null;

	const runDraft = (startOver?: boolean) => {
		setConfirmingStartOver(false);
		void draft({ personIds: [...selectedIds], blind: !testRun, ...(startOver && { startOver }) });
	};

	// Only meaningful for a draft: a locked draw is history, so the fact that
	// the admin has since ticked a different set of boxes says nothing about it.
	const isStale =
		currentDraw !== null &&
		currentDraw !== undefined &&
		!isLocked &&
		(currentDraw.participantIds.length !== selectedCount ||
			currentDraw.participantIds.some((id) => !selectedIds.has(id)));

	return (
		<div className="border-t-metallic-gold-400 mt-4 flex flex-col gap-3 border-t p-4 text-left">
			<h3 className="text-lg">Run the match</h3>

			{isLocked ? (
				<p className="text-sm">
					Locked in on {new Date(currentDraw.lockedAt!).toLocaleDateString()}. Everyone can see
					their own match.
				</p>
			) : (
				<p className="text-sm">
					Nothing is final until you lock it in — re-roll as many times as you like.
				</p>
			)}

			{!isLocked && (
				<div className="flex flex-col gap-2">
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={testRun}
							onChange={(event) => setTestRun(event.target.checked)}
							className="size-4 shrink-0"
						/>
						Test-run (show matches when done)
					</label>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						{testRun
							? "You'll see everyone's match, including your own. Untick it for the real draw."
							: "The real draw — nobody sees who drew whom, you included, so your own match stays a surprise."}
					</p>

					<div>
						<Button
							type="button"
							behaviour="action"
							disabled={selectedCount < 2 || isDrafting}
							onClick={() => runDraft()}
						>
							{isDrafting
								? "Matching…"
								: currentDraw
									? `Re-roll (${selectedCount} selected)`
									: `Run match (${selectedCount} selected)`}
						</Button>
						{selectedCount < 2 && (
							<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Select at least 2 people to run a match.
							</p>
						)}
					</div>
				</div>
			)}

			{draftError && (
				<p className="text-sm text-red-600 dark:text-red-400">{draftErrorMessage(draftError)}</p>
			)}
			{lockError && (
				<p className="text-sm text-red-600 dark:text-red-400">
					Couldn't lock the draw in. Please try again.
				</p>
			)}

			{draftResult?.repeatedLastYear && (
				<p className="text-sm text-gray-600 dark:text-gray-400">
					Couldn't avoid last year's pairings for everyone in this group, so some are repeated.
				</p>
			)}

			{currentDraw && (
				<div className="border-blue-spruce-400 flex flex-col gap-3 rounded-xl border p-4">
					{isStale && (
						<p className="text-sm text-gray-600 dark:text-gray-400">
							Selection has changed since this was drawn — re-roll to update it.
						</p>
					)}

					<DrawSummary draw={currentDraw} nameById={nameById} />

					{isLocked && <NotifyPanel draw={currentDraw} nameById={nameById} />}

					{isLocked ? (
						confirmingStartOver ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-sm">
									Start a new draw? Everyone's match will change, including any they've already
									seen.
								</span>
								<Button type="button" behaviour="destructive" onClick={() => runDraft(true)}>
									Start over
								</Button>
								<Button
									type="button"
									behaviour="neutral"
									onClick={() => setConfirmingStartOver(false)}
								>
									Cancel
								</Button>
							</div>
						) : (
							<Button
								type="button"
								behaviour="neutral"
								onClick={() => setConfirmingStartOver(true)}
							>
								Start a new draw
							</Button>
						)
					) : (
						<Button
							type="button"
							behaviour="action"
							disabled={isLocking}
							onClick={() => void lockDraw()}
						>
							{isLocking ? "Locking in…" : "Lock in this match"}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

export default MatchRunner;
