import type { AssemblageSourceRole } from '@/lib/assemblage';

export const WORKORDER_ASSEMBLAGE_SOURCE_ROLE_LABELS: Record<AssemblageSourceRole, string> = {
  MAIN: 'Principal',
  RESERVE: 'Reserve',
  ROSE: 'Rouge / rose',
};

export const normalizeWorkOrderAssemblageSourceRole = (
  value: unknown,
): AssemblageSourceRole | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const role = value.trim().toUpperCase();
  if (role === 'MAIN' || role === 'RESERVE' || role === 'ROSE') {
    return role;
  }

  return null;
};

export const getWorkOrderAssemblageSourceRoleForStatus = (
  status: string | null | undefined,
): AssemblageSourceRole | null => {
  const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';

  if (normalizedStatus === 'RESERVE') {
    return 'RESERVE';
  }

  if (normalizedStatus === 'VIN_ROUGE') {
    return 'ROSE';
  }

  if (['VIN_DE_BASE', 'ASSEMBLAGE', 'ASSEMBLE'].includes(normalizedStatus)) {
    return 'MAIN';
  }

  return null;
};

export const getWorkOrderAssemblageSourceRoleLabel = (
  role: AssemblageSourceRole | null | undefined,
) => (role ? WORKORDER_ASSEMBLAGE_SOURCE_ROLE_LABELS[role] : 'Role inconnu');
