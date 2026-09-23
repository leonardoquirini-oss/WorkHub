/**
 * Keycloak roles used by WorkHub (mirrors the `/api/workhub` authorization in BERLink).
 *
 * WRITE: may enter/move/edit/exit containers.
 * ADMIN: may create/edit yards and blocks.
 * READ_PRODUCT: may see the material in giacenza (dato commerciale, mirrors `WorkhubRoles.READ_PRODUCT`).
 * Any other authenticated BERLink role is read-only.
 */
export const WRITE_ROLES = ['cd', 'logs', 'resources'] as const
export const ADMIN_ROLES = ['cd'] as const
export const READ_PRODUCT_ROLES = ['cd', 'logs'] as const

export function hasAnyRole(
  roles: readonly string[] | undefined,
  allowed: readonly string[]
): boolean {
  if (!roles || roles.length === 0) return false
  return roles.some((role) => allowed.includes(role))
}

export const canWrite = (roles: readonly string[] | undefined): boolean =>
  hasAnyRole(roles, WRITE_ROLES)

export const isAdmin = (roles: readonly string[] | undefined): boolean =>
  hasAnyRole(roles, ADMIN_ROLES)

export const canReadProduct = (roles: readonly string[] | undefined): boolean =>
  hasAnyRole(roles, READ_PRODUCT_ROLES)
