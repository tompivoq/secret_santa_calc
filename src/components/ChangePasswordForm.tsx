import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import clsx from "clsx";
import { authApi, useChangePasswordMutation, useMeQuery } from "../store/authApi";
import type { AppDispatch } from "../store/store";

interface FormData {
	currentPassword: string;
	newPassword: string;
	confirmNewPassword: string;
}

const inputClasses = (hasError: boolean) =>
	clsx(
		"rounded-md border px-2.5 py-2 text-base",
		hasError ? "border-error" : "border-input-border",
	);

interface ChangePasswordFormProps {
	/** Called after the password is changed and the "me" cache (see below) has been updated. */
	onSuccess?: () => void;
	/**
	 * Why they're being asked. Defaults to the forced first-login wording;
	 * someone changing their password by choice needs to be told something
	 * else entirely.
	 */
	intro?: string;
}

function ChangePasswordForm({ onSuccess, intro }: ChangePasswordFormProps = {}) {
	const dispatch = useDispatch<AppDispatch>();
	const { data: me } = useMeQuery();
	const [changePassword, { isLoading }] = useChangePasswordMutation();
	// Someone who got here from an emailed link has never had a password, so
	// asking for the current one would be a field they cannot fill in. The
	// server decides this and enforces it either way.
	const requiresCurrent = me?.requiresCurrentPassword !== false;
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isValid },
	} = useForm<FormData>({ mode: "onChange" });

	const onSubmit = async (data: FormData) => {
		try {
			await changePassword({
				newPassword: data.newPassword,
				...(requiresCurrent && { currentPassword: data.currentPassword }),
			}).unwrap();
			// The mutation also invalidates the "me" query's cache tag, but that
			// refetch is async and not guaranteed to land before onSuccess (e.g.
			// ChangePasswordPage's navigate("/account")) runs — without this,
			// RequireAuth on /account could still read the stale
			// mustChangePassword: true for a moment and bounce straight back
			// here. The response itself carries no body to seed a fresh value
			// from (204), so patch the one field that's guaranteed to have
			// changed instead of replacing the whole cached value.
			dispatch(
				authApi.util.updateQueryData("me", undefined, (draft) => {
					draft.mustChangePassword = false;
				}),
			);
			onSuccess?.();
		} catch {
			setError("root", { message: "Nuværende password er forkert" });
		}
	};

	return (
		// No card chrome of its own — the caller supplies it, which is what
		// lets this sit inside a modal without a border inside a border.
		<form className="flex flex-col items-stretch gap-4 text-left" onSubmit={handleSubmit(onSubmit)}>
			<p className="text-sm">
				{intro ??
					(requiresCurrent
						? "Indstil et nyt password"
						: "Vælg venligst et password, så du kan logge ind senere uden et link")}
			</p>

			{requiresCurrent && (
				<div className="flex flex-col gap-1">
					<label htmlFor="currentPassword" className="text-sm font-semibold">
						Nuværende password
					</label>
					<input
						id="currentPassword"
						type="password"
						{...register("currentPassword", { required: "Krævet" })}
						className={inputClasses(!!errors.currentPassword)}
					/>
					{errors.currentPassword && (
						<span className="text-error text-sm">{errors.currentPassword.message}</span>
					)}
				</div>
			)}

			<div className="flex flex-col gap-1">
				<label htmlFor="newPassword" className="text-sm font-semibold">
					Nyt password
				</label>
				<input
					id="newPassword"
					type="password"
					{...register("newPassword", {
						required: "Påkrævet",
						minLength: { value: 8, message: "Mindst 8 tegn" },
					})}
					className={inputClasses(!!errors.newPassword)}
				/>
				{errors.newPassword && (
					<span className="text-error text-sm">{errors.newPassword.message}</span>
				)}
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="confirmNewPassword" className="text-sm font-semibold">
					Bekræft nyt password
				</label>
				<input
					id="confirmNewPassword"
					type="password"
					{...register("confirmNewPassword", {
						required: "Påkrævet",
						validate: (value, formValues) =>
							value === formValues.newPassword || "Passwords matcher ikke",
					})}
					className={inputClasses(!!errors.confirmNewPassword)}
				/>
				{errors.confirmNewPassword && (
					<span className="text-error text-sm">{errors.confirmNewPassword.message}</span>
				)}
			</div>

			{errors.root && <span className="text-error text-sm">{errors.root.message}</span>}

			<button
				type="submit"
				disabled={!isValid || isLoading}
				className="border-border-strong hover:bg-bg-sunken cursor-pointer self-start rounded-md border px-4 py-2 text-base disabled:opacity-50"
			>
				Sæt nyt password
			</button>
		</form>
	);
}

export default ChangePasswordForm;
