interface SendOutcomeProps {
	/** Who the last send reached. Undefined before anything has been sent. */
	sent: { personId: number; name: string }[] | undefined;
	failed: { personId: number; name: string; error: string }[] | undefined;
	/** The request as a whole failed, as opposed to individual addresses. */
	hasError: boolean;
}

/**
 * What came of sending emails to a batch of people — shared by invitations
 * and match notifications, which report back in exactly the same shape.
 */
export const SendOutcome = ({ sent, failed, hasError }: SendOutcomeProps) => (
	<>
		{hasError && <p className="text-error text-sm">Kunne ikke sende mails. Prøv venligst igen.</p>}

		{sent && sent.length > 0 && (
			<p className="text-sm">Sendte email til {sent.map((person) => person.name).join(", ")}.</p>
		)}

		{failed && failed.length > 0 && (
			<div className="text-error text-sm">
				{/* Named individually: the admin has to know who to chase, and a
				    count alone wouldn't tell them. */}
				<p>Kunne ikke sende til disse deltagere. De vil blive forsøgt igen næste gang:</p>
				<ul className="mt-1 flex flex-col gap-1">
					{failed.map((person) => (
						<li key={person.personId}>
							{person.name} — {person.error}
						</li>
					))}
				</ul>
			</div>
		)}
	</>
);
