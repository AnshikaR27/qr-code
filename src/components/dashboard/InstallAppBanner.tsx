'use client';

import { useEffect, useState, useRef } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'staff-install-dismissed';
const DISMISS_DAYS = 7;

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  } catch {
    // storage unavailable (Safari private mode, etc.)
  }
}

export default function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (readDismissed()) return;

    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function installedHandler() {
      setShow(false);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setShow((prev) => {
        if (prev) return prev;
        return true;
      });
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function dismiss() {
    writeDismissed();
    setShow(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'dismissed') {
      dismiss();
    } else {
      setShow(false);
    }
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
