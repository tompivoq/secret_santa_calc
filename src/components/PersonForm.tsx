import { useState, type SubmitEvent } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { personAdded } from "../store/peopleSlice";
import { selectAllPeople } from "../store/selectors";
import { getNextId } from "../utils/person_utils";

function PersonForm() {
  const people = useAppSelector(selectAllPeople);
  const dispatch = useAppDispatch();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [partnerId, setPartnerId] = useState("");

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      return;
    }

    dispatch(
      personAdded({
        id: getNextId(people),
        name: trimmedName,
        email: trimmedEmail,
        partnerId: partnerId === "" ? undefined : Number(partnerId),
      }),
    );

    setName("");
    setEmail("");
    setPartnerId("");
  };

  return (
    <div className="flex mt-8 p-5 rounded-xl border border-gray-400">
      <form className="flex flex-col w-full items-stretch gap-4 text-left" onSubmit={handleSubmit}>
        <div className="flex flex-row justify-between w-full gap-4">
          <div className="flex flex-col w-full gap-1">
            <label htmlFor="name" className="text-sm font-semibold">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              required
              className="rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
            />
          </div>

          <div className="flex flex-col w-full gap-1">
            <label htmlFor="email" className="text-sm font-semibold">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              className="rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="partner" className="text-sm font-semibold">
            Partner
          </label>
          <select
            id="partner"
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            disabled={people.length === 0}
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
          className="self-start rounded-md border border-gray-700 px-4 py-2 text-base cursor-pointer hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
        >
          Add Person
        </button>
      </form>
    </div>
  );
}

export default PersonForm;
