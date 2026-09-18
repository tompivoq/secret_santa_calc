import { useState } from "react";
import { useMeQuery } from "../store/authApi";
import { useMyMatchQuery } from "../store/matcherApi";
import ChangePasswordForm from "../components/ChangePasswordForm";
import EditMyDetailsForm from "../components/EditMyDetailsForm";
import { Button } from "../components/shared/Button";
import { Modal } from "../components/shared/Modal";
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
			<div className="border-blue-spruce-400 rounded-xl border p-5 text-center">
				{isLoading ? (
					<p>Finder dit match...</p>
				) : match?.recipient ? (
					<>
						<p className="text-sm">Du skal give en gave til:</p>
						<p className="text-metallic-gold-500 mt-1 text-2xl font-medium">
							{match.recipient.name}
						</p>
					</>
				) : (
					<p>
						Nisserne har ikke trukket lod endnu.
						<br />
						Kom tilbage efter lodtrækningen for at se hvem du skal give en gave til i år.
					</p>
				)}
			</div>

			<div className="border-blue-spruce-400 flex flex-col gap-3 rounded-xl border p-5">
				<h2 className="text-lg flex flex-row gap-2 items-center">
					Dine info
					<FaPencil className="size-4 text-accent-light hover:text-accent" onClick={() => setOpenDialog("details")} title="Rediger din info"/>
				</h2>
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
					{/* <Button behaviour="action" onClick={() => setOpenDialog("details")}>
						Rediger info
					</Button> */}
				</div>
			</div>

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
