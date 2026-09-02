import { useState } from 'react'
import type { Person } from '../models/person'
import { findPartner } from '../utils/person_utils'

interface PersonListProps {
  people: Person[]
  onRemovePerson: (personId: number) => void
  onSetPartner: (personId: number, partnerId: number | null) => void
}

function PersonList({ people, onRemovePerson, onSetPartner }: PersonListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  if (people.length === 0) {
    return null
  }

  const confirmDelete = (personId: number) => {
    onRemovePerson(personId)
    setPendingDeleteId(null)
  }

  return (
    <ul className="mt-8 flex flex-col gap-3 text-left">
      {people.map((person) => {
        const partner = findPartner(people, person)

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
              <label htmlFor={`partner-${person.id}`} className="text-sm font-semibold">
                Partner
              </label>
              <select
                id={`partner-${person.id}`}
                value={partner?.id ?? ''}
                onChange={(event) =>
                  onSetPartner(person.id, event.target.value === '' ? null : Number(event.target.value))
                }
                className="rounded-md border border-gray-300 px-2.5 py-2 text-base dark:border-gray-700"
              >
                <option value="">None</option>
                {people
                  .filter((candidate) => candidate.id !== person.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </select>

              {pendingDeleteId === person.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Delete {person.name}?</span>
                  <button
                    type="button"
                    onClick={() => confirmDelete(person.id)}
                    className="cursor-pointer rounded-md border border-red-700 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                    className="cursor-pointer rounded-md border border-gray-700 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(person.id)}
                  className="cursor-pointer rounded-md border border-gray-700 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-300 dark:hover:bg-gray-800"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default PersonList
