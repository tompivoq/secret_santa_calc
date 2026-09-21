import { useAddPersonMutation, useGetPeopleQuery } from "../store/peopleApi";
import type { Person } from "../models/person";
import { useForm } from "react-hook-form";
import { useMemo, useState } from "react";
import { Button, PersonDetailFields, type PersonDetailValues } from "./shared";
import { filter } from "lodash-es";

interface FormData extends PersonDetailValues {
	partnerId: number | undefined;
}

const NO_PEOPLE: Person[] = [];

interface JustCreated {
	name: string;
	email: string;
	phone: string;
}

function PersonForm() {
	const { data } = useGetPeopleQuery();
	const people = data ?? NO_PEOPLE;
	const [addPerson] = useAddPersonMutation();
	const [justCreated, setJustCreated] = useState<JustCreated | null>(null);

	const validPartners = useMemo(
		() => filter(people, (p) => p.partnerId === undefined || p.partnerId === null),
		[people],
	);

	const {
		register,
		handleSubmit,
		formState: { errors, isValid },
		reset,
		setError,
	} = useForm<FormData>({ mode: "onChange" });

	const onSubmit = async (data: FormData) => {
		try {
			const created = await addPerson({
				name: data.name,
				email: data.email,
				phone: data.phone,
				partnerId: data.partnerId,
			}).unwrap();
			setJustCreated({ name: created.name, email: created.email, phone: created.phone.toString() });
			reset();
		} catch {
			setError("email", { message: "Den indtastede e-mail er allerede brugt til en anden bruger" });
		}
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			{justCreated && (
				<div className="bg-bg-elevated w-fit self-center rounded-xl border p-6 text-left text-sm">
					<div className="flex flex-col gap-1">
						<div className="flex flex-row gap-2">
							<span className="font-semibold">{justCreated.name}</span> blev tilføjet
						</div>
						<div className="flex flex-row gap-2">
							<span className="w-16 font-semibold">E-mail:</span>
							{justCreated.email}
						</div>
						<div className="flex flex-row gap-2">
							<span className="w-16 font-semibold">Telefon:</span>
							{justCreated.phone}
						</div>
					</div>
					<Button behaviour="neutral" className="mx-auto mt-2" onClick={() => setJustCreated(null)}>
						Luk
					</Button>
				</div>
			)}
			<form
				className="flex w-full flex-col items-stretch gap-4 text-left"
				onSubmit={handleSubmit(onSubmit)}
			>
				<PersonDetailFields idPrefix="" register={register} errors={errors} />

				<div className="flex flex-col gap-1">
					<label htmlFor="partner" className="text-sm font-semibold">
						Partner
					</label>
					<select
						id="partner"
						{...register("partnerId", {
							disabled: validPartners.length < 1,
							setValueAs: (value) => (value === "" ? undefined : Number(value)),
						})}
						className="border-input-border rounded-md border px-2.5 py-2 text-base disabled:opacity-50"
					>
						<option value="">Ingen</option>
						{validPartners.map((person) => (
							<option key={person.id} value={person.id}>
								{person.name}
							</option>
						))}
					</select>
				</div>
				<div className="flex w-full flex-row justify-end">
					<Button type="submit" disabled={!isValid} behaviour="action">
						Tilføj person
					</Button>
				</div>
			</form>
		</div>
	);
}

export default PersonForm;
