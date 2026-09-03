import type { PhoneNumber } from "./person";

export const isPhoneNumber = (val: string | number | PhoneNumber): val is PhoneNumber =>
  val.toString().length === 8;
