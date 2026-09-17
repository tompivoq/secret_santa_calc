import { useForm } from "react-hook-form";
import type { Person } from "../models/person";
import { useUpdatePersonMutation } from "../store/peopleApi";
import { FormActionButtons } from "./shared/Button";
import { PersonDetailFields, type PersonDetailValues } from "./shared/PersonDetailFields";

interface FormData extends PersonDetailValues {
	partnerId: number | null;
	lastYearRecipientId: number | null;
}

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
				setError("email", {
					message: "Den indtastede e-mail er allerede brugt til en anden bruger",
				});
			} else {
				setError("root", {
					message: "Hmm... Noget gik galt med at gemme ændringerne. Prøv venligst igen.",
				});
			}
		}
	};

	return (
		<form className="flex flex-col items-stretch gap-4" onSubmit={handleSubmit(onSubmit)}>
			<PersonDetailFields idPrefix="edit-" register={register} errors={errors} />

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
					<option value="">Ingen</option>
					{others.map((other) => (
						<option key={other.id} value={other.id}>
							{other.name}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="edit-last-year" className="text-sm font-semibold">
					Sidste år
				</label>
				<select
					id="edit-last-year"
					{...register("lastYearRecipientId", {
						setValueAs: (value) => (value === "" || value === null ? null : Number(value)),
					})}
					className="rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
				>
					<option value="">Ingen</option>
					{others.map((other) => (
						<option key={other.id} value={other.id}>
							{other.name}
						</option>
					))}
				</select>
				<span className="text-sm text-gray-600 dark:text-gray-400">
					Hvem de gav til sidste år, hvis lodtrækningen blev foretaget udenfor denne app. Hvis der
					er en tidligere lodtrækning her, bliver data derfra brugt i stedet.
				</span>
			</div>

			{errors.root && (
				<span className="text-sm text-red-600 dark:text-red-400">{errors.root.message}</span>
			)}

			<FormActionButtons onCancel={onDone} isFormValid={isValid} isLoading={isLoading} />
		</form>
	);
}

export default EditPersonForm;
