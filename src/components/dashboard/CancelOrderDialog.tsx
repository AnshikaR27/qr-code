'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { OrderStatus } from '@/types';

const QUICK_REASONS = [
  'Customer changed mind',
  'Out of stock',
  'Kitchen issue',
  'Duplicate order',
];

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: number;
  orderStatus: OrderStatus;
  onConfirmed: (reason: string) => void;
}

const STATUS_COPY: Record<string, { title: string; description: string }> = {
  placed: {
    title: 'Cancel this order?',
    description: 'The order has not started preparation yet.',
  },
  preparing: {
    title: 'This order is being prepared',
    description: 'Ingredients may already be in use. Cancelling now means wasted food and prep time. Cancel anyway?',
  },
  ready: {
    title: 'Food is already made',
    description: 'This will need to be discarded or comped. Manager approval is required to cancel a ready order.',
  },
};

export default function CancelOrderDialog({
  open, onOpenChange, orderNumber, orderStatus, onConfirmed,
}: CancelOrderDialogProps) {
  const [reason, setReason] = useState('');
  const copy = STATUS_COPY[orderStatus] ?? STATUS_COPY.placed;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirmed(reason.trim());
    onOpenChange(false);
    setReason('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {copy.title} — Order #{orderNumber}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Keep Order
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim()}
              className={orderStatus === 'ready' ? 'bg-red-700 hover:bg-red-800' : ''}
            >
              {orderStatus === 'ready' ? 'Cancel (Manager Override)' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
