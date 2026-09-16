import { useForm } from "react-hook-form";
import clsx from "clsx";
import type { Person, PhoneNumber } from "../models/person";
import { isPhoneNumber } from "../models/type_check";
import { useUpdatePersonMutation } from "../store/peopleApi";
import { Button } from "./shared/Button";

interface FormData {
	name: string;
	email: string;
	phone: PhoneNumber;
	partnerId: number | null;
	lastYearRecipientId: number | null;
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

interface EditPersonFormProps {
	person: Person;
	/** Everyone else, for the partner and last-year dropdowns. */
	others: Person[];
	onDone: () => void;
}

/**
 * Editing everything about one person in a single submission — including
 * partner and last year's recipient, which used to be dropdowns sitting in
 * the list itself. The list now just shows what's set.
 */
function EditPersonForm({ person, others, onDone }: EditPersonFormProps) {
	const [updatePerson, { isLoading }] = useUpdatePersonMutation();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isValid },
	} = useForm<FormData>({
		mode: "onChange",
		defaultValues: {
			name: person.name,
			email: person.email,
			phone: person.phone,
			partnerId: person.partnerId ?? null,
			lastYearRecipientId: person.lastYearRecipientId ?? null,
		},
	});

	const onSubmit = async (data: FormData) => {
		try {
			await updatePerson({ id: person.id, ...data }).unwrap();
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
		<form className="flex flex-col items-stretch gap-4" onSubmit={handleSubmit(onSubmit)}>
			<div className="flex flex-col gap-1">
				<label htmlFor="edit-name" className="text-sm font-semibold">
					Name
				</label>
				<input
					id="edit-name"
					type="text"
					{...register("name", { required: "A name is required" })}
					className={inputClasses(!!errors.name)}
				/>
				{errors.name && (
					<span className="text-sm text-red-600 dark:text-red-400">{errors.name.message}</span>
				)}
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="edit-email" className="text-sm font-semibold">
					Email
				</label>
				<input
					id="edit-email"
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
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="edit-phone" className="text-sm font-semibold">
					Phone
				</label>
				<input
					id="edit-phone"
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

			<div className="flex flex-col gap-1">
				<label htmlFor="edit-partner" className="text-sm font-semibold">
					Partner
				</label>
				<select
					id="edit-partner"
					{...register("partnerId", {
						setValueAs: (value) => (value === "" || value === null ? null : Number(value)),
					})}
					className="rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
				>
					<option value="">None</option>
					{others.map((other) => (
						<option key={other.id} value={other.id}>
							{other.name}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="edit-last-year" className="text-sm font-semibold">
					Last year
				</label>
				<select
					id="edit-last-year"
					{...register("lastYearRecipientId", {
						setValueAs: (value) => (value === "" || value === null ? null : Number(value)),
					})}
					className="rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
				>
					<option value="">None</option>
					{others.map((other) => (
						<option key={other.id} value={other.id}>
							{other.name}
						</option>
					))}
				</select>
				<span className="text-sm text-gray-600 dark:text-gray-400">
					Who they gave to last year, if that happened outside this app. Only used until a draw here
					has one of its own to go on.
				</span>
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

export default EditPersonForm;
