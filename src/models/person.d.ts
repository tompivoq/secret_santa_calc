export interface Person {
	id: number;
	name: string;
	email: string;
	phone: PhoneNumber;
	partnerId?: number;
	/**
	 * Who they gave to last year, when that happened outside this app. Only
	 * consulted for people the previous locked draw has no answer for — see
	 * the matcher routes.
	 */
	lastYearRecipientId?: number | null;
	/** When they were last emailed an invitation (a login link ahead of the draw). Null if never. */
	invitedAt?: string | null;
	/**
	 * Whether they've logged in and replaced their initial password. Only
	 * in the admin's people list — not on the person a session reports.
	 */
	hasChosenPassword?: boolean;
	/** Gates access to the people-management page — granted out-of-band, not settable through the app. */
	isAdmin: boolean;
}

export type PhoneNumber = number;
