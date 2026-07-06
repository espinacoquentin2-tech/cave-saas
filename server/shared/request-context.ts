import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { formatRoleLabel, normalizeRoleKey } from '@/lib/roles';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';

const roleKeySchema = z.enum(['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE']);

export const requestActorSchema = z.object({
  userId: z.number().int().positive(),
  email: z.string().trim().email(),
  role: roleKeySchema,
  roleKey: roleKeySchema,
  organizationId: z.number().int().positive(),
  organizationSlug: z.string().trim().min(1),
  organizationName: z.string().trim().min(1),
});

export type RequestActor = z.infer<typeof requestActorSchema>;

export const READ_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE'];
export const WRITE_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE', 'CAVISTE'];
export const DELETE_ROLES: Array<RequestActor['role']> = ['ADMIN', 'CHEF_CAVE'];
const DEVELOPMENT_ADMIN_LOCAL_PART = 'espinacoquentin2';

const resolveEffectiveRoleKey = (user: { roleKey?: string | null; role?: string | null }) =>
  normalizeRoleKey(user.roleKey) ?? normalizeRoleKey(user.role);

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

const DEFAULT_ORGANIZATION_SLUG = 'organisation-demo';

const ensureDevelopmentDefaultOrganization = () =>
  prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION_SLUG },
    create: { name: 'Organisation Démo', slug: DEFAULT_ORGANIZATION_SLUG },
    update: {},
    select: { id: true, name: true, slug: true },
  });

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
    select: { id: true, email: true, role: true, roleKey: true },
  });

  if (!dbUser) {
    const roleFromMetadata =
      normalizeRoleKey(typeof user.user_metadata?.roleKey === 'string' ? user.user_metadata.roleKey : null) ??
      normalizeRoleKey(typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null);
    const defaultRoleKey = isDevelopmentAdminEmail(user.email) ? 'ADMIN' : roleFromMetadata ?? 'CAVISTE';
    const fallbackName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email.split('@')[0];

    if (isDevelopmentAdminEmail(user.email) && defaultRoleKey !== roleFromMetadata) {
      logger.warn({
        action: 'auth.dev_admin_bootstrap',
        userEmail: user.email,
        details: {
          message: 'Compte de développement promu ADMIN lors de sa création.',
          previousRole: roleFromMetadata ?? 'missing',
          targetRole: defaultRoleKey,
        },
      });
    }

    try {
      dbUser = await prisma.user.create({
        data: {
          email: user.email.toLowerCase(),
          name: fallbackName,
          role: formatRoleLabel(defaultRoleKey),
          roleKey: defaultRoleKey,
        },
        select: { id: true, email: true, role: true, roleKey: true },
      });
    } catch {
      dbUser = await prisma.user.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } },
        select: { id: true, email: true, role: true, roleKey: true },
      });
    }
  }

  if (!dbUser) {
    throw new UnauthorizedError('Utilisateur introuvable ou non autorisé.');
  }

  if (isDevelopmentAdminEmail(dbUser.email)) {
    const currentRoleKey = resolveEffectiveRoleKey(dbUser);

    if (currentRoleKey !== 'ADMIN') {
      logger.warn({
        action: 'auth.dev_admin_role_mismatch',
        userEmail: dbUser.email,
        role: currentRoleKey ?? dbUser.role,
        details: {
          message: 'Le compte de développement espinacoquentin2 doit être ADMIN. Mise à niveau automatique en cours.',
          currentRole: dbUser.role,
          currentRoleKey: dbUser.roleKey,
        },
      });

      dbUser = await prisma.user.update({
        where: { email: dbUser.email },
        data: { role: formatRoleLabel('ADMIN'), roleKey: 'ADMIN' },
        select: { id: true, email: true, role: true, roleKey: true },
      });
    }
  }

  const requestedOrganizationId = request.headers.get('x-organization-id')?.trim();
  const requestedOrganizationSlug = request.headers.get('x-organization-slug')?.trim();

  let memberships = await prisma.organizationMember.findMany({
    where: { userId: dbUser.id },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { id: 'asc' },
  });

  if (memberships.length === 0 && process.env.NODE_ENV !== 'production') {
    const fallbackOrganization = await ensureDevelopmentDefaultOrganization();
    const fallbackRoleKey = resolveEffectiveRoleKey(dbUser) ?? 'CAVISTE';
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: fallbackOrganization.id,
          userId: dbUser.id,
        },
      },
      create: {
        organizationId: fallbackOrganization.id,
        userId: dbUser.id,
        roleKey: fallbackRoleKey,
      },
      update: {
        roleKey: fallbackRoleKey,
      },
    });
    memberships = [
      {
        id: 0,
        organizationId: fallbackOrganization.id,
        userId: dbUser.id,
        roleKey: fallbackRoleKey,
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: fallbackOrganization,
      },
    ];
  }

  if (memberships.length === 0) {
    throw new ForbiddenError('Aucune organisation active pour cet utilisateur.');
  }

  const selectedMembership =
    requestedOrganizationId || requestedOrganizationSlug
      ? memberships.find((membership) => {
          if (requestedOrganizationId && membership.organizationId === Number(requestedOrganizationId)) {
            return true;
          }

          return requestedOrganizationSlug ? membership.organization.slug === requestedOrganizationSlug : false;
        })
      : memberships.length === 1
        ? memberships[0]
        : null;

  if (!selectedMembership) {
    if (requestedOrganizationId || requestedOrganizationSlug) {
      throw new ForbiddenError("Vous n'etes pas membre de l'organisation demandee.");
    }

    throw new ForbiddenError('Plusieurs organisations disponibles. Fournissez x-organization-id ou x-organization-slug.');
  }

  const effectiveRoleKey = normalizeRoleKey(selectedMembership.roleKey) ?? resolveEffectiveRoleKey(dbUser);
  if (!effectiveRoleKey) {
    throw new ForbiddenError('Rôle utilisateur invalide.');
  }

  return {
    userId: dbUser.id,
    email: dbUser.email,
    role: effectiveRoleKey,
    roleKey: effectiveRoleKey,
    organizationId: selectedMembership.organizationId,
    organizationSlug: selectedMembership.organization.slug,
    organizationName: selectedMembership.organization.name,
  };
};

export const assertRole = (
  actor: RequestActor,
  allowedRoles: Array<RequestActor['role']>,
) => {
  if (!allowedRoles.includes(actor.roleKey)) {
    throw new ForbiddenError('Accès refusé pour ce rôle.');
  }
};
