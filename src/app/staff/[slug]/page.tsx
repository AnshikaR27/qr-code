'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';

export default function StaffLoginPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  function addDigit(d: string) {
    if (pin.length < 6) setPin(pin + d);
  }

  function removeDigit() {
    setPin(pin.slice(0, -1));
  }

  async function handleLogin() {
    if (pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_slug: slug, pin }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      toast.success('Logged in');
      router.push('/staff-dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold">Staff Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your PIN to continue</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                i < pin.length
                  ? 'bg-primary border-primary'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />;
            if (d === 'del') {
              return (
                <button
                  key={i}
                  onClick={removeDigit}
                  className="h-14 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-gray-100 transition-colors"
                >
                  <Delete className="w-5 h-5" />
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => addDigit(d)}
                className="h-14 rounded-lg bg-white border text-lg font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {d}
              </button>
            );
          })}
        </div>

        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={pin.length < 4 || loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </div>
    </div>
  );
}
