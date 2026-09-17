import { useState } from "react";
import { FaPen, FaRegTrashCan } from "react-icons/fa6";
import type { Person } from "../models/person";
import { findPartner } from "../utils/person_utils";
import { Button } from "./shared/Button";

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

export const ListPerson = ({
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
							aria-label={`Inkluder ${person.name} i næste lodtrækning`}
							title={`Inkluder ${person.name} i næste lodtrækning`}
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
					<Detail label="Partner:" value={partner?.name ?? "Ingen"} />
					<Detail label="Sidste år:" value={lastYearRecipient?.name ?? "Ingen"} />
				</div>
				<div className="flex flex-row justify-end gap-2">
					{pendingDelete === true ? (
						<div className="flex items-center gap-2">
							<span className="text-sm">Slet {person.name}?</span>
							<Button behaviour="neutral" onClick={() => setPendingDelete(false)}>
								Cancel
							</Button>
							<Button behaviour="destructive" onClick={onDelete}>
								Bekræft
							</Button>
						</div>
					) : (
						<>
							<Button behaviour="neutral" onClick={onEdit}>
								<FaPen className="size-3" />
								<span>Rediger</span>
							</Button>
							<Button behaviour="destructive" onClick={() => setPendingDelete(true)}>
								<FaRegTrashCan className="size-3" />
								<span>Slet</span>
							</Button>
						</>
					)}
				</div>
			</div>
		</li>
	);
};
