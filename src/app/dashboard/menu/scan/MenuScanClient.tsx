'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  Scan,
  Trash2,
  Save,
  ChevronLeft,
  Leaf,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Category, Restaurant } from '@/types';
import type { ScannedDish } from '@/lib/ai-scanner';

interface Props {
  restaurant: Restaurant;
  existingCategories: Category[];
}

interface EditableRow extends ScannedDish {
  _id: string; // local key
  _selected: boolean;
}

export default function MenuScanClient({ restaurant, existingCategories }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setSaving] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSavingAll] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setRows([]);
    setSavedCount(null);
  }

  async function handleScan() {
    if (!fileRef.current?.files?.[0]) {
      toast.error('Please select an image first');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', fileRef.current.files[0]);
      const res = await fetch('/api/menu-scan', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan failed');

      const scanned: ScannedDish[] = data.dishes;
      setRows(
        scanned.map((d, i) => ({
          ...d,
          name_hindi: d.name_hindi ?? null,
          description: d.description ?? null,
          _id: `row-${i}-${Date.now()}`,
          _selected: true,
        }))
      );
      toast.success(`Found ${scanned.length} dish${scanned.length !== 1 ? 'es' : ''}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setSaving(false);
    }
  }

  function updateRow(id: string, field: keyof ScannedDish, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
    );
  }

  function toggleRow(id: string) {
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, _selected: !r._selected } : r))
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r._id !== id));
  }

  async function saveAll() {
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) {
      toast.error('No dishes selected');
      return;
    }

    setSavingAll(true);
    try {
      const supabase = createClient();

      // Build a map of category name → id (create new ones as needed)
      const categoryMap: Record<string, string> = {};
      for (const cat of existingCategories) {
        categoryMap[cat.name.toLowerCase()] = cat.id;
      }

      // Collect unique new category names
      const newCategoryNames = Array.from(
        new Set(
          selected
            .map((r) => r.category)
            .filter((c) => !categoryMap[c.toLowerCase()])
        )
      );

      // Insert new categories
      if (newCategoryNames.length > 0) {
        const { data: newCats, error } = await supabase
          .from('categories')
          .insert(
            newCategoryNames.map((name) => ({
              restaurant_id: restaurant.id,
              name,
            }))
          )
          .select();
        if (error) throw error;
        for (const cat of newCats ?? []) {
          categoryMap[cat.name.toLowerCase()] = cat.id;
        }
      }

      // Insert products
      const products = selected.map((r) => ({
        restaurant_id: restaurant.id,
        name: r.name.trim(),
        name_hindi: r.name_hindi?.trim() || null,
        description: r.description?.trim() || null,
        price: r.price,
        category_id: categoryMap[r.category.toLowerCase()] ?? null,
        is_veg: r.is_veg,
        is_jain: false,
        spice_level: 1,
        allergens: [],
        is_available: true,
      }));

      const { error: prodErr } = await supabase.from('products').insert(products);
      if (prodErr) throw prodErr;

      setSavedCount(selected.length);
      toast.success(`${selected.length} dish${selected.length !== 1 ? 'es' : ''} saved to your menu!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save dishes');
    } finally {
      setSavingAll(false);
    }
  }

  const selectedCount = rows.filter((r) => r._selected).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/dashboard/menu')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scan className="w-6 h-6" />
            AI Menu Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a photo of your menu — AI will extract all dishes
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Preview */}
          <div
            className={cn(
              'relative flex-shrink-0 w-full sm:w-48 h-48 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors',
              preview && 'border-solid border-gray-200'
            )}
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Menu preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground px-4 text-center">
                <Upload className="w-8 h-8 opacity-40" />
                <span className="text-sm">Click to upload menu photo</span>
                <span className="text-xs">JPG, PNG, WEBP, AVIF · max 10MB</span>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,.avif"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-col gap-3 flex-1">
            <p className="text-sm text-muted-foreground">
              Take a clear photo of your printed menu or upload an existing image.
              The AI will extract dish names, prices, and categories automatically.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {preview ? 'Change Photo' : 'Select Photo'}
              </Button>
              <Button
                onClick={handleScan}
                disabled={!preview || scanning}
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning…
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4 mr-2" />
                    Scan with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Success state */}
      {savedCount !== null && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">
              {savedCount} dish{savedCount !== 1 ? 'es' : ''} added to your menu!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              New categories were created automatically where needed.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/menu')}>
            View Menu
          </Button>
        </div>
      )}

      {/* Extracted dishes table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="font-semibold">
                {rows.length} dish{rows.length !== 1 ? 'es' : ''} found
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Edit anything that looks wrong, then click Save All
              </p>
            </div>
            <Button
              onClick={saveAll}
              disabled={saving || selectedCount === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save {selectedCount} dish{selectedCount !== 1 ? 'es' : ''}
                </>
              )}
            </Button>
          </div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_80px_80px_80px_40px] gap-2 px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span />
            <span>Name</span>
            <span>Category</span>
            <span>Price (₹)</span>
            <span>Hindi</span>
            <span>Veg?</span>
            <span />
          </div>

          <ul className="divide-y">
            {rows.map((row) => (
              <li
                key={row._id}
                className={cn(
                  'grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_80px_80px_80px_40px] gap-2 px-4 py-3 items-center',
                  !row._selected && 'opacity-40'
                )}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={row._selected}
                  onChange={() => toggleRow(row._id)}
                  className="w-4 h-4 cursor-pointer"
                />

                {/* Name */}
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(row._id, 'name', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Dish name"
                />

                {/* Category */}
                <Input
                  value={row.category}
                  onChange={(e) => updateRow(row._id, 'category', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Category"
                />

                {/* Price */}
                <Input
                  type="number"
                  value={row.price}
                  onChange={(e) =>
                    updateRow(row._id, 'price', parseFloat(e.target.value) || 0)
                  }
                  className="h-8 text-sm"
                  min="0"
                />

                {/* Hindi name */}
                <Input
                  value={row.name_hindi ?? ''}
                  onChange={(e) => updateRow(row._id, 'name_hindi', e.target.value || null)}
                  className="h-8 text-sm"
                  placeholder="हिंदी"
                />

                {/* Veg toggle */}
                <button
                  type="button"
                  onClick={() => updateRow(row._id, 'is_veg', !row.is_veg)}
                  className={cn(
                    'flex items-center justify-center gap-1 h-8 px-2 rounded-md border text-xs font-medium transition-colors',
                    row.is_veg
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-red-50 border-red-400 text-red-700'
                  )}
                >
                  <Leaf className="w-3 h-3" />
                  {row.is_veg ? 'Veg' : 'NV'}
                </button>

                {/* Delete row */}
                <button
                  onClick={() => removeRow(row._id)}
                  className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
