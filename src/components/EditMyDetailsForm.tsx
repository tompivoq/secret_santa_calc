import { useForm } from "react-hook-form";
import type { Person } from "../models/person";
import { useUpdateMeMutation } from "../store/authApi";
import { FormActionButtons } from "./shared/Button";
import { PersonDetailFields, type PersonDetailValues } from "./shared/PersonDetailFields";

type FormData = PersonDetailValues;

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
		<form className="flex flex-col items-stretch gap-4 text-left" onSubmit={handleSubmit(onSubmit)}>
			<PersonDetailFields
				idPrefix="me-"
				register={register}
				errors={errors}
				emailNote="Din e-mail bruger du til at logge ind med. Det er også her vi sender beskeder til dig, så sørg for den er gyldig."
			/>

			{errors.root && (
				<span className="text-sm text-red-600 dark:text-red-400">{errors.root.message}</span>
			)}

			<FormActionButtons onCancel={onDone} isFormValid={isValid} isLoading={isLoading} />
		</form>
	);
}

export default EditMyDetailsForm;
