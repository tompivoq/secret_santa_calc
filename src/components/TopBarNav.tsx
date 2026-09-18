import { useState } from "react";
import { Link } from "react-router-dom";
import { useLogoutMutation, useMeQuery } from "../store/authApi";
import { Button } from "./shared/Button";
import { FaBars, FaX } from "react-icons/fa6";
import { ThemeToggle } from "./ThemeToggle";

// Referenced by URL rather than imported: these live in public/, which Vite
// copies verbatim and serves from the root. Importing out of public/ isn't
// supported — it happens to build, but the test environment resolves
// modules through Vite's transform pipeline, which refuses to serve them.
const LOGO_WIDE = "/JulenissenLogoType.png";
const LOGO_COMPACT = "/JulenissenLogo.png";

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
		<div className="sticky top-0 right-0 left-0 w-full">
			<div className="relative w-full">
				<div className="flex w-full flex-col text-text-inverse shadow-lg bg-linear-to-b/hsl from-bg-topbar-start to-bg-topbar-end">
					<div className="mx-auto flex w-full py-2 max-w-4xl flex-row items-center-safe justify-between px-8">
						<img
							src={LOGO_WIDE}
							className="hidden max-h-12 justify-self-start md:flex"
							alt="Julenissen"
							title="Julenissen"
						/>
						<img
							src={LOGO_COMPACT}
							className="max-h-12 justify-self-start md:hidden"
							alt="Julenissen"
							title="Julenissen"
						/>
						{isSignedIn && (
							<button
								type="button"
								onClick={() => setMenuOpen((open) => !open)}
								aria-label="Toggle menu"
								aria-expanded={menuOpen}
								className="cursor-pointer text-brand-foreground p-2 md:hidden"
							>
								{
									menuOpen ? (<FaX />) : (<FaBars />)
								}
							</button>
						)}
						<nav className="my-2 hidden flex-1 justify-end text-base md:flex">
							{isSignedIn && (
								<>
									{me.person.isAdmin && (
										<div id="page_nav" className="flex items-center-safe gap-4 px-4">
											<Link to="/" className="text-brand-foreground underline hover:no-underline">
												Deltagere
											</Link>
											<Link to="/account" className="text-brand-foreground underline hover:no-underline">
												Min side
											</Link>
										</div>
									)}
									<ThemeToggle />
									<div id="user" className="flex flex-col items-center text-brand-foreground self-end-safe px-2">
										{/* <span className="text-sm">Logget ind som</span> */}
										<span className="font-semibold">{me.person.name}</span>
										<Button onClick={() => logout()} behaviour="action">
											Log ud
										</Button>
									</div>
								</>
							)}
						</nav>
					</div>
				</div>
				{isSignedIn && menuOpen && (
					<nav className="absolute right-0 bg-bg-topbar-end text-brand-foreground flex w-fit flex-col items-end gap-4 px-4 py-4 border-t border-t-brand-light rounded-b-lg md:hidden">
						{me.person.isAdmin && (
							<div id="page_nav" className="flex flex-col gap-3">
								<Link
									to="/"
									className="text-brand-foreground underline hover:no-underline"
									onClick={() => setMenuOpen(false)}
								>
									Deltagere
								</Link>
								<Link
									to="/account"
									className="text-brand-foreground underline hover:no-underline"
									onClick={() => setMenuOpen(false)}
								>
									Min side
								</Link>
							</div>
						)}
						<ThemeToggle />
						<div id="user" className="flex flex-row justify-between w-full items-center">
							<div className="flex flex-row grow items-center gap-2">
								<span className="font-semibold">{me.person.name}</span>
								<Button
									onClick={() => {
										setMenuOpen(false);
										logout();
									}}
									behaviour="action"
								>
									Log ud
								</Button>
							</div>
						</div>
					</nav>
				)}
			</div>
		</div>
	);
};
