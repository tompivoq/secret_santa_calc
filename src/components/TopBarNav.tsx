import { Link } from "react-router-dom";
import { useLogoutMutation, useMeQuery } from "../store/authApi";

export const TopBarNav = () => {
  // Also queried (and cached) inside RequireAuth/AccountPage/ChangePasswordPage
  // — RTK Query dedupes identical in-flight queries, so this doesn't add a request.
  const { data: me, isError } = useMeQuery();
  const [logout] = useLogoutMutation();
  // RTK Query keeps the last successful `data` around even once a later
  // refetch errors (e.g. right after logout, once the "me" query is
  // invalidated and refetches to a 401) — `me` alone would stay truthy and
  // this would keep rendering the signed-in nav. Check isError too, same
  // as RequireAuth does for the same reason.
  const isSignedIn = me !== undefined && !isError;

  return (
    <div className="flex w-full flex-row justify-center bg-red-900 pt-4">
      <div className="mx-auto flex w-2xl flex-col justify-center-safe">
        <h1 className="text-center text-3xl font-medium text-gray-900 dark:text-gray-100">
          Secret Santa Calculator
        </h1>
        <nav className="my-4 flex w-full items-start align-middle text-lg">
          {isSignedIn && (
            <>
              <div className="flex-1" />
              <div id="page_nav" className="flex gap-4 self-center-safe">
                {me.person.isAdmin && (
                  <Link to="/" className="underline hover:no-underline">
                    Manage people
                  </Link>
                )}
                <Link to="/account" className="underline hover:no-underline">
                  My account
                </Link>
              </div>
              <div id="user" className="flex flex-1 flex-col items-center self-end-safe px-2">
                <p className="text-sm">
                  Signed in as <span className="font-semibold">{me.person.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-fit cursor-pointer rounded-md border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </nav>
      </div>
    </div>
  );
};
