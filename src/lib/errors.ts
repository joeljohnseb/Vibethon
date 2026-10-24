export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "PAYMENT"
  | "CONFIG";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You don't have permission to do that") => new AppError("FORBIDDEN", msg);
export const invalid = (msg: string, fieldErrors?: Record<string, string>) =>
  new AppError("VALIDATION", msg, fieldErrors);

export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    const code = (cur as { code?: string }).code;
    if (code === "23505") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
