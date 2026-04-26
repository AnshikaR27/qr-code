'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShoppingBag, LayoutGrid, ChefHat, UtensilsCrossed, LogOut, IndianRupee, Settings, Pencil } from 'lucide-react';
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

  const canKitchen = hasPermission(staff.role, 'order:set_ready');
  const canTables = hasPermission(staff.role, 'table:assign');
  const canPayment = hasPermission(staff.role, 'order:record_payment');
  const canEditMenu = hasPermission(staff.role, 'menu:edit_items');
  const canStockToggle = hasPermission(staff.role, 'menu:mark_out_of_stock');
  const canPrinterSettings = hasPermission(staff.role, 'settings:edit_printer');

  const navItems = [
    { href: '/staff-dashboard/orders', label: 'Orders', icon: ShoppingBag, show: true },
    { href: '/staff-dashboard/kitchen', label: 'Kitchen', icon: ChefHat, show: canKitchen },
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
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-white border-r">
        <div className="p-6 border-b">
          <p className="font-semibold text-sm truncate">{restaurant.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground truncate">{staff.name}</p>
            <Badge variant="outline" className="text-[10px] capitalize">{staff.role}</Badge>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Log out
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
