'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShoppingBag, LayoutGrid, ChefHat, UtensilsCrossed, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { StaffSession, Restaurant } from '@/types';

interface StaffSidebarProps {
  staff: StaffSession;
  restaurant: Restaurant;
}

export default function StaffSidebar({ staff, restaurant }: StaffSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    ...(staff.role === 'kitchen'
      ? [
          { href: '/staff-dashboard/kitchen', label: 'Orders', icon: ChefHat },
          { href: '/staff-dashboard/items', label: 'Items', icon: UtensilsCrossed },
        ]
      : [
          { href: '/staff-dashboard/orders', label: 'Orders', icon: ShoppingBag },
          { href: '/staff-dashboard/tables', label: 'Tables', icon: LayoutGrid },
        ]),
  ];

  async function handleLogout() {
    await fetch('/api/staff/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push(`/staff/${staff.restaurant_slug}`);
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r">
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
  );
}
