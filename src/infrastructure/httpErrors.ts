export class ContractError extends Error {
  public constructor(message = 'Remote response does not satisfy the published contract') {
    super(message);
    this.name = 'ContractError';
  }
}

export class HttpStatusError extends Error {
  public readonly status: number;
  public readonly code: string | null;

  public constructor(status: number, code: string | null) {
    super(`Request failed with status ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.code = code;
  }
}

export class TransportError extends Error {
  public constructor(message = 'Request failed before receiving a response') {
    super(message);
    this.name = 'TransportError';
  }
}

export class TransportTimeoutError extends TransportError {
  public constructor(message = 'Request timed out before receiving a response') {
    super(message);
    this.name = 'TransportTimeoutError';
  }
}
