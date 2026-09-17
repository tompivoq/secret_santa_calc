import { useMemo, useState } from "react";
import PersonForm from "../components/PersonForm";
import MatchRunner from "../components/MatchRunner";
import { useGetPeopleQuery } from "../store/peopleApi";
import { FaChevronRight } from "react-icons/fa6";
import { PersonList } from "../components/PersonList";

function AdminPage() {
	const [formOpen, setFormOpen] = useState(false);

	// Also queried (and cached) inside PersonList/MatchRunner — RTK Query
	// dedupes identical in-flight queries, so this doesn't add a request.
	// Needed here only to know the full set of ids for "select all"/"select
	// none" and to default a fresh selection to "everyone".
	const { data: people } = useGetPeopleQuery();
	const allIds = useMemo(() => (people ?? []).map((person) => person.id), [people]);

	// null means "no explicit choice yet" — selection defaults to everyone
	// currently in the list, so newly added people are included until the
	// admin actually deselects something. Once they make any explicit
	// choice (including "select all"), it's pinned to that set instead.
	const [explicitSelection, setExplicitSelection] = useState<Set<number> | null>(null);
	const selectedIds = explicitSelection ?? new Set(allIds);

	const toggleSelected = (personId: number) => {
		const next = new Set(selectedIds);
		if (next.has(personId)) {
			next.delete(personId);
		} else {
			next.add(personId);
		}
		setExplicitSelection(next);
	};

	return (
		<>
			<div className="flex h-fit flex-col rounded-xl border border-gray-400">
				<div
					className="flex cursor-pointer flex-row items-center rounded-t-xl border p-5"
					onClick={() => setFormOpen((prev) => !prev)}
				>
					<FaChevronRight
						data-active={formOpen}
						className="mr-2 size-3 transition-transform duration-300 ease-in-out data-[active=true]:rotate-90"
					/>
					<h3 className="flex grow text-lg">Tilføj person</h3>
				</div>
				{formOpen && <PersonForm />}
			</div>

			<PersonList
				selectedIds={selectedIds}
				onToggleSelected={toggleSelected}
				onSelectAll={() => setExplicitSelection(new Set(allIds))}
				onSelectNone={() => setExplicitSelection(new Set())}
			/>

			{allIds.length > 0 && <MatchRunner selectedIds={selectedIds} />}
		</>
	);
}

export default AdminPage;
