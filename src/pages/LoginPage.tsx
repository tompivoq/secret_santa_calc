import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import clsx from "clsx";
import { authApi, useLoginMutation } from "../store/authApi";
import type { AppDispatch } from "../store/store";

interface FormData {
	email: string;
	password: string;
}

const inputClasses = (hasError: boolean) =>
	clsx(
		"rounded-md border px-2.5 py-2 text-base",
		hasError ? "border-error" : "border-input-border",
	);

function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const linkExpired = searchParams.get("error") === "link-expired";
	const dispatch = useDispatch<AppDispatch>();
	const [login, { isLoading }] = useLoginMutation();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isValid },
	} = useForm<FormData>({ mode: "onChange" });

	const onSubmit = async (data: FormData) => {
		try {
			const result = await login(data).unwrap();
			// The login mutation also invalidates the "me" query's cache tag, but
			// that refetch is async and not guaranteed to land before the
			// navigate() below — without this, RequireAuth on /account could
			// still read the stale pre-login 401 for a moment and bounce straight
			// back to /login right after a successful login. Seeding it directly
			// from this response (same shape as /me's) makes the ordering exact
			// instead of racing the refetch.
			dispatch(
				authApi.util.upsertQueryData("me", undefined, {
					person: result.person,
					mustChangePassword: result.mustChangePassword,
					// Always true for a password login: whoever just typed their
					// current password can be asked for it again. Only a magic-link
					// session gets to skip it — see the change-password route.
					requiresCurrentPassword: true,
				}),
			);
			navigate("/account");
		} catch {
			setError("root", { message: "Forkert email eller password" });
		}
	};

	return (
		<div className="mt-8 flex flex-col gap-4 rounded-xl border p-5">
			{linkExpired && (
				// Where /api/auth/magic/:token redirects a link that's already been
				// followed, or has expired. Without this it would look like an
				// ordinary trip to the login page, for no apparent reason.
				<p className="text-error text-left text-sm">
					Dit link er allerede blevet brugt, eller er udløbet. Enten bed om et nyt fra admin, eller
					log ind herunder.
				</p>
			)}
			<form
				className="flex w-full flex-col items-stretch gap-4 text-left"
				onSubmit={handleSubmit(onSubmit)}
			>
				<div className="flex flex-col gap-1">
					<label htmlFor="email" className="text-sm font-semibold">
						E-mail
					</label>
					<input
						id="email"
						type="email"
						placeholder="name@example.com"
						{...register("email", { required: "Email er påkrævet" })}
						className={inputClasses(!!errors.email)}
					/>
					{errors.email && <span className="text-error text-sm">{errors.email.message}</span>}
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="password" className="text-sm font-semibold">
						Password
					</label>
					<input
						id="password"
						type="password"
						{...register("password", { required: "Password er påkrævet" })}
						className={inputClasses(!!errors.password)}
					/>
					{errors.password && <span className="text-error text-sm">{errors.password.message}</span>}
				</div>

				{errors.root && <span className="text-error text-sm">{errors.root.message}</span>}

				<button
					type="submit"
					disabled={!isValid || isLoading}
					className="border-border-strong hover:bg-bg-sunken cursor-pointer self-start rounded-md border px-4 py-2 text-base disabled:opacity-50"
				>
					Log ind
				</button>
			</form>
		</div>
	);
}

export default LoginPage;
