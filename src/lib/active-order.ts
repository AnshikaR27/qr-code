const KEY_PREFIX = 'sunday:active_order:';

export function setActiveOrder(tableId: string, orderId: string, orderNumber: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${KEY_PREFIX}${tableId}`, JSON.stringify({ orderId, orderNumber }));
}

export function getActiveOrder(tableId: string): { orderId: string; orderNumber: number } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`${KEY_PREFIX}${tableId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearActiveOrder(tableId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${KEY_PREFIX}${tableId}`);
}
