export function createNextHandler<Auth>(options: {
  authenticate(request: Request): Promise<Auth | null>;
  makeService(auth: Auth): (body: unknown, options: { signal: AbortSignal }) => Promise<unknown>;
}): (request: Request) => Promise<Response>;
