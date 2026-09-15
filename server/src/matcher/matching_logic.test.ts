import { describe, expect, it } from "vitest";
import { doMatching, type MatchingPerson } from "./matching_logic.js";

const person = (id: number, partnerId: number | null = null): MatchingPerson => ({
	id,
	name: `Person ${id}`,
	email: `person${id}@example.com`,
	phone: 22334455,
	partnerId,
	// Irrelevant here: the matching takes last year's pairings as an
	// argument rather than reading them off the person — see doMatching.
	lastYearRecipientId: null,
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

describe("doMatching, avoiding last year's pairings", () => {
	it("never repeats a giver's previous recipient", () => {
		const people = [person(1), person(2), person(3), person(4)];
		const previous = new Map([
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 1],
		]);

		// Repeated, because a single run could avoid the repeats by luck.
		for (let i = 0; i < 50; i++) {
			const result = doMatching(people, previous)!;
			expect(result).not.toBeNull();
			for (const matched of result) {
				expect(matched.currentTarget).not.toBe(previous.get(matched.id));
			}
		}
	});

	it("still excludes self and partner when avoiding repeats", () => {
		const people = [person(1, 2), person(2, 1), person(3), person(4), person(5)];
		const previous = new Map([
			[1, 3],
			[2, 4],
			[3, 5],
			[4, 1],
			[5, 2],
		]);

		const result = doMatching(people, previous)!;

		for (const original of people) {
			const matched = result.find((p) => p.id === original.id)!;
			expect(matched.currentTarget).not.toBe(original.id);
			expect(matched.currentTarget).not.toBe(original.partnerId);
			expect(matched.currentTarget).not.toBe(previous.get(original.id));
		}
	});

	it("returns null when avoiding repeats is what makes the group impossible", () => {
		// Three people is already tight: each can only give to the other two.
		// Rule out last year's as well and 1 and 2 are both left with only 3,
		// which only one of them can have.
		const people = [person(1), person(2), person(3)];
		const previous = new Map([
			[1, 2],
			[2, 1],
		]);

		expect(doMatching(people, previous)).toBeNull();
		// ...but the same group is perfectly matchable without that rule,
		// which is why callers fall back rather than reporting it impossible.
		expect(doMatching(people)).not.toBeNull();
	});

	it("ignores previous pairings for people who aren't in this draw", () => {
		const people = [person(1), person(2), person(3)];
		const previous = new Map([
			[1, 2],
			[9, 1],
		]);

		const result = doMatching(people, previous)!;

		expect(result).not.toBeNull();
		expect(result.find((p) => p.id === 1)!.currentTarget).toBe(3);
	});
});
