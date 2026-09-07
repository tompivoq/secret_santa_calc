import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMeQuery } from "../store/authApi";

/**
 * Gates its children behind being logged in — and, unless
 * `mustChangePassword` is set, having finished the forced first-login
 * password change (see ChangePasswordPage, the one route this doesn't
 * apply to). This is a UX guard, not a security boundary in itself: the
 * actual protection is the server rejecting unauthenticated/non-admin
 * requests, which this can't bypass even if someone reaches a page's
 * markup some other way (e.g. the back button, a stale tab, a bookmark).
 */
function RequireAuth({
	children,
	adminOnly = false,
}: {
	children: ReactNode;
	adminOnly?: boolean;
}) {
	const { data, isLoading, isError } = useMeQuery();

	if (isLoading) {
		return <p className="mt-8">Loading…</p>;
	}

	if (isError || !data) {
		return <Navigate to="/login" replace />;
	}

	if (data.mustChangePassword) {
		return <Navigate to="/change-password" replace />;
	}

	if (adminOnly && !data.person.isAdmin) {
		return (
			<p className="mt-8 rounded-xl border border-blue-spruce-400 p-5 text-center">
				You don't have access to this page.
			</p>
		);
	}

	return <>{children}</>;
}

export default RequireAuth;
