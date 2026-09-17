import clsx from "clsx";
import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";
import type { PhoneNumber } from "../../models/person";
import { isPhoneNumber } from "../../models/type_check";

/** The fields every person-shaped form has, whatever else it adds around them. */
export interface PersonDetailValues {
	name: string;
	email: string;
	phone: PhoneNumber;
}

const inputClasses = (hasError: boolean) =>
	clsx(
		"rounded-md border px-2.5 py-2 text-base dark:border-gray-700",
		hasError ? "border-red-500 dark:border-red-500" : "border-gray-300",
	);

interface PersonDetailFieldsProps<T extends PersonDetailValues> {
	/**
	 * Distinguishes these inputs' ids and label associations from another
	 * set on the same page — the add-person form sits behind the edit
	 * dialog, and both have a field labelled "Name".
	 */
	idPrefix: string;
	register: UseFormRegister<T>;
	errors: FieldErrors<T>;
	/** Extra wording under the email field, where it's worth saying more. */
	emailNote?: string;
}

/**
 * Name, email and phone, with the validation that goes with them.
 *
 * Shared by all three forms that collect them — adding someone, an admin
 * editing someone, and someone editing themselves — which otherwise drift:
 * the phone field became a `tel` input with a pattern in one of them and
 * stayed a bare number input in the others.
 */
export const PersonDetailFields = <T extends PersonDetailValues>({
	idPrefix,
	register,
	errors,
	emailNote,
}: PersonDetailFieldsProps<T>) => {
	// Every T carries these three, by the constraint above — but TypeScript
	// can't see that through Path<T>/FieldErrors<T>. Asserted once here
	// rather than at each of the six use sites below.
	const field = (name: keyof PersonDetailValues) => name as Path<T>;
	const fieldErrors = errors as FieldErrors<PersonDetailValues>;

	return (
		<>
			<div className="flex w-full flex-col gap-1">
				<label htmlFor={`${idPrefix}name`} className="text-sm font-semibold">
					Navn
				</label>
				<input
					id={`${idPrefix}name`}
					type="text"
					placeholder="Navn"
					{...register(field("name"), { required: "En person skal have et navn" })}
					className={inputClasses(!!fieldErrors.name)}
				/>
				{fieldErrors.name && (
					<span className="text-sm text-red-600 dark:text-red-400">
						{fieldErrors.name.message?.toString()}
					</span>
				)}
			</div>

			<div className="flex w-full flex-col justify-between gap-4 md:flex-row">
				<div className="flex w-full flex-col gap-1">
					<label htmlFor={`${idPrefix}email`} className="text-sm font-semibold">
						E-mail
					</label>
					<input
						id={`${idPrefix}email`}
						type="email"
						placeholder="name@example.com"
						{...register(field("email"), {
							required: "En gyldig e-mail er krævet",
							pattern: {
								value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
								message: "Skriv venligst en gyldig e-mail adresse",
							},
						})}
						className={inputClasses(!!fieldErrors.email)}
					/>
					{fieldErrors.email && (
						<span className="text-sm text-red-600 dark:text-red-400">
							{fieldErrors.email.message?.toString()}
						</span>
					)}
					{emailNote && (
						<span className="text-sm text-gray-600 dark:text-gray-400">{emailNote}</span>
					)}
				</div>

				<div className="flex w-full flex-col gap-1">
					<label htmlFor={`${idPrefix}phone`} className="text-sm font-semibold">
						Telefon-nummer
					</label>
					<input
						id={`${idPrefix}phone`}
						type="tel"
						pattern="[0-9]{8}"
						placeholder="74551212"
						{...register(field("phone"), {
							required: "Et telefon-nummer er påkrævet",
							valueAsNumber: true,
							validate: (value) =>
								isPhoneNumber(value) ||
								"Ikke et gyldigt dansk telefonnummer. 8 tal, uden landekode.",
						})}
						className={inputClasses(!!fieldErrors.phone)}
					/>
					{fieldErrors.phone && (
						<span className="text-sm text-red-600 dark:text-red-400">
							{fieldErrors.phone.message?.toString()}
						</span>
					)}
				</div>
			</div>
		</>
	);
};
