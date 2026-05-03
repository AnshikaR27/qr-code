'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShoppingBag, LayoutGrid, ChefHat, UtensilsCrossed, LogOut, IndianRupee, Settings, Pencil, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { hasPermission } from '@/lib/staff-permissions';
import type { StaffSession, Restaurant } from '@/types';

interface StaffSidebarProps {
  staff: StaffSession;
  restaurant: Restaurant;
}

export default function StaffSidebar({ staff, restaurant }: StaffSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const canKitchen = hasPermission(staff.role, 'order:set_ready');
  const canTables = hasPermission(staff.role, 'table:assign');
  const canPayment = hasPermission(staff.role, 'order:record_payment');
  const canEditMenu = hasPermission(staff.role, 'menu:edit_items');
  const canStockToggle = hasPermission(staff.role, 'menu:mark_out_of_stock');
  const canPrinterSettings = hasPermission(staff.role, 'settings:edit_printer');

  const isCounter = staff.role === 'counter';

  const navItems = [
    { href: '/staff-dashboard/orders', label: 'Orders', icon: ShoppingBag, show: !isCounter },
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
        <div className={cn('border-b', collapsed ? 'p-3' : 'p-6')}>
          {collapsed ? (
            <p className="font-semibold text-sm text-center truncate" title={restaurant.name}>
              {restaurant.name.charAt(0)}
            </p>
          ) : (
            <>
              <p className="font-semibold text-sm truncate">{restaurant.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground truncate">{staff.name}</p>
                <Badge variant="outline" className="text-[10px] capitalize">{staff.role}</Badge>
              </div>
            </>
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

          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'flex items-center w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors mt-1',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-4 h-4 flex-shrink-0" />
              : <PanelLeftClose className="w-4 h-4 flex-shrink-0" />}
            {!collapsed && 'Collapse'}
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
