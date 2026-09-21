export class BiltyError extends Error {
  constructor(
    public readonly code: 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'BiltyError';
  }
}
