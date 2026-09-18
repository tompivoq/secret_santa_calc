import type { Person } from "../models/person";
import { useGetPeopleQuery, useInvitePeopleMutation } from "../store/peopleApi";
import { Button } from "./shared/Button";
import { SendOutcome } from "./shared/SendOutcome";

const NO_PEOPLE: Person[] = [];

const names = (people: Person[]) => people.map((person) => person.name).join(", ");

/**
 * Inviting people into the app ahead of the draw — a login link, so they
 * can get in and choose a password before there's anything riding on it.
 * Independent of the draw entirely: it can be used before one exists, and
 * nothing about it changes when one is made.
 */
function InvitePanel() {
	const { data } = useGetPeopleQuery();
	const people = data ?? NO_PEOPLE;
	const [invite, { data: result, error, isLoading }] = useInvitePeopleMutation();

	const loggedIn = people.filter((person) => person.hasChosenPassword);
	// Same rule the server applies when no one is named — see people/invite.ts.
	const awaiting = people.filter((person) => !person.hasChosenPassword && !person.invitedAt);
	const invitedNotIn = people.filter((person) => !person.hasChosenPassword && person.invitedAt);

	return (
		<div className="mt-4 flex flex-col gap-3 border-t p-4 text-left">
			<h3 className="text-lg">Invitationer</h3>
			<p className="text-sm">
				{loggedIn.length} ud af {people.length} har logget ind og valgt deres egen adgangskode.
			</p>

			{awaiting.length > 0 ? (
				<div>
					<Button
						type="button"
						behaviour="action"
						disabled={isLoading}
						onClick={() => void invite({})}
					>
						{isLoading ? "Sender…" : `Send invitation til de ${awaiting.length} der mangler`}
					</Button>
					<p className="text-text-muted mt-1 text-sm">Mangler invitation: {names(awaiting)}.</p>
				</div>
			) : (
				<p className="text-text-muted text-sm">Alle er inviteret eller har allerede logget ind.</p>
			)}

			{invitedNotIn.length > 0 && (
				<div>
					<Button
						type="button"
						behaviour="neutral"
						disabled={isLoading}
						onClick={() => void invite({ personIds: invitedNotIn.map((person) => person.id) })}
					>
						{isLoading
							? "Sender…"
							: `Send igen til de ${invitedNotIn.length} der ikke har logget ind`}
					</Button>
					<p className="text-text-muted mt-1 text-sm">
						Inviteret, men ikke logget ind endnu: {names(invitedNotIn)}. Gensendelse udsteder friske
						links, og invaliderer de gamle.
					</p>
				</div>
			)}

			<SendOutcome sent={result?.invited} failed={result?.failed} hasError={!!error} />
		</div>
	);
}

export default InvitePanel;
