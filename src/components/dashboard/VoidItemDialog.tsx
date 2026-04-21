'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { OrderItem } from '@/types';

const QUICK_REASONS = [
  'Customer changed mind',
  'Out of stock',
  'Made incorrectly',
  'Duplicate entry',
];

interface VoidItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  item: OrderItem | null;
  onVoided: () => void;
}

export default function VoidItemDialog({ open, onOpenChange, orderId, item, onVoided }: VoidItemDialogProps) {
  const [action, setAction] = useState<'void' | 'reduce'>('void');
  const [reason, setReason] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('A reason is required');
      return;
    }
    if (action === 'reduce' && newQuantity >= item!.quantity) {
      toast.error('New quantity must be less than current');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/void-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item!.id,
          reason: reason.trim(),
          action,
          ...(action === 'reduce' ? { new_quantity: newQuantity } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to void item');
      }
      toast.success(action === 'void' ? 'Item voided' : 'Quantity reduced');
      onOpenChange(false);
      setReason('');
      setAction('void');
      onVoided();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void / Modify: {item.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAction('void')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                  action === 'void'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50'
                }`}
              >
                Void entirely
              </button>
              {item.quantity > 1 && (
                <button
                  type="button"
                  onClick={() => setAction('reduce')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                    action === 'reduce'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Reduce qty
                </button>
              )}
            </div>
          </div>

          {action === 'reduce' && (
            <div className="space-y-2">
              <Label>New quantity (currently {item.quantity})</Label>
              <Input
                type="number"
                min={1}
                max={item.quantity - 1}
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    reason === r
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-gray-50 text-muted-foreground border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              rows={2}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
              {saving ? 'Processing...' : action === 'void' ? 'Void Item' : 'Reduce Quantity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
