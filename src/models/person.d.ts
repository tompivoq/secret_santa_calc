export interface Person {
  id: number;
  name: string;
  email: string;
  partnerId?: number;
  last_year_recipient?: Person;
}
