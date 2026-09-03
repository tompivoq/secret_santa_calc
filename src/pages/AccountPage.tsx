import { Navigate } from "react-router-dom";
import { useLogoutMutation, useMeQuery } from "../store/authApi";
import ChangePasswordForm from "../components/ChangePasswordForm";

function AccountPage() {
  const { data, isError, isLoading } = useMeQuery();
  const [logout] = useLogoutMutation();

  if (isLoading) {
    return <p className="mt-8">Loading…</p>;
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="mt-8 flex flex-col items-stretch gap-4 text-left">
      <div className="flex items-center justify-between">
        <p className="text-lg">
          Signed in as <span className="font-semibold">{data.person.name}</span>
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="cursor-pointer rounded-md border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
        >
          Log out
        </button>
      </div>

      {data.mustChangePassword ? (
        <ChangePasswordForm />
      ) : (
        <p className="rounded-xl border border-gray-400 p-5 text-center">
          You haven't been matched yet — check back after the draw.
        </p>
      )}
    </div>
  );
}

export default AccountPage;
