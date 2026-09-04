import { useLogoutMutation, useMeQuery } from "../store/authApi";

/**
 * Reached only once RequireAuth (in App.tsx) has confirmed both that
 * someone is logged in and that they're past the forced first-login
 * password change — this doesn't re-check either itself.
 */
function AccountPage() {
  const { data } = useMeQuery();
  const [logout] = useLogoutMutation();

  if (!data) {
    return null;
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

      <p className="rounded-xl border border-gray-400 p-5 text-center">
        You haven't been matched yet — check back after the draw.
      </p>
    </div>
  );
}

export default AccountPage;
