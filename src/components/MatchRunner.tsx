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
import { SendOutcome } from "./shared/SendOutcome";

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
			return "Ingen gyldig lodtrækning fundet for de valgte deltagere. Er der nogen hvis eneste mulige modtager er deres egen partner?";
		case 409:
			return "Lodtrækningen er allerede låst fast. Start en ny for at ændre den.";
		default:
			return "Noget gik galt under lodtrækningen. Prøv venligst igen";
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
					<span className="font-medium">{draw.participantIds.length} deltagere</span> blev matched:{" "}
					{draw.participantIds.map((id) => nameById.get(id) ?? "Ukendt").join(", ")}.
				</p>
				<p className="text-gray-600 dark:text-gray-400">
					Resultatet vil være skjult, også fra dig så din egen match er en overraskelse.
				</p>
			</div>
		);
	}

	return (
		<ul className="flex flex-col gap-1 text-sm">
			{draw.assignments.map((assignment) => (
				<li key={assignment.id}>
					<span className="font-medium">{nameById.get(assignment.giverId) ?? "Ukendt"}</span> →{" "}
					{nameById.get(assignment.recipientId) ?? "Ukendt"}
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
		<div className="flex flex-col gap-2 border-t pt-3">
			<p className="text-sm">
				{draw.notifiedIds.length} ud af {draw.participantIds.length} har fået besked.
			</p>

			{waiting.length > 0 ? (
				<div>
					<Button
						type="button"
						behaviour="action"
						disabled={isLoading}
						onClick={() => void notify({})}
					>
						{isLoading ? "Sender…" : `Send email til de ${waiting.length} der stadig venter`}
					</Button>
					<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Mangler stadig besked: {waiting.map((id) => nameById.get(id) ?? "Ukendt").join(", ")}.
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
						{isLoading ? "Sender…" : "Send alle deres link igen"}
					</Button>
					<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Alle har fået tilsendt mail. Gensendelse udsteder friske links, og invaliderer de gamle.
					</p>
				</div>
			)}

			<SendOutcome sent={result?.notified} failed={result?.failed} hasError={!!error} />
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
		<div className="mt-4 flex flex-col gap-3 border-t p-4 text-left">
			<h3 className="text-lg">Kør lodtrækningen</h3>

			{isLocked ? (
				<p className="text-sm">
					Låst fast d. {new Date(currentDraw.lockedAt!).toLocaleDateString("da")}. Alle kan se deres
					egen match!
				</p>
			) : (
				<p className="text-sm">
					Intet er endeligt før du låser lodtrækningen fast. Genkør så mange gange du vil.
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
						Test-kørsel
					</label>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						{testRun
							? "Parringer vil blive vist, inklusiv din egen. Fjern afkrydsning for at udføre den endelige lodtrækning."
							: "Endelig lodtrækning!"}
					</p>

					<div>
						<Button
							type="button"
							behaviour="action"
							disabled={selectedCount < 2 || isDrafting}
							onClick={() => runDraft()}
							name="Run match"
						>
							{isDrafting
								? "Trækker lod..."
								: currentDraw
									? `Re-roll (${selectedCount} valgt)`
									: `Kør lodtrækning (${selectedCount} valgt)`}
						</Button>
						{selectedCount < 2 && (
							<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Vælg mindst to deltagere for at køre en lodtrækning
							</p>
						)}
					</div>
				</div>
			)}

			{draftError && (
				<p className="text-sm text-error dark:text-red-400">{draftErrorMessage(draftError)}</p>
			)}
			{lockError && (
				<p className="text-sm text-error dark:text-red-400">
					Kunne ikke låse lodtrækningen. Prøv venligst igen.
				</p>
			)}

			{draftResult?.repeatedLastYear && (
				<p className="text-sm">
					Kunne ikke undgå sidste års parringer for alle i gruppen, så nogen er gentaget.
				</p>
			)}

			{currentDraw && (
				<div className="bg-bg-elevated flex flex-col gap-3 rounded-xl border p-4">
					{isStale && (
						<p className="text-sm">
							Valgte deltagere er ændret siden sidste trækning. Kør igen for at opdatere.
						</p>
					)}

					<DrawSummary draw={currentDraw} nameById={nameById} />

					{isLocked && <NotifyPanel draw={currentDraw} nameById={nameById} />}

					{isLocked ? (
						confirmingStartOver ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-sm">
									Start en ny trækning? Alles match vil ændres, også selvom de allerede har set den.
								</span>
								<Button type="button" behaviour="destructive" onClick={() => runDraft(true)}>
									Start forfra
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
								Start en ny trækning
							</Button>
						)
					) : (
						<Button
							type="button"
							behaviour="action"
							disabled={isLocking}
							onClick={() => void lockDraw()}
						>
							{isLocking ? "Låser…" : "Lås denne trækning"}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

export default MatchRunner;
