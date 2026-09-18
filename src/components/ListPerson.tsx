import { useState } from "react";
import { FaEnvelope, FaPen, FaRegTrashCan } from "react-icons/fa6";
import type { Person } from "../models/person";
import { useInvitePeopleMutation } from "../store/peopleApi";
import { findPartner } from "../utils/person_utils";
import { Button } from "./shared/Button";

/** Furthest along wins: someone who has logged in no longer cares when they were invited. */
const loginStatus = (person: Person): string => {
	if (person.hasChosenPassword) {
		return "Logget ind";
	}
	if (person.invitedAt) {
		return `Inviteret d. ${new Date(person.invitedAt).toLocaleDateString("da")}`;
	}
	return "Ikke inviteret";
};

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
	const [invite, { data: inviteResult, error: inviteError, isLoading: isInviting }] =
		useInvitePeopleMutation();
	const partner = findPartner(others, person);
	const lastYearRecipient = others.find((other) => other.id === person.lastYearRecipientId);
	const inviteFailure = inviteError ? "Kunne ikke sende" : inviteResult?.failed[0]?.error;
	return (
		<li
			key={person.id}
			className="bg-bg-elevated flex flex-row gap-3 rounded-xl border p-4 sm:items-center sm:justify-between"
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
					<Detail label="Login:" value={loginStatus(person)} />
				</div>
				{inviteFailure && (
					<p className="text-error pl-3 text-sm sm:pl-0">
						Invitationen blev ikke sendt: {inviteFailure}
					</p>
				)}
				{inviteResult && inviteResult.invited.length > 0 && (
					<p className="pl-3 text-sm sm:pl-0">Invitation sendt.</p>
				)}
				<div className="flex flex-row flex-wrap justify-end gap-2">
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
							{/* Always offered, even to someone already in: a fresh link is
							    also how a person who has forgotten their password gets back. */}
							<Button
								behaviour="neutral"
								disabled={isInviting}
								onClick={() => void invite({ personIds: [person.id] })}
							>
								<FaEnvelope className="size-3" />
								<span>
									{isInviting ? "Sender…" : person.invitedAt ? "Inviter igen" : "Inviter"}
								</span>
							</Button>
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
