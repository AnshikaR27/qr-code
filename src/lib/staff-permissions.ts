import type { StaffRole } from '@/types';

export type Permission =
  | 'order:view'
  | 'order:set_preparing'
  | 'order:set_ready'
  | 'order:set_delivered'
  | 'order:merge'
  | 'order:record_payment'
  | 'waiter_call:dismiss'
  | 'table:assign'
  | 'menu:mark_out_of_stock';

const WAITER: Set<Permission> = new Set([
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
  'order:record_payment',
  'menu:mark_out_of_stock',
]);

const BOTH: Set<Permission> = new Set([...WAITER, ...KITCHEN]);

const ROLE_PERMISSIONS: Record<StaffRole, Set<Permission>> = {
  waiter: WAITER,
  kitchen: KITCHEN,
  both: BOTH,
};

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getPermissions(role: StaffRole): Set<Permission> {
  return ROLE_PERMISSIONS[role] ?? new Set();
}
