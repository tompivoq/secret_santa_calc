import { useState } from "react";
import { Link } from "react-router-dom";
import { useLogoutMutation, useMeQuery } from "../store/authApi";
import { Button } from "./shared/Button";
import LogoFull from "./../../public/JulenissenLogoType.png?url";
import Logo from "./../../public/JulenissenLogo.png?url";

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
	// Gated behind `isSignedIn &&` everywhere it's used below, so a stale
	// `true` left over from before a logout never actually renders anything.
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<div className="bg-oxblood-900 flex w-full flex-col pt-2">
			<div className="mx-auto flex h-32 w-full max-w-4xl flex-row items-center-safe justify-between px-8 md:px-0">
				<img
					src={LogoFull}
					className="hidden h-3/5 justify-self-start md:flex"
					alt="Julenissen"
					title="Julenissen"
				/>
				<img
					src={Logo}
					className="h-3/5 justify-self-start md:hidden"
					alt="Julenissen"
					title="Julenissen"
				/>
				{isSignedIn && (
					<button
						type="button"
						onClick={() => setMenuOpen((open) => !open)}
						aria-label="Toggle menu"
						aria-expanded={menuOpen}
						className="text-metallic-gold-500 cursor-pointer p-2 md:hidden"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							className="size-6"
						>
							{menuOpen ? (
								<path d="M6 6l12 12M18 6l-12 12" />
							) : (
								<path d="M4 6h16M4 12h16M4 18h16" />
							)}
						</svg>
					</button>
				)}
				<nav className="my-4 hidden flex-1 justify-end text-base md:flex">
					{isSignedIn && (
						<>
							<div id="page_nav" className="flex items-center-safe gap-4 px-4">
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
								<Button onClick={() => logout()} behaviour="action">
									Log out
								</Button>
							</div>
						</>
					)}
				</nav>
			</div>

			{isSignedIn && menuOpen && (
				<nav className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 pb-4 text-base md:hidden">
					<div id="page_nav" className="flex flex-col gap-3">
						{me.person.isAdmin && (
							<Link
								to="/"
								className="underline hover:no-underline"
								onClick={() => setMenuOpen(false)}
							>
								Manage people
							</Link>
						)}
						<Link
							to="/account"
							className="underline hover:no-underline"
							onClick={() => setMenuOpen(false)}
						>
							My account
						</Link>
					</div>
					<div id="user" className="flex flex-col items-start gap-1">
						<p className="text-sm">
							Signed in as <span className="font-semibold">{me.person.name}</span>
						</p>
						<Button
							onClick={() => {
								setMenuOpen(false);
								logout();
							}}
							behaviour="action"
						>
							Log out
						</Button>
					</div>
				</nav>
			)}
		</div>
	);
};
