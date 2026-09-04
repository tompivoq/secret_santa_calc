export interface Person {
	id: number;
	name: string;
	email: string;
	phone: PhoneNumber;
	partnerId?: number;
	last_year_recipient?: Person;
	/** Gates access to the people-management page — granted out-of-band, not settable through the app. */
	isAdmin: boolean;
}

export type PhoneNumber = number;
