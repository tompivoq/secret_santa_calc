import { useMemo, useState } from "react";
import type { Person } from "../models/person";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { partnerSet, personRemoved } from "../store/peopleSlice";
import { selectAllPeople } from "../store/selectors";
import { findPartner } from "../utils/person_utils";
import { reject } from "lodash-es";
import clsx from "clsx";

const buttonClasses = (variant: "neutral" | "danger" = "neutral") =>
  clsx(
    "cursor-pointer rounded-md border px-3 py-2 text-sm",
    variant === "danger"
      ? "border-red-700 text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
      : "border-gray-700 hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800",
  );

interface ListPersonProps {
  person: Person;
  others: Person[];
  onSetPartner: (personId: number, partnerId: number | null) => void;
  onDelete: () => void;
}

const ListPerson = ({ person, others, onSetPartner, onDelete }: ListPersonProps) => {
  const [pendingDelete, setPendingDelete] = useState(false);
  const partner = findPartner(others, person);
  return (
    <li
      key={person.id}
      className="flex flex-col gap-3 rounded-xl border border-gray-400 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-medium">{person.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {person.email} | {person.phone}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-44 flex-row items-center justify-stretch">
          <label htmlFor={`partner-${person.id}`} className="text-sm font-semibold">
            Partner
          </label>
          <select
            id={`partner-${person.id}`}
            value={partner?.id ?? ""}
            onChange={(event) =>
              onSetPartner(person.id, event.target.value === "" ? null : Number(event.target.value))
            }
            className="mx-2 w-full rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
          >
            <option value="">None</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {pendingDelete === true ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Delete {person.name}?</span>
            <button type="button" onClick={onDelete} className={buttonClasses("danger")}>
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(false)}
              className={buttonClasses()}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setPendingDelete(true)} className={buttonClasses()}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
};

function PersonList() {
  const people = useAppSelector(selectAllPeople);
  const dispatch = useAppDispatch();

  const othersById = useMemo(
    () => new Map(people.map((person) => [person.id, reject(people, { id: person.id })])),
    [people],
  );

  if (people.length === 0) {
    return null;
  }

  return (
    <ul className="mt-8 flex flex-col gap-3 text-left">
      {people.map((person) => (
        <ListPerson
          key={person.id}
          person={person}
          others={othersById.get(person.id) ?? []}
          onDelete={() => dispatch(personRemoved(person.id))}
          onSetPartner={(personId, partnerId) => dispatch(partnerSet({ personId, partnerId }))}
        />
      ))}
    </ul>
  );
}

export default PersonList;
