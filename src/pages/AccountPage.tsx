import { useState } from "react";
import { useMeQuery } from "../store/authApi";
import { useMyMatchQuery } from "../store/matcherApi";
import ChangePasswordForm from "../components/ChangePasswordForm";
import EditMyDetailsForm from "../components/EditMyDetailsForm";
import { Button } from "../components/shared/Button";
import { Modal } from "../components/shared/Modal";

/** One read-only "Label / value" row of someone's own details. */
const Detail = ({ label, value }: { label: string; value: string }) => (
	<div className="flex flex-row justify-between gap-4">
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
					<p>Checking for your match…</p>
				) : match?.recipient ? (
					<>
						<p className="text-sm">You're the secret santa for</p>
						<p className="text-metallic-gold-500 mt-1 text-2xl font-medium">
							{match.recipient.name}
						</p>
					</>
				) : (
					<p>You haven't been matched yet — check back after the draw.</p>
				)}
			</div>

			<div className="border-blue-spruce-400 flex flex-col gap-3 rounded-xl border p-5">
				<h2 className="text-lg">Your details</h2>
				<Detail label="Name" value={person.name} />
				<Detail label="Email" value={person.email} />
				<Detail label="Phone" value={String(person.phone)} />
				{/* Partner and last year's recipient aren't here on purpose —
				    they decide who you can be matched with, so they belong to
				    whoever runs the draw. */}
				<div className="flex flex-row justify-end gap-2">
					<Button behaviour="neutral" onClick={() => setOpenDialog("password")}>
						Change password
					</Button>
					<Button behaviour="action" onClick={() => setOpenDialog("details")}>
						Edit details
					</Button>
				</div>
			</div>

			{openDialog === "details" && (
				<Modal open onClose={() => setOpenDialog(null)} title="Edit your details">
					<EditMyDetailsForm person={person} onDone={() => setOpenDialog(null)} />
				</Modal>
			)}

			{openDialog === "password" && (
				<Modal open onClose={() => setOpenDialog(null)} title="Change your password">
					<ChangePasswordForm
						intro="Pick a new password. You'll need your current one to change it."
						onSuccess={() => setOpenDialog(null)}
					/>
				</Modal>
			)}
		</div>
	);
}

export default AccountPage;
