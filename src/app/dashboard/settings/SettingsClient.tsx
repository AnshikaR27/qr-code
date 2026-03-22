'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, ExternalLink, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  opening_time: string;
  closing_time: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
}

function toForm(r: Restaurant): FormState {
  return {
    name: r.name,
    phone: r.phone ?? '',
    address: r.address ?? '',
    city: r.city ?? '',
    opening_time: r.opening_time ?? '09:00',
    closing_time: r.closing_time ?? '23:00',
    primary_color: r.primary_color,
    secondary_color: r.secondary_color,
    logo_url: r.logo_url ?? '',
  };
}

export default function SettingsClient({ restaurant }: Props) {
  const [form, setForm] = useState<FormState>(toForm(restaurant));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Restaurant name is required';
    if (form.phone && (form.phone.length < 10 || form.phone.length > 15))
      errs.phone = 'Enter a valid phone number';
    if (!/^#[0-9a-fA-F]{6}$/.test(form.primary_color))
      errs.primary_color = 'Enter a valid hex color';
    if (!/^#[0-9a-fA-F]{6}$/.test(form.secondary_color))
      errs.secondary_color = 'Enter a valid hex color';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    setUploading(true);
    try {
      // Upload to Cloudinary
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      set('logo_url', data.url);

      // Extract dominant colors from the uploaded image using colorthief
      await extractColors(file);

      toast.success('Logo uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function extractColors(file: File) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ColorThief = (await import('colorthief') as any).default ?? (await import('colorthief'));
          const ct = new ColorThief();
          const palette = ct.getPalette(img, 2);
          if (palette?.[0]) {
            const [r1, g1, b1] = palette[0];
            set('primary_color', rgbToHex(r1, g1, b1));
          }
          if (palette?.[1]) {
            const [r2, g2, b2] = palette[1];
            set('secondary_color', rgbToHex(r2, g2, b2));
          }
          toast.success('Colors extracted from logo');
        } catch {
          // Color extraction failed — not critical
        } finally {
          URL.revokeObjectURL(url);
          resolve();
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          opening_time: form.opening_time,
          closing_time: form.closing_time,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          logo_url: form.logo_url || null,
        })
        .eq('id', restaurant.id);

      if (error) throw error;
      toast.success('Settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Restaurant info, branding, and opening hours
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Restaurant Info ── */}
        <Section title="Restaurant Info">
          <Field label="Restaurant Name *" error={errors.name}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Kanishka Cuisine of India" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone}>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main Street, Area" />
          </Field>
        </Section>

        {/* ── Hours ── */}
        <Section title="Opening Hours">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Opens at">
              <Input type="time" value={form.opening_time} onChange={(e) => set('opening_time', e.target.value)} />
            </Field>
            <Field label="Closes at">
              <Input type="time" value={form.closing_time} onChange={(e) => set('closing_time', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── Logo & Colors ── */}
        <Section title="Logo & Brand Colors">
          <div className="flex gap-6 items-start">
            {/* Logo */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50"
                onClick={() => fileRef.current?.click()}
              >
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="w-6 h-6 opacity-40" />
                    <span className="text-xs">Logo</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            {/* Colors */}
            <div className="flex-1 space-y-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                Colors are auto-extracted when you upload a logo, or set them manually below.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Primary Color" error={errors.primary_color}>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={(e) => set('primary_color', e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer p-0.5"
                    />
                    <Input
                      value={form.primary_color}
                      onChange={(e) => set('primary_color', e.target.value)}
                      placeholder="#e94560"
                      className="font-mono text-sm"
                    />
                  </div>
                </Field>
                <Field label="Secondary Color" error={errors.secondary_color}>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.secondary_color}
                      onChange={(e) => set('secondary_color', e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer p-0.5"
                    />
                    <Input
                      value={form.secondary_color}
                      onChange={(e) => set('secondary_color', e.target.value)}
                      placeholder="#1a1a2e"
                      className="font-mono text-sm"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Theme Preview ── */}
        <Section title="Theme Preview">
          <div className="rounded-xl overflow-hidden border">
            {/* Mock menu header */}
            <div
              className="py-5 px-4 flex flex-col items-center gap-2"
              style={{ backgroundColor: form.secondary_color }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white/30"
                style={{ backgroundColor: form.primary_color }}
              >
                {form.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-white font-bold">{form.name || 'Your Restaurant'}</p>
              {form.city && <p className="text-white/70 text-sm">{form.city}</p>}
            </div>
            {/* Mock category tab */}
            <div className="bg-white border-b px-4 py-2 flex gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: form.primary_color }}
              >
                Starters
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium text-gray-500 border">
                Main Course
              </span>
            </div>
            {/* Mock dish card */}
            <div className="bg-gray-50 p-3">
              <div className="bg-white rounded-lg border p-3 flex justify-between items-center gap-3">
                <div>
                  <p className="text-sm font-semibold">Paneer Butter Masala</p>
                  <p className="text-xs text-gray-500">पनीर बटर मसाला</p>
                  <p className="text-sm font-bold mt-1">₹280</p>
                </div>
                <button
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: form.primary_color }}
                >
                  ADD
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            This is how your menu looks to customers.
            <a
              href={`/${restaurant.slug}`}
              target="_blank"
              className="underline inline-flex items-center gap-0.5 hover:no-underline"
            >
              Open live menu <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </Section>

        {/* Save button */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving} className="px-8">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className={cn(error && 'text-destructive')}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
