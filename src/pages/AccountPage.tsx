import { useMeQuery } from "../store/authApi";
import { useMyMatchQuery } from "../store/matcherApi";

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

	if (!data) {
		return null;
	}

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
		</div>
	);
}

export default AccountPage;
