import { z } from 'zod';

export const requestActorSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ADMIN', 'CHEF_CAVE', 'CAVISTE']),
});

export type RequestActor = z.infer<typeof requestActorSchema>;

const normalizeRole = (roleHeader: string | null) => {
  switch (roleHeader?.trim().toUpperCase()) {
    case 'ADMIN':
      return 'ADMIN';
    case 'CHEF DE CAVE':
    case 'CHEF_CAVE':
      return 'CHEF_CAVE';
    case 'CAVISTE':
      return 'CAVISTE';
    default:
      return null;
  }
};

export const getRequestId = (request: Request) =>
  request.headers.get('x-request-id') ?? crypto.randomUUID();

export const parseRequestActor = (request: Request): RequestActor =>
  requestActorSchema.parse({
    email: request.headers.get('x-user-email'),
    role: normalizeRole(request.headers.get('x-user-role')),
  });
