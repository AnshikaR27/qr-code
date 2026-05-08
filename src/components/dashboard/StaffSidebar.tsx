'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShoppingBag, LayoutGrid, ChefHat, UtensilsCrossed, LogOut, IndianRupee, Settings, Pencil, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { hasPermission } from '@/lib/staff-permissions';
import type { StaffSession, Restaurant } from '@/types';

interface StaffSidebarProps {
  staff: StaffSession;
  restaurant: Restaurant;
}

const SIDEBAR_COLLAPSED_KEY = 'staff-sidebar-collapsed';

export default function StaffSidebar({ staff, restaurant }: StaffSidebarProps) {
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

  const canKitchen = hasPermission(staff.role, 'order:set_ready');
  const canTables = hasPermission(staff.role, 'table:assign');
  const canPayment = hasPermission(staff.role, 'order:record_payment');
  const canEditMenu = hasPermission(staff.role, 'menu:edit_items');
  const canStockToggle = hasPermission(staff.role, 'menu:mark_out_of_stock');
  const canPrinterSettings = hasPermission(staff.role, 'settings:edit_printer');

  const isCounter = staff.role === 'counter';

  const navItems = [
    { href: '/staff-dashboard/orders', label: 'Orders', icon: ShoppingBag, show: !isCounter && staff.role !== 'kitchen' },
    { href: '/staff-dashboard/kitchen', label: 'Kitchen', icon: ChefHat, show: canKitchen && !isCounter },
    { href: '/staff-dashboard/counter', label: 'Counter', icon: IndianRupee, show: canPayment },
    { href: '/staff-dashboard/tables', label: 'Tables', icon: LayoutGrid, show: canTables },
    { href: '/staff-dashboard/items', label: 'Items', icon: canEditMenu ? Pencil : UtensilsCrossed, show: canEditMenu || staff.role === 'kitchen' },
    { href: '/staff-dashboard/settings', label: 'Settings', icon: Settings, show: canPrinterSettings },
  ].filter(item => item.show);

  async function handleLogout() {
    await fetch('/api/staff/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push(`/staff/${staff.restaurant_slug}`);
  }

  const hideBottomNav = pathname.includes('/new-order');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col min-h-screen bg-white border-r transition-all duration-200',
        collapsed ? 'w-[68px]' : 'w-64',
      )}>
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
              <p className="font-semibold text-sm text-center" title={restaurant.name}>
                {restaurant.name.charAt(0)}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{restaurant.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground truncate">{staff.name}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{staff.role}</Badge>
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

        <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
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

        <div className={cn('border-t', collapsed ? 'p-2' : 'p-4')}>
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

      {/* Mobile bottom navigation */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around py-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[64px]',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-0.5 px-3 py-2 text-muted-foreground min-w-[64px]"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[10px] font-medium">Log out</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
