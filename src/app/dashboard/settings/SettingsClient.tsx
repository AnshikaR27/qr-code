'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, ExternalLink, RefreshCw } from 'lucide-react';
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
  logo_url: string;
  stitch_project_id: string;
}

function toForm(r: Restaurant): FormState {
  return {
    name: r.name,
    phone: r.phone ?? '',
    address: r.address ?? '',
    city: r.city ?? '',
    opening_time: r.opening_time ?? '09:00',
    closing_time: r.closing_time ?? '23:00',
    logo_url: r.logo_url ?? '',
    stitch_project_id: r.stitch_project_id ?? '',
  };
}

export default function SettingsClient({ restaurant }: Props) {
  const [form, setForm] = useState<FormState>(toForm(restaurant));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [applyingMd, setApplyingMd] = useState(false);
  const [mdText, setMdText] = useState('');
  const [syncedTokens, setSyncedTokens] = useState<Record<string, string> | null>(
    restaurant.design_tokens
  );
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
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      set('logo_url', data.url);
      toast.success('Logo uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSyncTheme() {
    if (!form.stitch_project_id.trim()) {
      toast.error('Enter a Stitch Project ID first');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: form.stitch_project_id.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setSyncedTokens(data.tokens);
      toast.success('Theme synced from Stitch');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleApplyMarkdown() {
    const tokens = parseStitchMarkdown(mdText);
    if (Object.keys(tokens).length === 0) {
      toast.error('No color tokens found in the markdown');
      return;
    }
    setApplyingMd(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('restaurants')
        .update({ design_tokens: tokens })
        .eq('id', restaurant.id);
      if (error) throw error;
      setSyncedTokens(tokens);
      toast.success('Theme applied from markdown');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply theme');
    } finally {
      setApplyingMd(false);
    }
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
          logo_url: form.logo_url || null,
          stitch_project_id: form.stitch_project_id.trim() || null,
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

  const COLOR_TOKEN_KEYS = ['--primary', '--secondary', '--accent', '--bg', '--card-bg', '--text', '--text-muted'];

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

        {/* ── Logo ── */}
        <Section title="Logo">
          <div className="flex items-center gap-6">
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
            <p className="text-sm text-muted-foreground">
              Upload your restaurant logo. After uploading, paste your Stitch Project ID below to sync a matching color theme.
            </p>
          </div>
        </Section>

        {/* ── Stitch Theme ── */}
        <Section title="Theme — Powered by Stitch">
          <p className="text-xs text-muted-foreground">
            Paste your Stitch Project ID to sync the color palette and typography directly from your Stitch design.
          </p>
          <div className="flex gap-2 items-end">
            <Field label="Stitch Project ID" error={errors.stitch_project_id} className="flex-1">
              <Input
                value={form.stitch_project_id}
                onChange={(e) => set('stitch_project_id', e.target.value)}
                placeholder="e.g. 10574594618962961646"
                className="font-mono text-sm"
              />
            </Field>
            <Button
              onClick={handleSyncTheme}
              disabled={syncing}
              className="mb-[1px]"
            >
              {syncing
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : <RefreshCw className="w-4 h-4 mr-1" />}
              {syncing ? 'Syncing…' : 'Sync Theme'}
            </Button>
          </div>

          {/* Markdown paste alternative */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">or paste design system markdown</span>
            </div>
          </div>
          <Field label="Stitch Design System Markdown">
            <textarea
              value={mdText}
              onChange={(e) => setMdText(e.target.value)}
              placeholder="Paste the markdown generated by Stitch…"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
          <Button
            variant="outline"
            onClick={handleApplyMarkdown}
            disabled={applyingMd || !mdText.trim()}
          >
            {applyingMd
              ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
              : <RefreshCw className="w-4 h-4 mr-1" />}
            {applyingMd ? 'Applying…' : 'Apply from Markdown'}
          </Button>

          {/* Color swatch preview */}
          {syncedTokens && Object.keys(syncedTokens).length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Synced Colors</p>
              <div className="flex flex-wrap gap-3">
                {COLOR_TOKEN_KEYS.map((key) => {
                  const value = syncedTokens[key];
                  if (!value) return null;
                  return (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <div
                        className="w-10 h-10 rounded-lg border shadow-sm"
                        style={{ backgroundColor: value }}
                        title={value}
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">{key.replace('--', '')}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl overflow-hidden border mt-2">
                <div
                  className="py-4 px-4 flex flex-col items-center gap-1"
                  style={{
                    background: `linear-gradient(135deg, ${syncedTokens['--secondary'] ?? '#3E2B1A'}, ${syncedTokens['--primary'] ?? '#8B6914'})`,
                  }}
                >
                  {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
                  ) : (
                    <p className="text-white font-bold">{form.name || 'Your Restaurant'}</p>
                  )}
                  {form.city && <p className="text-white/70 text-xs">{form.city}</p>}
                </div>
                <div
                  className="p-3"
                  style={{ backgroundColor: syncedTokens['--bg'] ?? '#FFF8F0' }}
                >
                  <div
                    className="rounded-lg p-3 flex justify-between items-center gap-3 border"
                    style={{
                      backgroundColor: syncedTokens['--card-bg'] ?? '#fff',
                      borderColor: `${syncedTokens['--text'] ?? '#1D1208'}15`,
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: syncedTokens['--text'] ?? '#1D1208' }}>
                        Paneer Butter Masala
                      </p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: syncedTokens['--text'] ?? '#1D1208' }}>
                        ₹280
                      </p>
                    </div>
                    <button
                      className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: syncedTokens['--primary'] ?? '#8B6914' }}
                    >
                      ADD
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Save button */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving} className="px-8">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
          <a
            href={`/${restaurant.slug}`}
            target="_blank"
            className="ml-3 inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:no-underline"
          >
            View menu <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseStitchMarkdown(md: string): Record<string, string> {
  const tokens: Record<string, string> = {};

  function extractHex(pattern: RegExp): string | undefined {
    const m = md.match(pattern);
    return m ? `#${m[1]}` : undefined;
  }

  const primary = extractHex(/\bprimary\b[^#\n]{0,40}#([0-9a-fA-F]{6})/i);
  if (primary) tokens['--primary'] = primary;

  const secondary = extractHex(/\bsecondary\b[^#\n]{0,40}#([0-9a-fA-F]{6})/i);
  if (secondary) tokens['--secondary'] = secondary;

  // Surface but not surface-container variants
  const bg = extractHex(/\bSurface\b(?!-)[^#\n]{0,40}#([0-9a-fA-F]{6})/i);
  if (bg) tokens['--bg'] = bg;

  const cardBg =
    extractHex(/surface-container-lowest[^#\n]{0,40}#([0-9a-fA-F]{6})/i) ??
    extractHex(/#([0-9a-fA-F]{6})[^#\n]{0,40}surface-container-lowest/i);
  if (cardBg) tokens['--card-bg'] = cardBg;

  const text =
    extractHex(/\bon-surface\b(?!-variant)[^#\n]{0,40}#([0-9a-fA-F]{6})/i) ??
    extractHex(/#([0-9a-fA-F]{6})[^#\n]{0,40}\bon-surface\b(?!-variant)/i);
  if (text) tokens['--text'] = text;

  const textMuted = extractHex(/on-surface-variant[^#\n]{0,40}#([0-9a-fA-F]{6})/i);
  if (textMuted) tokens['--text-muted'] = textMuted;

  const accent =
    extractHex(/secondary-container[^#\n]{0,40}#([0-9a-fA-F]{6})/i) ??
    extractHex(/\baccent\b[^#\n]{0,40}#([0-9a-fA-F]{6})/i);
  if (accent) tokens['--accent'] = accent;

  const headingFont = md.match(/\*\*\s*(?:Display|Headline)[^*\n]*\(([^)]+)\)/i);
  if (headingFont) tokens['--font-heading'] = `'${headingFont[1].trim()}', sans-serif`;

  const bodyFont = md.match(/\*\*\s*(?:Body|Label)[^*\n]*\(([^)]+)\)/i);
  if (bodyFont) tokens['--font-body'] = `'${bodyFont[1].trim()}', sans-serif`;

  const radius = md.match(/\bmd\b[^(\n]{0,30}\(([0-9.]+rem)\)/i);
  if (radius) tokens['--radius'] = radius[1];

  return tokens;
}

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
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className={cn(error && 'text-destructive')}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
