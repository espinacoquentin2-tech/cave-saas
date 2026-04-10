import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { prisma } from '@/server/shared/prisma';

export const requestActorSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE']),
});

export type RequestActor = z.infer<typeof requestActorSchema>;

export const READ_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE'];
export const WRITE_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE', 'CAVISTE'];
export const DELETE_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE'];

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

const parseBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    throw new UnauthorizedError('Token d’authentification manquant.');
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Format de token invalide.');
  }

  return token;
};

const getSupabaseAuthClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new UnauthorizedError('Configuration Supabase incomplète.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const getRequestId = (request: Request) =>
  request.headers.get('x-request-id') ?? crypto.randomUUID();

export const resolveAuthenticatedActor = async (request: Request): Promise<RequestActor> => {
  const token = parseBearerToken(request);
  const supabase = getSupabaseAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user?.email) {
    throw new UnauthorizedError('Session invalide ou expirée.');
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { email: true, role: true },
  });

  if (!dbUser) {
    throw new UnauthorizedError('Utilisateur introuvable ou non autorisé.');
  }

  const persistedRole = normalizePersistedRole(dbUser.role);
  if (!persistedRole) {
    throw new ForbiddenError('Rôle utilisateur invalide.');
  }

  return {
    email: dbUser.email,
    role: persistedRole,
  };
};

export const assertRole = (
  actor: RequestActor,
  allowedRoles: Array<RequestActor['role']>,
) => {
  if (!allowedRoles.includes(actor.role)) {
    throw new ForbiddenError('Accès refusé pour ce rôle.');
  }
};
