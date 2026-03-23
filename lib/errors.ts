// lib/errors.ts

export class BusinessLogicError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
    this.name = "BusinessLogicError";
  }
}