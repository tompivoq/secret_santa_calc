import { useState } from 'react';
import type { Person } from '../models/person';
import { findPartner } from '../utils/person_utils';
import { reject } from 'lodash-es';

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
              <p className="text-sm text-gray-500 dark:text-gray-400">{person.email}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-row justify-stretch w-44 items-center">
                <label htmlFor={`partner-${person.id}`} className="text-sm font-semibold">
                  Partner
                </label>
                <select
                  id={`partner-${person.id}`}
                  value={partner?.id ?? ''}
                  onChange={(event) =>
                    onSetPartner(person.id, event.target.value === '' ? null : Number(event.target.value))
                  }
                  className="rounded-md border border-gray-300 mx-2 px-2.5 py-2 text-base w-full dark:border-gray-700"
                >
                  <option value="">None</option>
                  {
                    others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  }
                </select>
              </div>
              {pendingDelete === true ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Delete {person.name}?</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="cursor-pointer rounded-md border border-red-700 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(false)}
                    className="cursor-pointer rounded-md border border-gray-700 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDelete(true)}
                  className="cursor-pointer rounded-md border border-gray-700 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        );
};

interface PersonListProps {
  people: Person[];
  onRemovePerson: (personId: number) => void;
  onSetPartner: (personId: number, partnerId: number | null) => void;
}

function PersonList({ people, onRemovePerson, onSetPartner }: PersonListProps) {
  if (people.length === 0) {
    return null;
  }

  const getOthers = (personId: number) => reject(people, {id: personId});

  const confirmDelete = (personId: number) => {
    onRemovePerson(personId);
  };

  return (
    <ul className="mt-8 flex flex-col gap-3 text-left">
      {people.map((person) => (
        <ListPerson
          key={person.id}
          person={person}
          others={getOthers(person.id)}
          onDelete={() => confirmDelete(person.id)}
          onSetPartner={onSetPartner} />
      ))}
    </ul>
  );
}

export default PersonList;
