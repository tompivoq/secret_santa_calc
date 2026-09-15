import { useGetPeopleQuery } from "../store/peopleApi";
import { useRunMatchMutation } from "../store/matcherApi";
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

function MatchRunner({ selectedIds }: MatchRunnerProps) {
	const { data: people } = useGetPeopleQuery();
	const [runMatch, { data: result, error, isLoading }] = useRunMatchMutation();

	const nameById = new Map((people ?? []).map((person) => [person.id, person.name]));
	const selectedCount = selectedIds.size;
	// The staged assignment stays on screen after a selection change (rather
	// than disappearing) so it's still there to compare against — this flags
	// that it no longer reflects who's currently selected.
	const isStale =
		result !== undefined &&
		(result.length !== selectedCount || result.some((person) => !selectedIds.has(person.id)));

	return (
		<div className="border-t-metallic-gold-400 mt-4 flex flex-col gap-3 border-t p-4 text-left">
			<h3 className="text-lg">Run the match</h3>
			<p className="text-sm">
				Preview only — nothing is saved and no one is notified. Re-run as many times as you like.
			</p>

			<div>
				<Button
					type="button"
					behaviour="action"
					disabled={selectedCount < 2 || isLoading}
					onClick={() => void runMatch([...selectedIds])}
				>
					{isLoading ? "Matching…" : `Preview match (${selectedCount} selected)`}
				</Button>
				{selectedCount < 2 && (
					<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Select at least 2 people to run a match.
					</p>
				)}
			</div>

			{error && (
				<p className="text-sm text-red-600 dark:text-red-400">
					{errorStatus(error) === 422
						? "No valid match exists for the selected people — check that no one's only possible recipient is their partner."
						: "Something went wrong running the match. Please try again."}
				</p>
			)}

			{result && (
				<div className="border-blue-spruce-400 rounded-xl border p-4">
					{isStale && (
						<p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
							Selection has changed since this preview ran — re-run to update it.
						</p>
					)}
					<ul className="flex flex-col gap-1 text-sm">
						{result.map((person) => (
							<li key={person.id}>
								<span className="font-medium">{person.name}</span> →{" "}
								{person.currentTarget !== null
									? (nameById.get(person.currentTarget) ?? "Unknown")
									: "—"}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

export default MatchRunner;
