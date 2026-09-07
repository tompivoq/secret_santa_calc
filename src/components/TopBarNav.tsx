import { Link } from "react-router-dom";
import { useLogoutMutation, useMeQuery } from "../store/authApi";
import { Button } from "./shared/Button";

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
		<div className="flex w-full flex-row justify-center bg-oxblood-900 pt-2">
			<div className="mx-auto flex w-2xl flex-row items-center-safe justify-between">
				<h1 className="text-left text-2xl font-medium text-metallic-gold-500">
					Julenissen
				</h1>
				<nav className="my-4 flex flex-1 w-full justify-end text-base">
					{isSignedIn && (
						<>
							<div id="page_nav" className="flex gap-4 px-4 items-center-safe">
								{me.person.isAdmin && (
									<Link to="/" className="underline hover:no-underline">
										Manage people
									</Link>
								)}
								<Link to="/account" className="underline hover:no-underline">
									My account
								</Link>
							</div>
							<div id="user" className="flex flex-col items-center self-end-safe px-2">
								<p className="text-sm">
									Signed in as <span className="font-semibold">{me.person.name}</span>
								</p>
								<Button onClick={() => logout()} behaviour="action">Log out</Button>
							</div>
						</>
					)}
				</nav>
			</div>
		</div>
	);
};
