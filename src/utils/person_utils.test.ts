import { describe, expect, it } from 'vitest'
import type { Person } from '../models/person'
import { findPartner, getNextId, removePerson, setPartner } from './person_utils'

const makePerson = (id: number, partnerId?: number): Person => ({
  id,
  name: `Person ${id}`,
  email: `person${id}@example.com`,
  partnerId,
})

describe('getNextId', () => {
  it('returns 0 for an empty list', () => {
    expect(getNextId([])).toBe(0)
  })

  it('returns one more than the highest existing id', () => {
    const people = [makePerson(0), makePerson(3), makePerson(1)]
    expect(getNextId(people)).toBe(4)
  })

  it('works when the list has a single person', () => {
    expect(getNextId([makePerson(5)])).toBe(6)
  })
})

describe('findPartner', () => {
  it('returns undefined when the person has no partner', () => {
    const people = [makePerson(0)]
    expect(findPartner(people, people[0])).toBeUndefined()
  })

  it('returns the partner referenced by partnerId', () => {
    const people = [makePerson(0, 1), makePerson(1, 0)]
    expect(findPartner(people, people[0])?.id).toBe(1)
  })
})

describe('setPartner', () => {
  it('links two people reciprocally', () => {
    const people = [makePerson(0), makePerson(1)]
    const result = setPartner(people, 0, 1)

    expect(result.find((p) => p.id === 0)?.partnerId).toBe(1)
    expect(result.find((p) => p.id === 1)?.partnerId).toBe(0)
  })

  it('clears the partner when partnerId is null', () => {
    const people = [makePerson(0, 1), makePerson(1, 0)]
    const result = setPartner(people, 0, null)

    expect(result.find((p) => p.id === 0)?.partnerId).toBeUndefined()
    expect(result.find((p) => p.id === 1)?.partnerId).toBeUndefined()
  })

  it('unlinks the previous partner when switching to a new one', () => {
    // Anna (0) & Bjørn (1) are partnered; Carl (2) is unpartnered.
    const people = [makePerson(0, 1), makePerson(1, 0), makePerson(2)]
    const result = setPartner(people, 0, 2)

    expect(result.find((p) => p.id === 0)?.partnerId).toBe(2)
    expect(result.find((p) => p.id === 2)?.partnerId).toBe(0)
    expect(result.find((p) => p.id === 1)?.partnerId).toBeUndefined()
  })

  it('unlinks the new partner from their previous partner too', () => {
    // Anna (0) & Bjørn (1) are partnered; Carl (2) & Dana (3) are partnered.
    // Anna now partners with Carl.
    const people = [makePerson(0, 1), makePerson(1, 0), makePerson(2, 3), makePerson(3, 2)]
    const result = setPartner(people, 0, 2)

    expect(result.find((p) => p.id === 0)?.partnerId).toBe(2)
    expect(result.find((p) => p.id === 2)?.partnerId).toBe(0)
    expect(result.find((p) => p.id === 1)?.partnerId).toBeUndefined()
    expect(result.find((p) => p.id === 3)?.partnerId).toBeUndefined()
  })

  it('is a no-op when the person does not exist', () => {
    const people = [makePerson(0)]
    expect(setPartner(people, 99, 0)).toBe(people)
  })

  it('is a no-op when trying to partner a person with themselves', () => {
    const people = [makePerson(0)]
    expect(setPartner(people, 0, 0)).toBe(people)
  })
})

describe('removePerson', () => {
  it('removes the person from the list', () => {
    const people = [makePerson(0), makePerson(1)]
    const result = removePerson(people, 0)

    expect(result).toHaveLength(1)
    expect(result.find((p) => p.id === 0)).toBeUndefined()
  })

  it("clears the removed person's partner link on their former partner", () => {
    const people = [makePerson(0, 1), makePerson(1, 0)]
    const result = removePerson(people, 0)

    expect(result.find((p) => p.id === 1)?.partnerId).toBeUndefined()
  })
})
