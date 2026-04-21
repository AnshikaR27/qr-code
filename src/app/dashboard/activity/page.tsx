'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActivityLogEntry } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  'order.placed': 'Placed order',
  'order.status_changed': 'Changed order status',
  'order.cancelled': 'Cancelled order',
  'order.payment_recorded': 'Recorded payment',
  'item.voided': 'Voided item',
  'item.quantity_reduced': 'Reduced item quantity',
  'staff.created': 'Created staff',
  'staff.updated': 'Updated staff',
  'staff.deleted': 'Deleted staff',
  'staff.login': 'Staff logged in',
  'staff.logout': 'Staff logged out',
};

const ACTOR_COLORS: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  customer: 'bg-purple-100 text-purple-700',
  system: 'bg-gray-100 text-gray-700',
};

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actorFilter, setActorFilter] = useState<string | null>(null);
  const limit = 50;

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actorFilter) params.set('actor_type', actorFilter);

      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, actorFilter]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} event{total !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchActivity} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'owner', 'staff', 'customer'].map((f) => (
          <button
            key={f}
            onClick={() => { setActorFilter(f === 'all' ? null : f); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              (f === 'all' && !actorFilter) || actorFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white text-muted-foreground">
          No activity recorded yet
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 p-3 bg-white border rounded-lg">
              <Badge variant="outline" className={`text-[10px] mt-0.5 ${ACTOR_COLORS[entry.actor_type] ?? ''}`}>
                {entry.actor_type}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{entry.actor_name ?? entry.actor_type}</span>
                  {' '}
                  <span className="text-muted-foreground">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  {entry.entity_id && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({entry.entity_type} {entry.entity_id.slice(0, 8)}...)
                    </span>
                  )}
                </p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Object.entries(entry.metadata)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
