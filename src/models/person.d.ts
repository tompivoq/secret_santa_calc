export interface Person {
  id: number;
  name: string;
  email: string;
  phone: PhoneNumber;
  partnerId?: number;
  last_year_recipient?: Person;
}

export type PhoneNumber = number;
