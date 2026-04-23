'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'staff-install-dismissed';

export default function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    }
    window.addEventListener('beforeinstallprompt', handler);

    const timer = setTimeout(() => setShow(true), 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShow(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  }

  if (!show) return null;

  return (
    <div className="mx-4 mt-4 sm:mx-6 bg-primary/5 border border-primary/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Add to Home Screen</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Tap the <Share className="w-3 h-3 inline-block align-text-bottom" /> share button, then <strong>&ldquo;Add to Home Screen&rdquo;</strong>
            </p>
          ) : deferredPrompt ? (
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-xs text-muted-foreground">Quick access from your home screen</p>
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={handleInstall}>
                Install
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Open browser menu and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>
            </p>
          )}
        </div>
        <button onClick={dismiss} className="p-1 rounded-md hover:bg-black/5 flex-shrink-0 -mt-1 -mr-1">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
