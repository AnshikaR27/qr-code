'use client';

import { useStaff } from '@/contexts/StaffContext';
import { Badge } from '@/components/ui/badge';

export default function StaffMobileHeader() {
  const { staff, restaurant } = useStaff();

  return (
    <div className="md:hidden px-4 pt-4 pb-2">
      <p className="text-[13px] text-muted-foreground">{restaurant.name}</p>
      <div className="flex items-center gap-2">
        <p className="font-semibold text-base truncate">{staff.name}</p>
        <Badge variant="outline" className="text-[10px] capitalize">{staff.role}</Badge>
      </div>
    </div>
  );
}
