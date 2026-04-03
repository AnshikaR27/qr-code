'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { registerSchema } from '@/lib/validators';
import { slugify } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uiTheme, setUiTheme] = useState<'classic' | 'sunday'>('classic');
  const [form, setForm] = useState({
    email: '',
    password: '',
    restaurantName: '',
    phone: '',
    city: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = registerSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // 1. Sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Sign up failed');
      setLoading(false);
      return;
    }

    // 2. Generate unique slug
    let slug = slugify(form.restaurantName);
    const { data: existing } = await supabase
      .from('restaurants')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // 3. Insert restaurant row
    const { error: restaurantError } = await supabase.from('restaurants').insert({
      owner_id: authData.user.id,
      name: form.restaurantName,
      slug,
      phone: form.phone,
      city: form.city,
      ui_theme: uiTheme,
    });

    if (restaurantError) {
      toast.error('Account created but restaurant setup failed. Please contact support.');
      setLoading(false);
      return;
    }

    // 4. Send welcome email (fire and forget — don't block on failure)
    fetch('/api/welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantName: form.restaurantName, slug }),
    }).catch(() => {});

    toast.success('Welcome! Your restaurant is ready.');
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your restaurant</CardTitle>
          <CardDescription>Set up your digital menu in minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restaurantName">Restaurant Name</Label>
              <Input
                id="restaurantName"
                name="restaurantName"
                placeholder="Sharma's Dhaba"
                value={form.restaurantName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Mumbai"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="owner@restaurant.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {/* Menu style picker */}
            <div className="space-y-2">
              <Label>Menu style</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Classic */}
                <button
                  type="button"
                  onClick={() => setUiTheme('classic')}
                  className="relative rounded-xl border-2 p-3 text-left transition-colors"
                  style={{
                    borderColor: uiTheme === 'classic' ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    backgroundColor: uiTheme === 'classic' ? 'hsl(var(--primary) / 0.06)' : 'transparent',
                  }}
                >
                  {/* Mini preview — Classic: pill tabs + card rows */}
                  <div className="mb-2 rounded-md overflow-hidden border border-border bg-muted/40 h-20 flex flex-col gap-1 p-1.5">
                    {/* Pill tabs */}
                    <div className="flex gap-1">
                      <div className="h-3 w-10 rounded-full bg-foreground/70" />
                      <div className="h-3 w-8 rounded-full bg-muted-foreground/30" />
                      <div className="h-3 w-8 rounded-full bg-muted-foreground/30" />
                    </div>
                    {/* Cards */}
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
                  <p className="text-xs font-700 text-foreground font-semibold">Classic</p>
                  <p className="text-xs text-muted-foreground">Card-based menu</p>
                  {uiTheme === 'classic' && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>

                {/* Sunday / Minimal */}
                <button
                  type="button"
                  onClick={() => setUiTheme('sunday')}
                  className="relative rounded-xl border-2 p-3 text-left transition-colors"
                  style={{
                    borderColor: uiTheme === 'sunday' ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    backgroundColor: uiTheme === 'sunday' ? 'hsl(var(--primary) / 0.06)' : 'transparent',
                  }}
                >
                  {/* Mini preview — Minimal: underline tabs + list rows */}
                  <div className="mb-2 rounded-md overflow-hidden border border-border bg-muted/40 h-20 flex flex-col p-1.5">
                    {/* Underline tabs */}
                    <div className="flex gap-2 border-b border-border pb-1 mb-1">
                      <div className="h-2 w-8 rounded-sm bg-foreground/70 border-b-2 border-foreground/70" />
                      <div className="h-2 w-6 rounded-sm bg-muted-foreground/30" />
                    </div>
                    {/* List rows: text left, image right */}
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
              <p className="text-xs text-muted-foreground">You can change this later in settings.</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
