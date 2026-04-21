'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function StaffLoginLanding() {
  const router = useRouter();
  const [slug, setSlug] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (slug.trim()) {
      router.push(`/staff/${slug.trim().toLowerCase()}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold">Staff Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your restaurant code to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slug">Restaurant Code</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. my-cafe"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!slug.trim()}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
