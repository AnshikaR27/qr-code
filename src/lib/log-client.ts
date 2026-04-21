export function logOwnerActivity(
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, entity_type: entityType, entity_id: entityId, metadata }),
  }).catch(() => {});
}
