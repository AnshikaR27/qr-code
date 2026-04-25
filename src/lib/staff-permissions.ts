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

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getPermissions(role: StaffRole): Set<Permission> {
  return ROLE_PERMISSIONS[role] ?? new Set();
}
