import type { StaffRole } from '@/types';

export type Permission =
  | 'order:view'
  | 'order:set_preparing'
  | 'order:set_ready'
  | 'order:set_delivered'
  | 'order:cancel'
  | 'order:merge'
  | 'order:record_payment'
  | 'order:comp_refund'
  | 'waiter_call:dismiss'
  | 'table:assign'
  | 'menu:mark_out_of_stock'
  | 'menu:edit_items'
  | 'menu:edit_categories'
  | 'settings:edit_printer'
  | 'reports:view';

const FLOOR: Set<Permission> = new Set([
  'order:view',
  'order:set_delivered',
  'order:merge',
  'order:record_payment',
  'waiter_call:dismiss',
  'table:assign',
]);

const KITCHEN: Set<Permission> = new Set([
  'order:view',
  'order:set_preparing',
  'order:set_ready',
  'order:merge',
  'menu:mark_out_of_stock',
]);

const MANAGER: Set<Permission> = new Set([
  'order:view',
  'order:set_preparing',
  'order:set_ready',
  'order:set_delivered',
  'order:cancel',
  'order:merge',
  'order:record_payment',
  'order:comp_refund',
  'waiter_call:dismiss',
  'table:assign',
  'menu:mark_out_of_stock',
  'menu:edit_items',
  'menu:edit_categories',
  'settings:edit_printer',
  'reports:view',
]);

const ROLE_PERMISSIONS: Record<StaffRole, Set<Permission>> = {
  floor: FLOOR,
  kitchen: KITCHEN,
  manager: MANAGER,
};

// TEMPORARY: backwards-compat for JWTs issued before the role refactor.
// Remove this block after 2026-05-09 (2 weeks from deploy on 2026-04-25).
const LEGACY_ROLE_MAP: Record<string, StaffRole> = {
  waiter: 'floor',
  counter: 'floor',
  both: 'floor',
};

export function hasPermission(role: string, permission: Permission): boolean {
  const resolved: StaffRole = LEGACY_ROLE_MAP[role] ?? (role as StaffRole);
  return ROLE_PERMISSIONS[resolved]?.has(permission) ?? false;
}

export function getPermissions(role: string): Set<Permission> {
  const resolved: StaffRole = LEGACY_ROLE_MAP[role] ?? (role as StaffRole);
  return ROLE_PERMISSIONS[resolved] ?? new Set();
}
