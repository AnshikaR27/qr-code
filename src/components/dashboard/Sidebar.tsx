'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  QrCode,
  LayoutGrid,
  Settings,
  LogOut,
  Printer,
  Users,
  ScrollText,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Restaurant } from '@/types';

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard', icon: LayoutDashboard, exact: true  },
  { href: '/dashboard/orders',     label: 'Orders',    icon: ShoppingBag,    exact: false },
  { href: '/dashboard/menu',       label: 'Menu',      icon: UtensilsCrossed, exact: false },
  { href: '/dashboard/qr',         label: 'QR Codes',  icon: QrCode,         exact: false },
  { href: '/dashboard/floor-plan', label: 'Floor Plan', icon: LayoutGrid,    exact: false },
  { href: '/dashboard/staff',      label: 'Staff',     icon: Users,          exact: false },
  { href: '/dashboard/activity',   label: 'Activity',  icon: ScrollText,     exact: false },
  { href: '/dashboard/reports/gst',       label: 'GST Report', icon: FileText,    exact: false },
  { href: '/dashboard/reports/revenue',   label: 'Revenue',    icon: TrendingUp,  exact: false },
  { href: '/dashboard/reports/top-items', label: 'Top Items',  icon: BarChart3,   exact: false },
  { href: '/dashboard/settings',   label: 'Settings',  icon: Settings,       exact: false },
];

const SIDEBAR_COLLAPSED_KEY = 'owner-sidebar-collapsed';

interface SidebarProps {
  restaurant: Restaurant;
}

export default function Sidebar({ restaurant }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    } else if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Logged out');
    router.push('/');
  }

  return (
    <aside className={cn(
      'flex flex-col min-h-screen bg-white border-r transition-all duration-200',
      collapsed ? 'w-[68px]' : 'w-64',
    )}>
      {/* Logo / Restaurant name */}
      <div className={cn('border-b', collapsed ? 'p-3' : 'px-6 py-4')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Expand sidebar"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            <div
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: restaurant.design_tokens?.['--primary'] ?? '#8B6914' }}
              title={restaurant.name}
            />
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: restaurant.design_tokens?.['--primary'] ?? '#8B6914' }}
              />
              <div className="overflow-hidden">
                <p className="font-semibold text-sm truncate">{restaurant.name}</p>
                <p className="text-xs text-muted-foreground truncate">/{restaurant.slug}</p>
              </div>
            </div>
            <button
              onClick={toggleCollapsed}
              className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors -mr-1"
              title="Collapse sidebar"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-md text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Printer status + Logout */}
      <div className={cn('border-t space-y-1', collapsed ? 'p-2' : 'p-4')}>
        <PrinterStatusDot config={restaurant.printer_config} collapsed={collapsed} />
        <button
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={cn(
            'flex items-center w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && 'Log out'}
        </button>
      </div>
    </aside>
  );
}

function PrinterStatusDot({ config, collapsed }: { config: Restaurant['printer_config']; collapsed: boolean }) {
  const [connected, setConnected] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!config || config.printers.length === 0) { setTotal(0); return; }
    const usbPrinters = config.printers.filter((p) => p.type === 'usb');
    const networkPrinters = config.printers.filter((p) => p.type === 'network');
    setTotal(config.printers.filter((p) => p.type !== 'browser').length);

    const count = networkPrinters.length; // assume network printers "connected" (checked at print time)

    if (usbPrinters.length === 0) {
      setConnected(count);
      return;
    }

    // Try to check USB connections
    import('@/lib/printer-service').then(({ printerService }) => {
      const usbCount = usbPrinters.filter((p) => printerService.isUSBConnected(p.id)).length;
      setConnected(count + usbCount);
    }).catch(() => setConnected(count));
  }, [config]);

  if (!config || config.printers.length === 0) return null;

  const allConnected = total > 0 && connected >= total;
  const noneConnected = connected === 0;

  return (
    <Link
      href="/dashboard/settings"
      title={collapsed ? `${connected}/${total} printers` : undefined}
      className={cn(
        'flex items-center rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
      )}
    >
      <div className="relative flex-shrink-0">
        <Printer className="w-4 h-4" />
        <span className={cn(
          'absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white',
          allConnected ? 'bg-green-500' : noneConnected ? 'bg-red-500' : 'bg-amber-400'
        )} />
      </div>
      {!collapsed && (
        <span className="text-xs">
          {connected}/{total} printer{total !== 1 ? 's' : ''}
        </span>
      )}
    </Link>
  );
}
