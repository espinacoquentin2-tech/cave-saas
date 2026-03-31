// lib/errors.ts

export class BusinessLogicError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

export class UnauthorizedError extends BusinessLogicError {
  constructor(message: string = 'Authentification requise.') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends BusinessLogicError {
  constructor(message: string = 'Accès interdit.') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}
