'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Category } from '@/types';

interface CategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (category: Category) => void;
  restaurantId: string;
  editCategory?: Category | null;
}

export default function CategoryManager({
  open,
  onClose,
  onSaved,
  restaurantId,
  editCategory,
}: CategoryFormProps) {
  const [name, setName] = useState(editCategory?.name ?? '');
  const [nameHindi, setNameHindi] = useState(editCategory?.name_hindi ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setName(editCategory?.name ?? '');
      setNameHindi(editCategory?.name_hindi ?? '');
      setError('');
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    setSaving(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const payload = {
        restaurant_id: restaurantId,
        name: name.trim(),
        name_hindi: nameHindi.trim() || null,
      };

      if (editCategory) {
        const { data, error: err } = await supabase
          .from('categories')
          .update({ name: payload.name, name_hindi: payload.name_hindi })
          .eq('id', editCategory.id)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as Category);
        toast.success('Category updated');
      } else {
        const { data, error: err } = await supabase
          .from('categories')
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as Category);
        toast.success('Category added');
      }

      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cat-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Starters"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat-hindi">Hindi / Local Name</Label>
            <Input
              id="cat-hindi"
              value={nameHindi}
              onChange={(e) => setNameHindi(e.target.value)}
              placeholder="e.g. स्टार्टर्स"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editCategory ? 'Save' : 'Add Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
