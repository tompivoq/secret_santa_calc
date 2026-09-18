import { useMemo, useState } from "react";
import type { Person } from "../models/person";
import { useGetPeopleQuery, useRemovePersonMutation } from "../store/peopleApi";
import EditPersonForm from "./EditPersonForm";
import { Modal } from "./shared/Modal";
import { reject } from "lodash-es";
import { ListPerson } from "./ListPerson";

const NO_PEOPLE: Person[] = [];

interface PersonListProps {
	/** Ids of people currently selected for the next match run. */
	selectedIds: Set<number>;
	onToggleSelected: (personId: number) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
}

export const PersonList = ({
	selectedIds,
	onToggleSelected,
	onSelectAll,
	onSelectNone,
}: PersonListProps) => {
	const { data } = useGetPeopleQuery();
	const people = data ?? NO_PEOPLE;
	const [removePerson] = useRemovePersonMutation();
	// Which person's edit dialog is open, by id rather than by value — so it
	// keeps showing the freshly-saved person rather than a stale copy taken
	// when the dialog was opened.
	const [editingId, setEditingId] = useState<number | null>(null);

	const othersById = useMemo(
		() => new Map(people.map((person) => [person.id, reject(people, { id: person.id })])),
		[people],
	);

	const editing = people.find((person) => person.id === editingId);

	if (people.length === 0) {
		return null;
	}

	return (
		<div className="mt-4 flex flex-col border-t p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-left text-lg">Nuværende brugere/deltagere</h3>
				<div className="flex items-center gap-3 text-sm">
					<span>
						{selectedIds.size} af {people.length} valgt
					</span>
					<button type="button" onClick={onSelectAll} className="underline hover:no-underline">
						Vælg alle
					</button>
					<button type="button" onClick={onSelectNone} className="underline hover:no-underline">
						Vælg ingen
					</button>
				</div>
			</div>
			<ul className="mt-2 flex flex-col gap-3 text-left">
				{people.map((person) => (
					<ListPerson
						key={person.id}
						person={person}
						others={othersById.get(person.id) ?? []}
						selected={selectedIds.has(person.id)}
						onToggleSelected={() => onToggleSelected(person.id)}
						onEdit={() => setEditingId(person.id)}
						onDelete={() => removePerson(person.id)}
					/>
				))}
			</ul>

			{editing && (
				<Modal open onClose={() => setEditingId(null)} title={`Edit ${editing.name}`}>
					<EditPersonForm
						person={editing}
						others={othersById.get(editing.id) ?? []}
						onDone={() => setEditingId(null)}
					/>
				</Modal>
			)}
		</div>
	);
};
