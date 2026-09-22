import { useState } from "react";
import { useMeQuery } from "../store/authApi";
import { useMyMatchQuery } from "../store/matcherApi";
import ChangePasswordForm from "../components/ChangePasswordForm";
import EditMyDetailsForm from "../components/account/EditMyDetailsForm";
import { Messages } from "../components/account/messages/";
import { Notes } from "../components/account/notes";
import { Button, Modal } from "../components/shared";
import { FaPencil } from "react-icons/fa6";

/** One read-only "Label / value" row of someone's own details. */
const Detail = ({ label, value }: { label: string; value: string }) => (
	<div className="flex w-60 flex-row justify-between gap-4">
		<span className="text-sm font-semibold">{label}</span>
		<span className="text-sm">{value}</span>
	</div>
);

/** Which dialog, if any, is open. */
type OpenDialog = "details" | "password" | null;

/**
 * Reached only once RequireAuth (in App.tsx) has confirmed both that
 * someone is logged in and that they're past the forced first-login
 * password change — this doesn't re-check either itself.
 */
function AccountPage() {
	const { data } = useMeQuery();
	// Only ever this person's own match, and only once the draw is locked in
	// — the server decides both; see the matcher routes.
	const { data: match, isLoading } = useMyMatchQuery();
	const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

	if (!data) {
		return null;
	}

	const { person } = data;

	return (
		<div className="mt-8 flex flex-col items-stretch gap-4 text-left">
			<div className="rounded-xl border p-5 text-center">
				{isLoading ? (
					<p>Finder dit match...</p>
				) : match?.recipient ? (
					<>
						<p className="text-sm">Du skal give en gave til:</p>
						<p className="text-brand mt-1 text-2xl font-medium">{match.recipient.name}</p>
					</>
				) : (
					<p>
						Nisserne har ikke trukket lod endnu.
						<br />
						Kom tilbage efter lodtrækningen for at se hvem du skal give en gave til i år.
					</p>
				)}
			</div>

			<Messages />

			<Notes />

			<section
				aria-labelledby="my-details-heading"
				className="flex flex-col gap-3 rounded-xl border p-5"
			>
				<div className="flex flex-row items-center gap-2">
					<h2 id="my-details-heading" className="text-lg">
						Dine info
					</h2>
					<button
						type="button"
						onClick={() => setOpenDialog("details")}
						aria-label="Rediger din info"
						title="Rediger din info"
						className="text-accent-light hover:text-accent cursor-pointer"
					>
						<FaPencil className="size-4" aria-hidden />
					</button>
				</div>
				<Detail label="Navn" value={person.name} />
				<Detail label="E-mail" value={person.email} />
				<Detail label="Telefon" value={String(person.phone)} />
				{/* Partner and last year's recipient aren't here on purpose —
				    they decide who you can be matched with, so they belong to
				    whoever runs the draw. */}
				<div className="flex flex-row justify-end gap-2">
					<Button behaviour="neutral" onClick={() => setOpenDialog("password")}>
						Ændre password
					</Button>
				</div>
			</section>

			{openDialog === "details" && (
				<Modal open onClose={() => setOpenDialog(null)} title="Rediger din info">
					<EditMyDetailsForm person={person} onDone={() => setOpenDialog(null)} />
				</Modal>
			)}

			{openDialog === "password" && (
				<Modal open onClose={() => setOpenDialog(null)} title="Ændre dit password">
					<ChangePasswordForm
						intro="Vælg et nyt password. Du skal bruge dit gamle for at ændre det."
						onSuccess={() => setOpenDialog(null)}
					/>
				</Modal>
			)}
		</div>
	);
}

export default AccountPage;
