export class NotFoundError extends Error {
  readonly name = "NotFoundError";
}

export class InvalidStateError extends Error {
  readonly name = "InvalidStateError";
}

export class ValidationError extends Error {
  readonly name = "ValidationError";
}
