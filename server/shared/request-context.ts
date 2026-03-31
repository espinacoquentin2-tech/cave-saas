import { z } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { prisma } from '@/server/shared/prisma';

export const requestActorSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE']),
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

const normalizePersistedRole = (role: string | null | undefined) => {
  if (!role) {
    return null;
  }

  const normalized = role.trim().toUpperCase().replace(/ /g, '_');
  if (normalized === 'CHEF_DE_CAVE') {
    return 'CHEF_CAVE';
  }

  if (['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE'].includes(normalized)) {
    return normalized as RequestActor['role'];
  }

  return null;
};

export const resolveAuthenticatedActor = async (request: Request): Promise<RequestActor> => {
  const actor = parseRequestActor(request);
  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { email: true, role: true },
  });

  if (!user) {
    throw new BusinessLogicError('Utilisateur introuvable ou non autorisé.', 401);
  }

  const persistedRole = normalizePersistedRole(user.role);
  if (!persistedRole) {
    throw new BusinessLogicError('Rôle utilisateur invalide.', 403);
  }

  return {
    email: user.email,
    role: persistedRole,
  };
};

export const assertRole = (
  actor: RequestActor,
  allowedRoles: Array<RequestActor['role']>,
) => {
  if (!allowedRoles.includes(actor.role)) {
    throw new BusinessLogicError('Accès refusé pour ce rôle.', 403);
  }
};
