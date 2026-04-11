'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { INDIAN_STATES } from '@/lib/constants';
import PrinterSettings from '@/components/dashboard/PrinterSettings';
import type { BillingConfig, Category, Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  opening_time: string;
  closing_time: string;
  logo_url: string;
  hero_image_url: string;
  tagline: string;
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
    hero_image_url: r.hero_image_url ?? '',
    tagline: r.tagline ?? '',
    stitch_project_id: r.stitch_project_id ?? '',
  };
}

const DEFAULT_BILLING: BillingConfig = {
  gstin: '',
  fssai: '',
  gst_rate: 5,
  service_charge_enabled: false,
  service_charge_percent: 10,
  sac_code: '996331',
  legal_name: '',
  billing_address: '',
  state: '',
};

function toBillingForm(r: Restaurant): BillingConfig {
  return {
    ...DEFAULT_BILLING,
    ...(r.billing_config ?? {}),
  };
}

export default function SettingsClient({ restaurant, categories }: Props) {
  const [form, setForm] = useState<FormState>(toForm(restaurant));
  const [billing, setBilling] = useState<BillingConfig>(() => toBillingForm(restaurant));
  const [billingErrors, setBillingErrors] = useState<Record<string, string>>({});
  const [uiTheme, setUiTheme] = useState<'classic' | 'sunday'>(restaurant.ui_theme ?? 'classic');
  const [serviceMode, setServiceMode] = useState<'self_service' | 'table_service'>(restaurant.service_mode ?? 'self_service');
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
  const heroFileRef = useRef<HTMLInputElement>(null);
  const [uploadingHero, setUploadingHero] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function setBill<K extends keyof BillingConfig>(key: K, value: BillingConfig[K]) {
    setBilling((prev) => ({ ...prev, [key]: value }));
    setBillingErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Restaurant name is required';
    if (form.phone && (form.phone.length < 10 || form.phone.length > 15))
      errs.phone = 'Enter a valid phone number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateBilling(): boolean {
    const errs: Record<string, string> = {};
    if (billing.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(billing.gstin)) {
      errs.gstin = 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)';
    }
    if (billing.fssai && !/^\d{14}$/.test(billing.fssai)) {
      errs.fssai = 'FSSAI number must be 14 digits';
    }
    if (billing.service_charge_enabled && (billing.service_charge_percent < 0 || billing.service_charge_percent > 20)) {
      errs.service_charge_percent = 'Service charge must be between 0% and 20%';
    }
    setBillingErrors(errs);
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

  async function uploadHeroFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    setUploadingHero(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      set('hero_image_url', data.url);
      toast.success('Hero image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingHero(false);
      if (heroFileRef.current) heroFileRef.current.value = '';
    }
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadHeroFile(file);
  }

  async function handleHeroPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadHeroFile(file);
        return;
      }
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
        body: JSON.stringify({ projectId: form.stitch_project_id.trim(), restaurantId: restaurant.id }),
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
    if (!validateBilling()) return;
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
          hero_image_url: form.hero_image_url || null,
          tagline: form.tagline.trim() || null,
          stitch_project_id: form.stitch_project_id.trim() || null,
          billing_config: billing,
          ui_theme: uiTheme,
          service_mode: serviceMode,
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

        {/* ── Welcome Screen (Sunday theme) ── */}
        {uiTheme === 'sunday' && (
          <Section title="Welcome Screen">
            {/* Hero image */}
            <Label className="text-sm font-medium">Hero Image</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              The large banner at the top of your welcome screen. Use a high-quality photo of your restaurant or best dishes. Recommended: 1200×800px. If not set, the first dish image is used as a fallback.
            </p>
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-40 h-24 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50"
                  tabIndex={0}
                  onClick={() => heroFileRef.current?.click()}
                  onPaste={handleHeroPaste}
                >
                  {form.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.hero_image_url} alt="Hero" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Upload className="w-6 h-6 opacity-40" />
                      <span className="text-xs">Click or paste</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => heroFileRef.current?.click()}
                    disabled={uploadingHero}
                  >
                    {uploadingHero ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                    {uploadingHero ? 'Uploading…' : 'Upload'}
                  </Button>
                  {form.hero_image_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => set('hero_image_url', '')}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              </div>
            </div>

            {/* Tagline */}
            <div className="mt-5">
              <Field label="Tagline">
                <Input
                  value={form.tagline}
                  onChange={(e) => set('tagline', e.target.value.slice(0, 100))}
                  placeholder="e.g., In the heart of Vadodara, serving authentic Indian cuisine"
                  maxLength={100}
                />
              </Field>
              <p className="text-xs text-muted-foreground mt-1">
                Appears below your restaurant name on the welcome screen. Max 100 characters.
                {form.tagline.length > 0 && (
                  <span className="ml-1 text-foreground">{form.tagline.length}/100</span>
                )}
              </p>
            </div>
          </Section>
        )}

        {/* ── Service Style ── */}
        <Section title="Service Style">
          <p className="text-xs text-muted-foreground -mt-1">
            How do customers receive their orders? This changes what they see on the order tracking screen.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setServiceMode('self_service')}
              className={cn('relative rounded-xl border-2 p-4 text-left transition-colors', serviceMode === 'self_service' ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <div className="text-2xl mb-2">🏪</div>
              <p className="text-sm font-semibold text-foreground">Self Service</p>
              <p className="text-xs text-muted-foreground mt-0.5">Customers collect their order from the counter</p>
              {serviceMode === 'self_service' && (
                <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setServiceMode('table_service')}
              className={cn('relative rounded-xl border-2 p-4 text-left transition-colors', serviceMode === 'table_service' ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <div className="text-2xl mb-2">🍽️</div>
              <p className="text-sm font-semibold text-foreground">Table Service</p>
              <p className="text-xs text-muted-foreground mt-0.5">Staff delivers orders to the customer&apos;s table</p>
              {serviceMode === 'table_service' && (
                <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              )}
            </button>
          </div>
        </Section>

        {/* ── Menu Style ── */}
        <Section title="Menu Style">
          <p className="text-xs text-muted-foreground -mt-1">
            Choose how your customer-facing menu looks. Same functionality, different layout.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Classic */}
            <button
              type="button"
              onClick={() => setUiTheme('classic')}
              className={cn(
                'relative rounded-xl border-2 p-3 text-left transition-colors',
                uiTheme === 'classic' ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              {/* Mini preview */}
              <div className="mb-2 rounded-md overflow-hidden border border-border bg-muted/40 h-20 flex flex-col gap-1 p-1.5">
                <div className="flex gap-1">
                  <div className="h-3 w-10 rounded-full bg-foreground/70" />
                  <div className="h-3 w-8 rounded-full bg-muted-foreground/30" />
                  <div className="h-3 w-8 rounded-full bg-muted-foreground/30" />
                </div>
                {[1, 2].map((n) => (
                  <div key={n} className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1">
                    <div className="h-5 w-5 rounded bg-muted-foreground/20 flex-shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <div className="h-1.5 w-10 rounded bg-foreground/60" />
                      <div className="h-1 w-7 rounded bg-muted-foreground/40" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-foreground">Classic</p>
              <p className="text-xs text-muted-foreground">Card-based menu</p>
              {uiTheme === 'classic' && (
                <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>

            {/* Minimal */}
            <button
              type="button"
              onClick={() => setUiTheme('sunday')}
              className={cn(
                'relative rounded-xl border-2 p-3 text-left transition-colors',
                uiTheme === 'sunday' ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              {/* Mini preview */}
              <div className="mb-2 rounded-md overflow-hidden border border-border bg-muted/40 h-20 flex flex-col p-1.5">
                <div className="flex gap-2 border-b border-border pb-1 mb-1">
                  <div className="h-2 w-8 rounded-sm bg-foreground/70" />
                  <div className="h-2 w-6 rounded-sm bg-muted-foreground/30" />
                </div>
                {[1, 2].map((n) => (
                  <div key={n} className="flex items-center justify-between border-b border-border py-1 last:border-0">
                    <div className="space-y-0.5">
                      <div className="h-1.5 w-10 rounded bg-foreground/60" />
                      <div className="h-1 w-7 rounded bg-muted-foreground/40" />
                    </div>
                    <div className="h-5 w-5 rounded bg-muted-foreground/25 flex-shrink-0" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-foreground">Minimal</p>
              <p className="text-xs text-muted-foreground">Clean list layout</p>
              {uiTheme === 'sunday' && (
                <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
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

        {/* ── Tax & Billing ── */}
        <Section title="Tax &amp; Billing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="GSTIN" error={billingErrors.gstin}>
              <Input
                value={billing.gstin}
                onChange={(e) => setBill('gstin', e.target.value.toUpperCase())}
                placeholder="27AAPFU0939F1ZV"
                maxLength={15}
                className="font-mono"
              />
            </Field>
            <Field label="FSSAI License No." error={billingErrors.fssai}>
              <Input
                value={billing.fssai}
                onChange={(e) => setBill('fssai', e.target.value.replace(/\D/g, ''))}
                placeholder="14-digit number"
                maxLength={14}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label="Legal Name (for bills)">
            <Input
              value={billing.legal_name}
              onChange={(e) => setBill('legal_name', e.target.value)}
              placeholder="Same as restaurant name if blank"
            />
          </Field>

          <Field label="Billing Address">
            <Input
              value={billing.billing_address}
              onChange={(e) => setBill('billing_address', e.target.value)}
              placeholder="Full address shown on bill"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <Select value={billing.state || '__none__'} onValueChange={(v) => setBill('state', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select state —</SelectItem>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="SAC Code">
              <Input
                value={billing.sac_code}
                onChange={(e) => setBill('sac_code', e.target.value)}
                placeholder="996331"
                className="font-mono"
              />
            </Field>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">GST Rate</Label>
            <div className="flex gap-3">
              {([5, 18] as const).map((rate) => (
                <label key={rate} className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors',
                  billing.gst_rate === rate
                    ? 'bg-blue-50 border-blue-400 text-blue-800'
                    : 'border-gray-200 hover:bg-gray-50'
                )}>
                  <input
                    type="radio"
                    name="gst_rate"
                    value={rate}
                    checked={billing.gst_rate === rate}
                    onChange={() => setBill('gst_rate', rate)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="font-bold text-sm">{rate}% GST</div>
                    <div className="text-xs opacity-70">
                      {rate === 5 ? 'Standard restaurant' : 'Specified premises'}
                    </div>
                    <div className="text-xs opacity-60">
                      {rate === 5 ? 'CGST 2.5% + SGST 2.5%' : 'CGST 9% + SGST 9%'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Service Charge</p>
              <p className="text-xs text-muted-foreground">Applied before GST, not taxable</p>
            </div>
            <button
              type="button"
              onClick={() => setBill('service_charge_enabled', !billing.service_charge_enabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                billing.service_charge_enabled ? 'bg-blue-600' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                billing.service_charge_enabled ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>

          {billing.service_charge_enabled && (
            <Field label="Service Charge %" error={billingErrors.service_charge_percent}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={billing.service_charge_percent}
                  onChange={(e) => setBill('service_charge_percent', parseFloat(e.target.value) || 0)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">% of subtotal (common: 5, 7.5, 10)</span>
              </div>
            </Field>
          )}
        </Section>

        {/* ── Printers ── */}
        <Section title="Printers">
          <PrinterSettings restaurant={restaurant} categories={categories} />
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
