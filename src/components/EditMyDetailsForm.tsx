import { useForm } from "react-hook-form";
import clsx from "clsx";
import type { Person, PhoneNumber } from "../models/person";
import { isPhoneNumber } from "../models/type_check";
import { useUpdateMeMutation } from "../store/authApi";
import { Button } from "./shared/Button";

interface FormData {
	name: string;
	email: string;
	phone: PhoneNumber;
}

const inputClasses = (hasError: boolean) =>
	clsx(
		"rounded-md border px-2.5 py-2 text-base dark:border-gray-700",
		hasError ? "border-red-500 dark:border-red-500" : "border-gray-300",
	);

/** Narrows RTK Query's opaque mutation error down to "the server returned this HTTP status". */
const errorStatus = (error: unknown): number | undefined =>
	typeof error === "object" &&
	error !== null &&
	"status" in error &&
	typeof error.status === "number"
		? error.status
		: undefined;

interface EditMyDetailsFormProps {
	person: Person;
	onDone: () => void;
}

/**
 * Editing your own name, email and phone.
 *
 * Deliberately doesn't offer partner or last year's recipient, which the
 * admin's version of this form does: those decide who you can be matched
 * with, so letting people set their own would let them shape their own
 * match. The server refuses them here regardless of what this sends.
 */
function EditMyDetailsForm({ person, onDone }: EditMyDetailsFormProps) {
	const [updateMe, { isLoading }] = useUpdateMeMutation();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isValid },
	} = useForm<FormData>({
		mode: "onChange",
		defaultValues: { name: person.name, email: person.email, phone: person.phone },
	});

	const onSubmit = async (data: FormData) => {
		try {
			await updateMe(data).unwrap();
			onDone();
		} catch (error) {
			if (errorStatus(error) === 409) {
				setError("email", { message: "That email is already registered to someone else" });
			} else {
				setError("root", { message: "Couldn't save those changes. Please try again." });
			}
		}
	};

	return (
		<form className="flex flex-col items-stretch gap-4 text-left" onSubmit={handleSubmit(onSubmit)}>
			<div className="flex flex-col gap-1">
				<label htmlFor="me-name" className="text-sm font-semibold">
					Name
				</label>
				<input
					id="me-name"
					type="text"
					{...register("name", { required: "A name is required" })}
					className={inputClasses(!!errors.name)}
				/>
				{errors.name && (
					<span className="text-sm text-red-600 dark:text-red-400">{errors.name.message}</span>
				)}
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="me-email" className="text-sm font-semibold">
					Email
				</label>
				<input
					id="me-email"
					type="email"
					{...register("email", {
						required: "You need to input a valid email",
						pattern: {
							value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
							message: "Please enter a valid email address",
						},
					})}
					className={inputClasses(!!errors.email)}
				/>
				{errors.email && (
					<span className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</span>
				)}
				<span className="text-sm text-gray-600 dark:text-gray-400">
					This is also what you log in with, and where your match link is sent.
				</span>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="me-phone" className="text-sm font-semibold">
					Phone
				</label>
				<input
					id="me-phone"
					type="number"
					{...register("phone", {
						required: "A phone number is required",
						valueAsNumber: true,
						validate: (value) => isPhoneNumber(value) || "Not a valid phonenumber",
					})}
					className={inputClasses(!!errors.phone)}
				/>
				{errors.phone && (
					<span className="text-sm text-red-600 dark:text-red-400">{errors.phone.message}</span>
				)}
			</div>

			{errors.root && (
				<span className="text-sm text-red-600 dark:text-red-400">{errors.root.message}</span>
			)}

			<div className="flex flex-row justify-end gap-2">
				<Button type="button" behaviour="neutral" onClick={onDone}>
					Cancel
				</Button>
				<Button type="submit" behaviour="action" disabled={!isValid || isLoading}>
					{isLoading ? "Saving…" : "Save changes"}
				</Button>
			</div>
		</form>
	);
}

export default EditMyDetailsForm;
