import type { Person } from "../models/person";
import { find } from "lodash-es";

export const findPartner = (people: Person[], person: Person): Person | undefined =>
	find(people, { id: person.partnerId });
