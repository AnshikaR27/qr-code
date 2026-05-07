import type { OrderStatus } from '@/types';

export type ServiceMode = 'self_service' | 'table_service';

export function isTerminal(status: OrderStatus, serviceMode: ServiceMode): boolean {
  if (status === 'cancelled') return true;
  if (status === 'served') return true;
  if (status === 'ready' && serviceMode === 'self_service') return true;
  return false;
}

export function isActive(status: OrderStatus, serviceMode: ServiceMode): boolean {
  return !isTerminal(status, serviceMode);
}
