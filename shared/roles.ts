/** Centralized role hierarchy used by both client and server */
export const ROLE_HIERARCHY: Record<string, number> = {
  admin: 4,
  supervisor: 3,
  coordinator: 2,
  agent: 1,
};

export type UserRole = keyof typeof ROLE_HIERARCHY;

/** Check whether `userRole` meets or exceeds a numeric access level */
export function hasMinRole(userRole: string, requiredLevel: number): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= requiredLevel;
}

/** Check whether `userRole` meets or exceeds `requiredRole` */
export function isRoleAtLeast(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}
