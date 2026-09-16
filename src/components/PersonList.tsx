import { useMemo, useState } from "react";
import type { Person } from "../models/person";
import { useGetPeopleQuery, useRemovePersonMutation } from "../store/peopleApi";
import EditPersonForm from "./EditPersonForm";
import { Modal } from "./shared/Modal";
import { findPartner } from "../utils/person_utils";
import { reject } from "lodash-es";
import { Button } from "./shared/Button";
import { FaPen, FaRegTrashCan } from "react-icons/fa6";

/** One read-only "Label: value" pair, for the details the edit form owns. */
const Detail = ({ label, value }: { label: string; value: string }) => (
	<p className="flex flex-row gap-1 text-sm">
		<span className="font-semibold">{label}</span>
		<span>{value}</span>
	</p>
);

interface ListPersonProps {
	person: Person;
	others: Person[];
	selected: boolean;
	onToggleSelected: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

const ListPerson = ({
	person,
	others,
	selected,
	onToggleSelected,
	onEdit,
	onDelete,
}: ListPersonProps) => {
	const [pendingDelete, setPendingDelete] = useState(false);
	const partner = findPartner(others, person);
	const lastYearRecipient = others.find((other) => other.id === person.lastYearRecipientId);
	return (
		<li
			key={person.id}
			className="border-blue-spruce-400 flex flex-row gap-3 rounded-xl border p-4 sm:items-center sm:justify-between"
		>
			<div className="flex grow flex-col gap-2">
				<div className="flex flex-col items-baseline sm:flex-row">
					<div className="flex grow flex-row items-center">
						<input
							type="checkbox"
							aria-label={`Include ${person.name} in the next match`}
							title={`Include ${person.name} in the next match`}
							checked={selected}
							onChange={onToggleSelected}
							className="mr-3 size-4"
						/>
						<p className="text-lg font-medium">{person.name}</p>
					</div>
					<p className="flex flex-row gap-2 pl-3 text-base sm:pl-0">
						<span>{person.email}</span>
						<span>{person.phone}</span>
					</p>
				</div>
				<div className="flex w-full flex-wrap items-center gap-4 pl-3 sm:pl-0">
					<Detail label="Partner:" value={partner?.name ?? "None"} />
					<Detail label="Last year:" value={lastYearRecipient?.name ?? "None"} />
				</div>
				<div className="flex flex-row justify-end gap-2">
					{pendingDelete === true ? (
						<div className="flex items-center gap-2">
							<span className="text-sm">Delete {person.name}?</span>
							<Button behaviour="destructive" onClick={onDelete}>
								Confirm
							</Button>
							<Button behaviour="neutral" onClick={() => setPendingDelete(false)}>
								Cancel
							</Button>
						</div>
					) : (
						<>
							<Button behaviour="neutral" onClick={onEdit}>
								<FaPen className="size-3" />
								<span>Edit</span>
							</Button>
							<Button behaviour="destructive" onClick={() => setPendingDelete(true)}>
								<FaRegTrashCan className="size-3" />
								<span>Delete</span>
							</Button>
						</>
					)}
				</div>
			</div>
		</li>
	);
};

const NO_PEOPLE: Person[] = [];

interface PersonListProps {
	/** Ids of people currently selected for the next match run. */
	selectedIds: Set<number>;
	onToggleSelected: (personId: number) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
}

function PersonList({ selectedIds, onToggleSelected, onSelectAll, onSelectNone }: PersonListProps) {
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
		<div className="border-t-metallic-gold-400 mt-4 flex flex-col border-t p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-left text-lg">Currently added people</h3>
				<div className="flex items-center gap-3 text-sm">
					<span>
						{selectedIds.size} of {people.length} selected
					</span>
					<button type="button" onClick={onSelectAll} className="underline hover:no-underline">
						Select all
					</button>
					<button type="button" onClick={onSelectNone} className="underline hover:no-underline">
						Select none
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
}

export default PersonList;
