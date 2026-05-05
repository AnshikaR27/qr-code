import type { OrderStatus } from '@/types';

const KEY = 'sunday:tracked_orders';

export interface TrackedOrder {
  orderId: string;
  orderNumber: number;
  customerName: string | null;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: OrderStatus;
  placedAt: string;
}

export function getTrackedOrders(): TrackedOrder[] {
  if (typeof window === 'undefined') return [];
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function addTrackedOrder(order: TrackedOrder) {
  const orders = getTrackedOrders().filter(o => o.orderId !== order.orderId);
  orders.unshift(order);
  sessionStorage.setItem(KEY, JSON.stringify(orders));
}

export function updateTrackedOrderStatus(orderId: string, status: OrderStatus) {
  const orders = getTrackedOrders();
  const order = orders.find(o => o.orderId === orderId);
  if (!order) return;
  order.status = status;
  sessionStorage.setItem(KEY, JSON.stringify(orders));
}

export function removeTrackedOrder(orderId: string) {
  const orders = getTrackedOrders().filter(o => o.orderId !== orderId);
  sessionStorage.setItem(KEY, JSON.stringify(orders));
}
