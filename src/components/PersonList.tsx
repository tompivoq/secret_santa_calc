import { useMemo, useState } from "react";
import type { Person } from "../models/person";
import {
	useGetPeopleQuery,
	useRemovePersonMutation,
	useSetLastYearRecipientMutation,
	useSetPartnerMutation,
} from "../store/peopleApi";
import { findPartner } from "../utils/person_utils";
import { reject } from "lodash-es";
import { Button } from "./shared/Button";
import { FaRegTrashCan } from "react-icons/fa6";

interface PersonSelectProps {
	id: string;
	label: string;
	value: number | null | undefined;
	options: Person[];
	onChange: (personId: number | null) => void;
}

/** A "pick one of the other people, or nobody" dropdown — partner, last year's match. */
const PersonSelect = ({ id, label, value, options, onChange }: PersonSelectProps) => (
	<div className="flex flex-row items-center">
		<label htmlFor={id} className="min-w-fit text-sm font-semibold">
			{label}
		</label>
		<select
			id={id}
			value={value ?? ""}
			onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
			className="border-border-blue-spruce-400 mx-2 w-32 rounded-md border px-2.5 py-2 text-sm"
		>
			<option value="">None</option>
			{options.map((p) => (
				<option key={p.id} value={p.id}>
					{p.name}
				</option>
			))}
		</select>
	</div>
);

interface ListPersonProps {
	person: Person;
	others: Person[];
	selected: boolean;
	onToggleSelected: () => void;
	onSetPartner: (personId: number, partnerId: number | null) => void;
	onSetLastYear: (personId: number, lastYearRecipientId: number | null) => void;
	onDelete: () => void;
}

const ListPerson = ({
	person,
	others,
	selected,
	onToggleSelected,
	onSetPartner,
	onSetLastYear,
	onDelete,
}: ListPersonProps) => {
	const [pendingDelete, setPendingDelete] = useState(false);
	const partner = findPartner(others, person);
	return (
		<li
			key={person.id}
			className="border-blue-spruce-400 flex flex-row gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div className="flex grow flex-col">
				<div className="mb-2 flex flex-row items-baseline">
					<input
						type="checkbox"
						aria-label={`Include ${person.name} in the next match`}
						title={`Include ${person.name} in the next match`}
						checked={selected}
						onChange={onToggleSelected}
						className="mr-3 size-4"
					/>
					<p className="grow text-lg font-medium">{person.name}</p>
					<p className="text-base">
						{person.email} | {person.phone}
					</p>
				</div>
				<div className="flex w-full flex-row items-center justify-center gap-2">
					<PersonSelect
						id={`partner-${person.id}`}
						label="Partner"
						value={partner?.id}
						options={others}
						onChange={(partnerId) => onSetPartner(person.id, partnerId)}
					/>
					<PersonSelect
						id={`last-year-${person.id}`}
						label="Last year"
						value={person.lastYearRecipientId}
						options={others}
						onChange={(recipientId) => onSetLastYear(person.id, recipientId)}
					/>
				</div>
				<div className="flex flex-row justify-end">
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
						<Button behaviour="destructive" onClick={() => setPendingDelete(true)}>
							<FaRegTrashCan className="size-3" />
							<span>Delete</span>
						</Button>
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
	const [setPartner] = useSetPartnerMutation();
	const [setLastYearRecipient] = useSetLastYearRecipientMutation();

	const othersById = useMemo(
		() => new Map(people.map((person) => [person.id, reject(people, { id: person.id })])),
		[people],
	);

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
						onDelete={() => removePerson(person.id)}
						onSetPartner={(personId, partnerId) => setPartner({ personId, partnerId })}
						onSetLastYear={(personId, lastYearRecipientId) =>
							setLastYearRecipient({ personId, lastYearRecipientId })
						}
					/>
				))}
			</ul>
		</div>
	);
}

export default PersonList;
