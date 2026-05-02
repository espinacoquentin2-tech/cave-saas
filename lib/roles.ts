export type RoleKey = "ADMIN" | "CHEF_CAVE" | "CAVISTE" | "LECTURE_SEULE";

export type RoleOption = {
  roleKey: RoleKey;
  roleLabel: string;
};

export const ROLE_OPTIONS: RoleOption[] = [
  { roleKey: "ADMIN", roleLabel: "Admin" },
  { roleKey: "CHEF_CAVE", roleLabel: "Chef de cave" },
  { roleKey: "CAVISTE", roleLabel: "Caviste" },
  { roleKey: "LECTURE_SEULE", roleLabel: "Lecture seule" },
];

const ROLE_LABELS: Record<RoleKey, string> = Object.fromEntries(
  ROLE_OPTIONS.map(({ roleKey, roleLabel }) => [roleKey, roleLabel]),
) as Record<RoleKey, string>;

export const normalizeRoleKey = (role: any): RoleKey | null => {
  if (typeof role !== "string" || !role.trim()) return null;
  const normalized = role.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "CHEF_DE_CAVE") return "CHEF_CAVE";
  return ROLE_LABELS[normalized as RoleKey] ? (normalized as RoleKey) : null;
};

export const formatRoleLabel = (role: any) => {
  const normalized = normalizeRoleKey(role);
  return normalized ? ROLE_LABELS[normalized] : (role || "Utilisateur");
};

export const getRoleLabel = formatRoleLabel;

export const getRoleOption = (role: any) => {
  const normalized = normalizeRoleKey(role);
  return normalized ? ROLE_OPTIONS.find((option) => option.roleKey === normalized) : null;
};

export const roleKeyToBackendRole = (role: any) => {
  const option = getRoleOption(role);
  return option?.roleLabel ?? null;
};

export const roleColorByKey = (T: any, role: any) => {
  const roleKey = normalizeRoleKey(role);
  if (!roleKey) return T.accent;
  return ({
    ADMIN: T.accent,
    CHEF_CAVE: T.blue,
    CAVISTE: T.green,
    LECTURE_SEULE: T.textDim,
  } as Record<RoleKey, string>)[roleKey] || T.accent;
};

export const roleMatches = (role: any, expectedRoles: string[]) => {
  const normalized = normalizeRoleKey(role);
  return normalized ? expectedRoles.includes(normalized) : false;
};

export const getCurrentUserRoleKey = (user: any) => user?.roleKey ?? normalizeRoleKey(user?.role);

export const toUiUser = (rawUser: any) => {
  const name = rawUser?.name?.trim() || rawUser?.email?.split("@")[0]?.toUpperCase() || "Utilisateur";
  const roleKey = normalizeRoleKey(rawUser?.role);
  return {
    ...rawUser,
    id: rawUser?.id != null ? String(rawUser.id) : rawUser?.id,
    name,
    roleKey,
    roleLabel: formatRoleLabel(rawUser?.role),
    role: formatRoleLabel(rawUser?.role),
    initials: name.substring(0, 2).toUpperCase(),
  };
};
