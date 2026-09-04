import { useMeQuery } from "../store/authApi";

/**
 * Reached only once RequireAuth (in App.tsx) has confirmed both that
 * someone is logged in and that they're past the forced first-login
 * password change — this doesn't re-check either itself.
 */
function AccountPage() {
  const { data } = useMeQuery();

  if (!data) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col items-stretch gap-4 text-left">
      <p className="rounded-xl border border-gray-400 p-5 text-center">
        You haven't been matched yet — check back after the draw.
      </p>
    </div>
  );
}

export default AccountPage;
