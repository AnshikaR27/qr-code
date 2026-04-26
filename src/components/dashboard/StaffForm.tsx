'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { StaffMember, StaffRole } from '@/types';

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'floor', label: 'Floor' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'counter', label: 'Counter' },
  { value: 'manager', label: 'Manager' },
];

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  floor: 'Take orders, deliver food, manage tables',
  kitchen: 'Mark orders ready, mark items out of stock',
  counter: 'Take payment, mark orders delivered',
  manager: 'Everything floor + kitchen + counter can do, plus cancel orders, edit menu, view reports',
};

interface StaffFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffMember | null;
  onSaved: () => void;
}

export default function StaffForm({ open, onOpenChange, staff, onSaved }: StaffFormProps) {
  const isEdit = !!staff;
  const [name, setName] = useState(staff?.name ?? '');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'floor');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName(staff?.name ?? '');
    setPin('');
    setRole(staff?.role ?? 'floor');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEdit) {
        const body: Record<string, unknown> = { id: staff.id, name, role };
        if (pin) body.pin = pin;

        const res = await fetch('/api/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update');
        }
        toast.success('Staff updated');
      } else {
        if (!pin || pin.length < 4) {
          toast.error('PIN must be 4-6 digits');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin, role }) });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create');
        }
        toast.success('Staff created');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) resetForm(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-pin">
              {isEdit ? 'New PIN (leave blank to keep current)' : 'PIN (4-6 digits)'}
            </Label>
            <Input
              id="staff-pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required={!isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`w-full py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                    role === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
