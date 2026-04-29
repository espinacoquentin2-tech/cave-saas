import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';

export const requestActorSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE']),
});

export type RequestActor = z.infer<typeof requestActorSchema>;

export const READ_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE'];
export const WRITE_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE', 'CAVISTE'];
export const DELETE_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE'];
const DEVELOPMENT_ADMIN_LOCAL_PART = 'espinacoquentin2';

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

const isDevelopmentAdminEmail = (email: string | null | undefined) => {
  if (process.env.NODE_ENV !== 'development' || !email) {
    return false;
  }

  return email.trim().toLowerCase().startsWith(`${DEVELOPMENT_ADMIN_LOCAL_PART}@`);
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

  let dbUser = await prisma.user.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' } },
    select: { email: true, role: true },
  });

  if (!dbUser) {
    const roleFromMetadata = normalizePersistedRole(
      typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null,
    );
    const defaultRole = isDevelopmentAdminEmail(user.email) ? 'ADMIN' : roleFromMetadata ?? 'CAVISTE';
    const fallbackName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email.split('@')[0];

    if (isDevelopmentAdminEmail(user.email) && defaultRole !== roleFromMetadata) {
      logger.warn({
        action: 'auth.dev_admin_bootstrap',
        userEmail: user.email,
        details: {
          message: 'Compte de développement promu ADMIN lors de sa création.',
          previousRole: roleFromMetadata ?? 'missing',
          targetRole: defaultRole,
        },
      });
    }

    try {
      dbUser = await prisma.user.create({
        data: {
          email: user.email.toLowerCase(),
          name: fallbackName,
          role: defaultRole,
        },
        select: { email: true, role: true },
      });
    } catch {
      dbUser = await prisma.user.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } },
        select: { email: true, role: true },
      });
    }
  }

  if (!dbUser) {
    throw new UnauthorizedError('Utilisateur introuvable ou non autorisé.');
  }

  if (isDevelopmentAdminEmail(dbUser.email)) {
    const currentRole = normalizePersistedRole(dbUser.role);

    if (currentRole !== 'ADMIN') {
      logger.warn({
        action: 'auth.dev_admin_role_mismatch',
        userEmail: dbUser.email,
        role: currentRole ?? dbUser.role,
        details: {
          message: 'Le compte de développement espinacoquentin2 doit être ADMIN. Mise à niveau automatique en cours.',
          currentRole: dbUser.role,
        },
      });

      dbUser = await prisma.user.update({
        where: { email: dbUser.email },
        data: { role: 'ADMIN' },
        select: { email: true, role: true },
      });
    }
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
