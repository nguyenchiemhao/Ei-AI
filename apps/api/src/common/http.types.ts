// Structural shapes of the pieces of Express the HTTP edge touches. Declaring them here keeps
// `@types/express` out of the dependency list for the sake of two property reads.
export interface RequestLike {
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface ResponseLike {
  status(code: number): ResponseLike;
  setHeader(name: string, value: string): void;
  getHeader(name: string): string | number | string[] | undefined;
  json(body: unknown): void;
}

// Set by JwtAuthGuard once a bearer token has been verified. Everything downstream reads the
// principal from here rather than decoding the token a second time.
export interface Principal {
  userId: string;
  systemRole: string;
  tokenId: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface AuthenticatedRequest extends RequestLike {
  principal?: Principal;
}

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
  path: string;
  maxAge?: number;
}

export interface CookieRequest extends RequestLike {
  cookies?: Record<string, string | undefined>;
}

export interface CookieResponse extends ResponseLike {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
}
