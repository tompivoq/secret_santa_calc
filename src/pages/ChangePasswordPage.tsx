import { Navigate, useNavigate } from "react-router-dom";
import { useMeQuery } from "../store/authApi";
import ChangePasswordForm from "../components/ChangePasswordForm";

/**
 * The one route RequireAuth deliberately doesn't guard the usual way — it
 * exists specifically for the mustChangePassword=true window between
 * logging in and picking a real password, so its guard logic is the
 * inverse: authenticated but nothing pending means there's nothing to do
 * here, so bounce onward to /account instead.
 */
function ChangePasswordPage() {
	const { data, isLoading, isError } = useMeQuery();
	const navigate = useNavigate();

	if (isLoading) {
		return <p className="mt-8">Loading…</p>;
	}

	if (isError || !data) {
		return <Navigate to="/login" replace />;
	}

	if (!data.mustChangePassword) {
		return <Navigate to="/account" replace />;
	}

	return (
		<div className="mt-8 rounded-xl border border-gray-400 p-5">
			<ChangePasswordForm onSuccess={() => navigate("/account")} />
		</div>
	);
}

export default ChangePasswordPage;
