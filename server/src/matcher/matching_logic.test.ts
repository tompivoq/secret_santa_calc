import { describe, expect, it } from "vitest";
import { doMatching, type MatchingPerson } from "./matching_logic.js";

const person = (id: number, partnerId: number | null = null): MatchingPerson => ({
	id,
	name: `Person ${id}`,
	email: `person${id}@example.com`,
	phone: 22334455,
	partnerId,
	isAdmin: false,
	hasMatch: false,
	currentTarget: null,
});

describe("doMatching", () => {
	it("assigns everyone a valid recipient, excluding themselves and their partner", () => {
		const bjorn = person(1, 2);
		const anna = person(2, 1);
		const carl = person(3);
		const dana = person(4);
		const people = [bjorn, anna, carl, dana];

		const result = doMatching(people);

		expect(result).not.toBeNull();
		for (const original of people) {
			const matched = result!.find((p) => p.id === original.id)!;
			expect(matched.hasMatch).toBe(true);
			expect(matched.currentTarget).not.toBe(original.id);
			expect(matched.currentTarget).not.toBe(original.partnerId);
		}
	});

	it("produces a full permutation — every person is someone's target exactly once", () => {
		const people = [person(1, 2), person(2, 1), person(3), person(4), person(5)];

		const result = doMatching(people)!;

		const targets = result.map((p) => p.currentTarget).sort((a, b) => a! - b!);
		const ids = people.map((p) => p.id).sort((a, b) => a - b);
		expect(targets).toEqual(ids);
	});

	it("returns null when the only two people are each other's partner", () => {
		const bjorn = person(1, 2);
		const anna = person(2, 1);

		expect(doMatching([bjorn, anna])).toBeNull();
	});

	it("returns null for a single person (no one else to give to)", () => {
		expect(doMatching([person(1)])).toBeNull();
	});

	it("finds a valid assignment across many random shuffles (no flaky dead ends)", () => {
		const people = [person(1, 2), person(2, 1), person(3, 4), person(4, 3), person(5), person(6)];

		for (let i = 0; i < 50; i++) {
			expect(doMatching(people)).not.toBeNull();
		}
	});
});
