export interface AuthVariables {
	personId: number;
	/**
	 * Set by requireAuth: whether this session came from following an emailed
	 * login link. Only the change-password route cares — see the reasoning
	 * in session.ts.
	 */
	viaMagicLink: boolean;
}
