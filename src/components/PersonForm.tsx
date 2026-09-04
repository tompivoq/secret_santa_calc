import { useAddPersonMutation, useGetPeopleQuery } from "../store/peopleApi";
import type { Person, PhoneNumber } from "../models/person";
import { isPhoneNumber } from "../models/type_check";
import { useForm } from "react-hook-form";
import clsx from "clsx";
import { useState } from "react";

interface FormData {
  name: string;
  email: string;
  phone: PhoneNumber;
  partnerId: number | undefined;
}

const inputClasses = (hasError: boolean) =>
  clsx(
    "rounded-md border px-2.5 py-2 text-base dark:border-gray-700",
    hasError ? "border-red-500 dark:border-red-500" : "border-gray-300",
  );

const NO_PEOPLE: Person[] = [];

interface JustCreated {
  name: string;
  initialPassword: string;
}

function PersonForm() {
  const { data } = useGetPeopleQuery();
  const people = data ?? NO_PEOPLE;
  const [addPerson] = useAddPersonMutation();
  const [justCreated, setJustCreated] = useState<JustCreated | null>(null);

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
      setJustCreated({ name: created.name, initialPassword: created.initialPassword });
      reset();
    } catch {
      setError("email", { message: "That email is already registered to someone else" });
    }
  };

  return (
    <div className="mt-8 flex flex-col gap-4">
      {justCreated && (
        <div className="rounded-xl border border-green-600 bg-green-50 p-4 text-left text-sm dark:bg-green-950">
          <p>
            <span className="font-semibold">{justCreated.name}</span> was added. Their initial
            password is:
          </p>
          <p className="mt-1 font-mono text-base">{justCreated.initialPassword}</p>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Share this with them — it won't be shown again. They'll be asked to set their own
            password the first time they log in.
          </p>
          <button
            type="button"
            onClick={() => setJustCreated(null)}
            className="mt-2 cursor-pointer underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex rounded-xl border border-gray-400 p-5">
        <form
          className="flex w-full flex-col items-stretch gap-4 text-left"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="flex w-full flex-row justify-between gap-4">
            <div className="flex w-full flex-col gap-1">
              <label htmlFor="name" className="text-sm font-semibold">
                Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Full name"
                {...register("name", {
                  required: "A name is required",
                })}
                className={inputClasses(!!errors.name)}
              />
              {errors.name && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {errors.name.message?.toString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-row justify-between gap-4">
            <div className="flex w-full flex-col gap-1">
              <label htmlFor="email" className="text-sm font-semibold">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
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
                <span className="text-sm text-red-600 dark:text-red-400">
                  {errors.email.message?.toString()}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col gap-1">
              <label htmlFor="phone" className="text-sm font-semibold">
                Phone
              </label>
              <input
                id="phone"
                type="number"
                placeholder="74551212"
                {...register("phone", {
                  required: "A phone number is required",
                  valueAsNumber: true,
                  validate: (value) => isPhoneNumber(value) || "Not a valid phonenumber",
                })}
                className={inputClasses(!!errors.phone)}
              />
              {errors.phone && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {errors.phone.message?.toString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="partner" className="text-sm font-semibold">
              Partner
            </label>
            <select
              id="partner"
              {...register("partnerId", {
                disabled: people.length < 1,
                setValueAs: (value) => (value === "" ? undefined : Number(value)),
              })}
              className="rounded-md border border-gray-300 px-2.5 py-2 text-base disabled:opacity-50 dark:border-gray-700"
            >
              <option value="">None</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="cursor-pointer self-start rounded-md border border-gray-700 px-4 py-2 text-base hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
          >
            Add Person
          </button>
        </form>
      </div>
    </div>
  );
}

export default PersonForm;
