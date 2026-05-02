const KEY_PREFIX = 'sunday:active_order:';

export function setActiveOrder(tableId: string, orderId: string, orderNumber: number, customerName?: string | null) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${KEY_PREFIX}${tableId}`, JSON.stringify({ orderId, orderNumber, customerName: customerName ?? null }));
}

export function getActiveOrder(tableId: string): { orderId: string; orderNumber: number; customerName?: string | null } | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(`${KEY_PREFIX}${tableId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearActiveOrder(tableId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${KEY_PREFIX}${tableId}`);
}
