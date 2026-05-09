import type { StaffRole } from '@/types';

export type Permission =
  | 'order:view'
  | 'order:set_preparing'
  | 'order:set_ready'
  | 'order:set_served'
  | 'order:cancel'
  | 'order:cancel_ready'
  | 'order:void_item'
  | 'order:merge'
  | 'order:record_payment'
  | 'order:comp_refund'
  | 'waiter_call:dismiss'
  | 'table:assign'
  | 'table:move'
  | 'menu:mark_out_of_stock'
  | 'menu:edit_items'
  | 'menu:edit_categories'
  | 'settings:edit_printer'
  | 'settings:edit_restaurant'
  | 'settings:edit_floor_plan'
  | 'staff:manage'
  | 'activity:view_log'
  | 'reports:view';

const FLOOR: Set<Permission> = new Set([
  'order:view',
  'order:set_served',
  'waiter_call:dismiss',
  'table:assign',
]);

const KITCHEN: Set<Permission> = new Set([
  'order:view',
  'order:set_preparing',
  'order:set_ready',
  'order:void_item',
  'menu:mark_out_of_stock',
]);

const COUNTER: Set<Permission> = new Set([
  'order:view',
  'order:set_preparing',
  'order:set_ready',
  'order:set_served',
  'order:cancel',
  'order:void_item',
  'order:merge',
  'order:record_payment',
  'order:comp_refund',
  'waiter_call:dismiss',
  'table:assign',
  'table:move',
  'menu:mark_out_of_stock',
  'settings:edit_printer',
]);

const MANAGER: Set<Permission> = new Set([
  'order:view',
  'order:set_preparing',
  'order:set_ready',
  'order:set_served',
  'order:cancel',
  'order:cancel_ready',
  'order:void_item',
  'order:merge',
  'order:record_payment',
  'order:comp_refund',
  'waiter_call:dismiss',
  'table:assign',
  'table:move',
  'menu:mark_out_of_stock',
  'menu:edit_items',
  'menu:edit_categories',
  'settings:edit_printer',
  'settings:edit_restaurant',
  'settings:edit_floor_plan',
  'staff:manage',
  'activity:view_log',
]);

const ROLE_PERMISSIONS: Record<StaffRole, Set<Permission>> = {
  floor: FLOOR,
  kitchen: KITCHEN,
  counter: COUNTER,
  manager: MANAGER,
};

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getPermissions(role: StaffRole): Set<Permission> {
  return ROLE_PERMISSIONS[role] ?? new Set();
}
