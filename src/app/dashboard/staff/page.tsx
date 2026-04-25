'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StaffForm from '@/components/dashboard/StaffForm';
import type { StaffMember } from '@/types';

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      if (!res.ok) throw new Error();
      setStaff(await res.json());
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  async function toggleActive(s: StaffMember) {
    const res = await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
    });
    if (!res.ok) { toast.error('Failed to update'); return; }
    toast.success(s.is_active ? 'Staff deactivated' : 'Staff activated');
    fetchStaff();
  }

  async function deleteStaff(s: StaffMember) {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/staff?id=${s.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    toast.success('Staff deleted');
    fetchStaff();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team. Staff log in with a PIN at the staff portal.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <p className="text-muted-foreground mb-4">No staff members yet</p>
          <Button variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add your first staff member
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-4 bg-white border rounded-lg ${
                !s.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    s.role === 'waiter' ? 'bg-blue-500' : s.role === 'counter' ? 'bg-indigo-500' : 'bg-orange-500'
                  }`}
                >
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{s.name}</p>
                  <div className="flex gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs capitalize">
                      {s.role}
                    </Badge>
                    {!s.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title={s.is_active ? 'Deactivate' : 'Activate'}
                  onClick={() => toggleActive(s)}
                >
                  {s.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit"
                  onClick={() => { setEditing(s); setFormOpen(true); }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  onClick={() => deleteStaff(s)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StaffForm
        open={formOpen}
        onOpenChange={setFormOpen}
        staff={editing}
        onSaved={fetchStaff}
      />
    </div>
  );
}
