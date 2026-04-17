'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, X, Leaf, FlameKindling, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SPICE_LEVELS, ALLERGEN_OPTIONS, TAX_CATEGORIES } from '@/lib/constants';
import type { Category, Product, TaxCategory } from '@/types';

// ── Client-side image compression ────────────────────────────────────────────

function compressImage(
  file: File,
  { maxWidth, quality }: { maxWidth: number; quality: number }
): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────

interface DishFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  restaurantId: string;
  categories: Category[];
  editProduct?: Product | null;
}

interface FormState {
  name: string;
  name_hindi: string;
  description: string;
  price: string;
  category_id: string;
  is_veg: boolean;
  is_jain: boolean;
  spice_level: number;
  allergens: string[];
  image_url: string;
  detail_image_url: string;
  tax_category: TaxCategory;
}

function getInitialState(product?: Product | null): FormState {
  if (product) {
    return {
      name: product.name,
      name_hindi: product.name_hindi ?? '',
      description: product.description ?? '',
      price: String(product.price),
      category_id: product.category_id ?? '',
      is_veg: product.is_veg,
      is_jain: product.is_jain === true || product.is_jain === 'Yes',
      spice_level: product.spice_level,
      allergens: product.allergens ?? [],
      image_url: product.image_url ?? '',
      detail_image_url: product.detail_image_url ?? '',
      tax_category: product.tax_category ?? 'food',
    };
  }
  return {
    name: '',
    name_hindi: '',
    description: '',
    price: '',
    category_id: '',
    is_veg: true,
    is_jain: false,
    spice_level: 1,
    allergens: [],
    image_url: '',
    detail_image_url: '',
    tax_category: 'food',
  };
}

