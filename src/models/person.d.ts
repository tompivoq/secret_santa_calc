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
	/** Gates access to the people-management page — granted out-of-band, not settable through the app. */
	isAdmin: boolean;
}

export type PhoneNumber = number;