export default function DishForm({
  open,
  onClose,
  onSaved,
  restaurantId,
  categories,
  editProduct,
}: DishFormProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(editProduct));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDetail, setUploadingDetail] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiDesc, setIsAiDesc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const detailFileRef = useRef<HTMLInputElement>(null);
  const descriptionManuallyEdited = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared upload logic used by both the file picker and clipboard paste
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Clipboard item is not an image');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
  toast.error('Image must be under 8MB');
  return;
  }
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 3840, quality: 1 });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setForm((prev) => ({ ...prev, image_url: data.url }));
      toast.success('Image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const uploadDetailFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File is not an image');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB');
      return;
    }
    setUploadingDetail(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 3840, quality: 1 });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setForm((prev) => ({ ...prev, detail_image_url: data.url }));
      toast.success('Detail image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDetail(false);
    }
  }, []);

  // Reset AI state when dialog opens/closes
  useEffect(() => {
    if (open) {
      descriptionManuallyEdited.current = !!editProduct?.description;
      setIsAiDesc(false);
    }
  }, [open, editProduct]);

  // AI description generation
  const generateDescription = useCallback(async (force = false) => {
    if (descriptionManuallyEdited.current && !force) return;
    const name = form.name.trim();
    if (name.length < 2) return;
    const categoryName = categories.find((c) => c.id === form.category_id)?.name;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishName: name, categoryName }),
      });
      if (!res.ok) return;
      const data = await res.json() as { description?: string };
      if (data.description) {
        setForm((prev) => ({ ...prev, description: data.description! }));
        setIsAiDesc(true);
        descriptionManuallyEdited.current = false;
      }
    } catch {
      // silently ignore
    } finally {
      setIsGenerating(false);
    }
  }, [form.name, form.category_id, categories]);

  // Debounced auto-generate on dish name change (new dishes only)
  useEffect(() => {
    if (editProduct) return; // don't auto-generate in edit mode
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      generateDescription();
    }, 800);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  // Listen for Ctrl+V paste when the dialog is open
  useEffect(() => {
    if (!open) return;

    function handlePaste(e: ClipboardEvent) {
      // Don't intercept paste inside text inputs / textareas
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            uploadFile(file);
          }
          break;
        }
      }
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, uploadFile]);

  // Reset form when dialog opens/closes or editProduct changes
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setForm(getInitialState(editProduct));
      setErrors({});
      onClose();
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toggleAllergen(value: string) {
    setForm((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(value)
        ? prev.allergens.filter((a) => a !== value)
        : [...prev.allergens, value],
    }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    const price = parseFloat(form.price);
    if (!form.price || isNaN(price) || price <= 0) errs.price = 'Enter a valid price';
    if (price > 99999) errs.price = 'Price too high';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDetailImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDetailFile(file);
    if (detailFileRef.current) detailFileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const payload = {
        restaurant_id: restaurantId,
        name: form.name.trim(),
        name_hindi: form.name_hindi.trim() || null,
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        category_id: form.category_id || null,
        is_veg: form.is_veg,
        is_jain: form.is_jain,
        spice_level: form.spice_level,
        allergens: form.allergens,
        image_url: form.image_url || null,
        detail_image_url: form.detail_image_url || null,
        tax_category: form.tax_category,
      };

      if (editProduct) {
        const { data, error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editProduct.id)
          .select()
          .single();
        if (error) throw error;
        onSaved(data as Product);
        toast.success('Dish updated');
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        onSaved(data as Product);
        toast.success('Dish added');
      }

      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save dish');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProduct ? 'Edit Dish' : 'Add Dish'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-2">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="dish-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="dish-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Paneer Butter Masala"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Hindi name */}
          <div className="space-y-1">
            <Label htmlFor="dish-hindi">Hindi / Local Name</Label>
            <Input
              id="dish-hindi"
              value={form.name_hindi}
              onChange={(e) => set('name_hindi', e.target.value)}
              placeholder="e.g. पनीर बटर मसाला"
            />
          </div>

          {/* Price + Category in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dish-price">Price (₹) <span className="text-destructive">*</span></Label>
              <Input
                id="dish-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="180"
              />
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category_id || 'none'}
                onValueChange={(v) => set('category_id', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="dish-desc">Description</Label>
              <div className="flex items-center gap-2">
                {isAiDesc && !isGenerating && (
                  <span className="text-xs text-violet-600 font-medium">✨ AI generated</span>
                )}
                {(form.name.trim().length >= 2) && (
                  <button
                    type="button"
                    onClick={() => {
                      descriptionManuallyEdited.current = false;
                      generateDescription(true);
                    }}
                    disabled={isGenerating}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors disabled:opacity-40"
                    title="Regenerate description"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isGenerating && 'animate-spin')} />
                  </button>
                )}
              </div>
            </div>
            {isGenerating ? (
              <div className="h-16 rounded-md border bg-gray-50 flex items-center px-3 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Generating description…</span>
              </div>
            ) : (
              <Textarea
                id="dish-desc"
                value={form.description}
                onChange={(e) => {
                  descriptionManuallyEdited.current = true;
                  setIsAiDesc(false);
                  set('description', e.target.value);
                }}
                placeholder="Short description (optional)"
                rows={2}
              />
            )}
          </div>

          {/* Tax Category */}
          <div className="space-y-1">
            <Label>Tax Category</Label>
            <Select value={form.tax_category} onValueChange={(v) => set('tax_category', v as TaxCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_CATEGORIES.map((tc) => (
                  <SelectItem key={tc.value} value={tc.value}>
                    <div>
                      <span className="font-medium">{tc.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{tc.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TAX_CATEGORIES.find((t) => t.value === form.tax_category)?.hint}
            </p>
          </div>

          {/* Veg / Jain toggles */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => set('is_veg', !form.is_veg)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
                form.is_veg
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-red-50 border-red-400 text-red-700'
              )}
            >
              <Leaf className="w-3.5 h-3.5" />
              {form.is_veg ? 'Veg' : 'Non-Veg'}
            </button>
            <button
              type="button"
              onClick={() => set('is_jain', !form.is_jain)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
                form.is_jain
                  ? 'bg-amber-50 border-amber-500 text-amber-700'
                  : 'bg-gray-50 border-gray-300 text-gray-600'
              )}
            >
              Jain {form.is_jain ? 'Yes' : 'No'}
            </button>
          </div>

          {/* Spice level */}
          <div className="space-y-1">
            <Label>Spice Level</Label>
            <div className="flex gap-2">
              {SPICE_LEVELS.map((sl) => (
                <button
                  key={sl.value}
                  type="button"
                  onClick={() => set('spice_level', sl.value)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors',
                    form.spice_level === sl.value
                      ? 'bg-orange-50 border-orange-400 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {sl.emoji || <FlameKindling className="w-3 h-3 mx-auto opacity-30" />}
                  <span className="block mt-0.5">{sl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div className="space-y-1">
            <Label>Allergens</Label>
            <div className="flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => toggleAllergen(a.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                    form.allergens.includes(a.value)
                      ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Browse image upload */}
          <div className="space-y-1">
            <Label>Browse Photo</Label>
            <p className="text-xs text-muted-foreground">Top-down or hero shot shown in the menu list</p>
            {form.image_url ? (
              <div className="relative w-24 h-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="Dish"
                  className="w-24 h-24 object-cover rounded-md border"
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, image_url: '', detail_image_url: '' }))}
                  className="absolute -top-1.5 -right-1.5 bg-white border rounded-full p-0.5 shadow-sm hover:bg-red-50"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'border border-dashed rounded-md transition-colors',
                  uploading ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'
                )}
                onClick={() => !uploading && fileRef.current?.click()}
              >
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  ) : (
                    <Upload className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{uploading ? 'Uploading…' : 'Upload photo'}</span>
                  {!uploading && (
                    <span className="ml-1 text-xs text-muted-foreground/60 border border-dashed rounded px-1.5 py-0.5 font-mono">
                      Ctrl+V to paste
                    </span>
                  )}
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          {/* Detail image upload (optional close-up shown on product detail page) */}
          <div className="space-y-1">
            <Label>Detail Photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <p className="text-xs text-muted-foreground">Close-up shown when customer taps the dish. Falls back to browse photo if not set.</p>
            {form.detail_image_url ? (
              <div className="relative w-24 h-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.detail_image_url}
                  alt="Detail"
                  className="w-24 h-24 object-cover rounded-md border"
                />
                <button
                  type="button"
                  onClick={() => set('detail_image_url', '')}
                  className="absolute -top-1.5 -right-1.5 bg-white border rounded-full p-0.5 shadow-sm hover:bg-red-50"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'border border-dashed rounded-md transition-colors',
                  (!form.image_url || uploadingDetail) ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'
                )}
                onClick={() => form.image_url && !uploadingDetail && detailFileRef.current?.click()}
              >
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  {uploadingDetail ? (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  ) : (
                    <Upload className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>
                    {uploadingDetail ? 'Uploading…' : form.image_url ? 'Upload close-up' : 'Add browse photo first'}
                  </span>
                </div>
              </div>
            )}
            <input
              ref={detailFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleDetailImageUpload}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editProduct ? 'Save Changes' : 'Add Dish'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
