'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Users, UtensilsCrossed, Store, LayoutGrid, History, Printer,
  Plus, Pencil, Trash2, UserCheck, UserX, Search, RefreshCw,
  Upload, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn, formatPrice, cdnImg } from '@/lib/utils';
import { INDIAN_STATES } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import PrinterSettings from '@/components/dashboard/PrinterSettings';
import DishForm from '@/components/dashboard/DishForm';
import CategoryManager from '@/components/dashboard/CategoryManager';
import FloorPlanEditor from '@/app/dashboard/floor-plan/FloorPlanEditor';
import ErrorState from '@/components/shared/ErrorState';
import type {
  StaffMember, StaffRole, Category, Product, Restaurant,
  BillingConfig, ActivityLogEntry,
} from '@/types';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  staffId: string;
}

const TABS = [
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'restaurant', label: 'Restaurant', icon: Store },
  { id: 'floor-plan', label: 'Floor Plan', icon: LayoutGrid },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'printers', label: 'Printers', icon: Printer },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ManagerSettingsClient({ restaurant, categories, staffId }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('staff');

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your restaurant operations
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b mb-6 pb-px -mx-1 px-1 scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'staff' && <StaffSection staffId={staffId} />}
      {activeTab === 'menu' && <MenuSection restaurantId={restaurant.id} />}
      {activeTab === 'restaurant' && <RestaurantSection restaurant={restaurant} />}
      {activeTab === 'floor-plan' && <FloorPlanEditor restaurant={restaurant} useStaffApi />}
      {activeTab === 'activity' && <ActivitySection />}
      {activeTab === 'printers' && (
        <Section title="Printers">
          <PrinterSettings restaurant={restaurant} categories={categories} />
        </Section>
      )}
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, error, children, className }: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className={cn(error && 'text-destructive')}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STAFF MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

const ROLE_COLORS: Record<StaffRole, string> = {
  floor: 'bg-blue-500',
  kitchen: 'bg-orange-500',
  counter: 'bg-green-500',
  manager: 'bg-indigo-500',
};

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'floor', label: 'Floor' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'counter', label: 'Counter' },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  floor: 'Take orders, deliver food, manage tables',
  kitchen: 'Mark orders ready, mark items out of stock',
  counter: 'Take payment, mark orders delivered',
};

function StaffSection({ staffId }: { staffId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/staff/manage/staff');
      if (!res.ok) throw new Error();
      setStaff(await res.json());
    } catch {
      setError(true);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  async function toggleActive(s: StaffMember) {
    const res = await fetch('/api/staff/manage/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Failed to update');
      return;
    }
    toast.success(s.is_active ? 'Staff deactivated' : 'Staff activated');
    fetchStaff();
  }

  async function deleteStaff(s: StaffMember) {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/staff/manage/staff?id=${s.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Failed to delete');
      return;
    }
    toast.success('Staff deleted');
    fetchStaff();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage your team. Staff log in with a PIN at the staff portal.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Staff
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : error ? (
        <ErrorState title="Couldn't load staff" onRetry={fetchStaff} />
      ) : staff.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <p className="text-muted-foreground mb-4">No staff members yet</p>
          <Button variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add your first staff member
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div
              key={s.id}
              className={cn(
                'flex items-center justify-between p-4 bg-white border rounded-lg',
                !s.is_active && 'opacity-50',
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
                  ROLE_COLORS[s.role],
                )}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">
                    {s.name}
                    {s.id === staffId && (
                      <span className="text-xs text-muted-foreground ml-2">(you)</span>
                    )}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs capitalize">{s.role}</Badge>
                    {!s.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                </div>
              </div>

              {s.role !== 'manager' && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title={s.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(s)}>
                    {s.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(s); setFormOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteStaff(s)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {s.role === 'manager' && (
                <Badge variant="outline" className="text-xs text-muted-foreground">Managed by owner</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <ManagerStaffForm
        open={formOpen}
        onOpenChange={setFormOpen}
        staff={editing}
        onSaved={fetchStaff}
      />
    </div>
  );
}

function ManagerStaffForm({ open, onOpenChange, staff, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: StaffMember | null;
  onSaved: () => void;
}) {
  const isEdit = !!staff;
  const [name, setName] = useState(staff?.name ?? '');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'floor');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName(staff?.name ?? '');
    setPin('');
    setRole(staff?.role ?? 'floor');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = { id: staff.id, name, role };
        if (pin) body.pin = pin;
        const res = await fetch('/api/staff/manage/staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update');
        }
        toast.success('Staff updated');
      } else {
        if (!pin || pin.length < 4) {
          toast.error('PIN must be 4-6 digits');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/staff/manage/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, pin, role }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create');
        }
        toast.success('Staff created');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) resetForm(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mgr-staff-name">Name</Label>
            <Input id="mgr-staff-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mgr-staff-pin">{isEdit ? 'New PIN (leave blank to keep current)' : 'PIN (4-6 digits)'}</Label>
            <Input
              id="mgr-staff-pin" type="password" inputMode="numeric" pattern="\d{4,6}"
              maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••" required={!isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value} type="button" onClick={() => setRole(value)}
                  className={cn(
                    'w-full py-2 px-3 rounded-md text-sm font-medium border transition-colors',
                    role === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            <p className="text-xs text-amber-600">Only the restaurant owner can create Manager accounts.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update' : 'Add Staff'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MENU MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

function MenuSection({ restaurantId }: { restaurantId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [dishDialogOpen, setDishDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('products').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleAvailability(product: Product) {
    const next = !product.is_available;
    setToggling(product.id);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: next } : p));
    try {
      const res = await fetch('/api/staff/items/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, is_available: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? `${product.name} is now available` : `${product.name} marked unavailable`);
    } catch {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: !next } : p));
      toast.error('Failed to update availability');
    } finally {
      setToggling(null);
    }
  }

  async function deleteItem(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      const res = await fetch(`/api/staff/menu/items?id=${product.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      setProducts(prev => prev.filter(p => p.id !== product.id));
      toast.success('Dish deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete dish');
    }
  }

  async function deleteCategory(cat: Category) {
    const dishCount = products.filter(p => p.category_id === cat.id).length;
    const msg = dishCount > 0
      ? `Delete "${cat.name}"? ${dishCount} dish${dishCount > 1 ? 'es' : ''} will become uncategorised.`
      : `Delete category "${cat.name}"?`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/staff/menu/categories?id=${cat.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      setProducts(prev => prev.map(p => p.category_id === cat.id ? { ...p, category_id: null } : p));
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    }
  }

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const grouped = categories
    .map(cat => ({ category: cat, items: filtered.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0);
  const uncategorized = filtered.filter(p => !p.category_id);
  const unavailableCount = products.filter(p => !p.is_available).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add, edit, and manage menu items
          {unavailableCount > 0 && (
            <span className="ml-2 text-red-600 font-medium">· {unavailableCount} unavailable</span>
          )}
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setEditCategory(null); setCatDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Category
          </Button>
          <Button size="sm" onClick={() => { setEditProduct(null); setDishDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Dish
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search items..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
      </div>

      {grouped.map(({ category, items }) => (
        <div key={category.id}>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{category.name}</h2>
            <div className="flex gap-1">
              <button onClick={() => { setEditCategory(category); setCatDialogOpen(true); }} className="p-1 rounded hover:bg-gray-100 text-muted-foreground" title="Edit category">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteCategory(category)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Delete category">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border divide-y">
            {items.map(product => (
              <MenuItemRow
                key={product.id} product={product} isToggling={toggling === product.id}
                onToggle={() => toggleAvailability(product)}
                onEdit={() => { setEditProduct(product); setDishDialogOpen(true); }}
                onDelete={() => deleteItem(product)}
              />
            ))}
          </div>
        </div>
      ))}

      {uncategorized.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Other</h2>
          <div className="bg-white rounded-xl border divide-y">
            {uncategorized.map(product => (
              <MenuItemRow
                key={product.id} product={product} isToggling={toggling === product.id}
                onToggle={() => toggleAvailability(product)}
                onEdit={() => { setEditProduct(product); setDishDialogOpen(true); }}
                onDelete={() => deleteItem(product)}
              />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No items found</p>
        </div>
      )}

      <DishForm
        open={dishDialogOpen}
        onClose={() => setDishDialogOpen(false)}
        onSaved={saved => {
          setProducts(prev => {
            const idx = prev.findIndex(p => p.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
          });
        }}
        restaurantId={restaurantId}
        categories={categories}
        editProduct={editProduct}
        useStaffApi
      />
      <CategoryManager
        open={catDialogOpen}
        onClose={() => setCatDialogOpen(false)}
        onSaved={saved => {
          setCategories(prev => {
            const idx = prev.findIndex(c => c.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
          });
        }}
        restaurantId={restaurantId}
        editCategory={editCategory}
        useStaffApi
      />
    </div>
  );
}

function MenuItemRow({ product, isToggling, onToggle, onEdit, onDelete }: {
  product: Product;
  isToggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-3 gap-3', !product.is_available && 'bg-red-50/50')}>
      <div className="flex items-center gap-3 min-w-0">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnImg(product.image_url)!} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        )}
        <div className={cn('w-3 h-3 rounded-full border-2 flex-shrink-0', product.is_veg ? 'border-green-600 bg-green-600' : 'border-red-600 bg-red-600')} />
        <div className="min-w-0">
          <p className={cn('text-sm font-medium truncate', !product.is_available && 'line-through text-muted-foreground')}>{product.name}</p>
          <p className="text-xs text-muted-foreground">{formatPrice(product.price)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggle} disabled={isToggling}
          className={cn('relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200', product.is_available ? 'bg-green-500' : 'bg-gray-300', isToggling && 'opacity-50')}
        >
          <span className={cn('absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200', product.is_available && 'translate-x-5')} />
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RESTAURANT SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

const DEFAULT_BILLING: BillingConfig = {
  gstin: '', fssai: '', gst_rate: 5, service_charge_enabled: false,
  service_charge_percent: 10, sac_code: '996331', legal_name: '', billing_address: '', state: '',
};

function RestaurantSection({ restaurant }: { restaurant: Restaurant }) {
  const [form, setForm] = useState({
    name: restaurant.name,
    phone: restaurant.phone ?? '',
    address: restaurant.address ?? '',
    city: restaurant.city ?? '',
    opening_time: restaurant.opening_time ?? '09:00',
    closing_time: restaurant.closing_time ?? '23:00',
    logo_url: restaurant.logo_url ?? '',
  });
  const [billing, setBilling] = useState<BillingConfig>({ ...DEFAULT_BILLING, ...(restaurant.billing_config ?? {}) });
  const [serviceMode, setServiceMode] = useState<'self_service' | 'table_service'>(restaurant.service_mode ?? 'self_service');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Select an image file'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be under 8MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      set('logo_url', data.url);
      toast.success('Logo uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Restaurant name is required';
    if (form.phone && (form.phone.length < 10 || form.phone.length > 15)) errs.phone = 'Enter a valid phone number';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/staff/manage/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          opening_time: form.opening_time,
          closing_time: form.closing_time,
          logo_url: form.logo_url || null,
          service_mode: serviceMode,
          billing_config: billing,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      toast.success('Settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Restaurant Info">
        <Field label="Restaurant Name *" error={errors.name}>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Restaurant" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main Street, Area" />
        </Field>
      </Section>

      <Section title="Opening Hours">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Opens at">
            <Input type="time" value={form.opening_time} onChange={e => set('opening_time', e.target.value)} />
          </Field>
          <Field label="Closes at">
            <Input type="time" value={form.closing_time} onChange={e => set('closing_time', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Logo">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50"
              onClick={() => fileRef.current?.click()}
            >
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cdnImg(form.logo_url)!} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="w-6 h-6 opacity-40" />
                  <span className="text-xs">Logo</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </Section>

      <Section title="Service Style">
        <p className="text-xs text-muted-foreground -mt-1">How do customers receive their orders?</p>
        <div className="grid grid-cols-2 gap-3">
          {(['self_service', 'table_service'] as const).map(mode => (
            <button
              key={mode} type="button" onClick={() => setServiceMode(mode)}
              className={cn('relative rounded-xl border-2 p-4 text-left transition-colors', serviceMode === mode ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <div className="text-2xl mb-2">{mode === 'self_service' ? '🏪' : '🍽️'}</div>
              <p className="text-sm font-semibold">{mode === 'self_service' ? 'Self Service' : 'Table Service'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'self_service' ? 'Customers collect from counter' : 'Staff delivers to table'}
              </p>
              {serviceMode === mode && (
                <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Tax &amp; Billing">
        <div className="grid grid-cols-2 gap-4">
          <Field label="GSTIN">
            <Input value={billing.gstin} onChange={e => setBilling(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))} placeholder="27AAPFU0939F1ZV" maxLength={15} className="font-mono" />
          </Field>
          <Field label="FSSAI License No.">
            <Input value={billing.fssai} onChange={e => setBilling(prev => ({ ...prev, fssai: e.target.value.replace(/\D/g, '') }))} placeholder="14-digit number" maxLength={14} className="font-mono" />
          </Field>
        </div>
        <Field label="Legal Name (for bills)">
          <Input value={billing.legal_name} onChange={e => setBilling(prev => ({ ...prev, legal_name: e.target.value }))} placeholder="Same as restaurant name if blank" />
        </Field>
        <Field label="Billing Address">
          <Input value={billing.billing_address} onChange={e => setBilling(prev => ({ ...prev, billing_address: e.target.value }))} placeholder="Full address shown on bill" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State">
            <Select value={billing.state || '__none__'} onValueChange={v => setBilling(prev => ({ ...prev, state: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select state —</SelectItem>
                {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="SAC Code">
            <Input value={billing.sac_code} onChange={e => setBilling(prev => ({ ...prev, sac_code: e.target.value }))} placeholder="996331" className="font-mono" />
          </Field>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GST Rate</Label>
          <div className="flex gap-3">
            {([5, 18] as const).map(rate => (
              <label key={rate} className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors',
                billing.gst_rate === rate ? 'bg-blue-50 border-blue-400 text-blue-800' : 'border-gray-200 hover:bg-gray-50',
              )}>
                <input type="radio" name="gst_rate" checked={billing.gst_rate === rate} onChange={() => setBilling(prev => ({ ...prev, gst_rate: rate }))} className="sr-only" />
                <div className="text-center">
                  <div className="font-bold text-sm">{rate}% GST</div>
                  <div className="text-xs opacity-70">{rate === 5 ? 'Standard restaurant' : 'Specified premises'}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div>
            <p className="text-sm font-medium">Service Charge</p>
            <p className="text-xs text-muted-foreground">Applied before GST</p>
          </div>
          <button
            type="button"
            onClick={() => setBilling(prev => ({ ...prev, service_charge_enabled: !prev.service_charge_enabled }))}
            className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', billing.service_charge_enabled ? 'bg-blue-600' : 'bg-gray-200')}
          >
            <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', billing.service_charge_enabled ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>
        {billing.service_charge_enabled && (
          <Field label="Service Charge %">
            <div className="flex items-center gap-2">
              <Input
                type="number" min="0" max="20" step="0.5"
                value={billing.service_charge_percent}
                onChange={e => setBilling(prev => ({ ...prev, service_charge_percent: parseFloat(e.target.value) || 0 }))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">% of subtotal</span>
            </div>
          </Field>
        )}
      </Section>

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} className="px-8">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═════════════════════════════════════════════════════════════════════════════

const ACTION_LABELS: Record<string, string> = {
  'order.placed': 'Placed order',
  'order.status_changed': 'Changed order status',
  'order.cancelled': 'Cancelled order',
  'order.payment_recorded': 'Recorded payment',
  'item.voided': 'Voided item',
  'item.quantity_reduced': 'Reduced item quantity',
  'staff.created': 'Created staff',
  'staff.updated': 'Updated staff',
  'staff.deleted': 'Deleted staff',
  'staff.login': 'Staff logged in',
  'staff.logout': 'Staff logged out',
  'settings.updated': 'Updated settings',
  'floor_plan.updated': 'Updated floor plan',
  'table.created': 'Added table',
  'table.deleted': 'Removed table',
  'item.created': 'Added menu item',
  'item.updated': 'Updated menu item',
  'item.deleted': 'Deleted menu item',
  'category.created': 'Added category',
  'category.updated': 'Updated category',
  'category.deleted': 'Deleted category',
};

const ACTOR_COLORS: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  customer: 'bg-purple-100 text-purple-700',
  system: 'bg-gray-100 text-gray-700',
};

function ActivitySection() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actorFilter, setActorFilter] = useState<string | null>(null);
  const limit = 50;

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actorFilter) params.set('actor_type', actorFilter);
      const res = await fetch(`/api/staff/manage/activity?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError(true);
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [page, actorFilter]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} event{total !== 1 ? 's' : ''} tracked</p>
        <Button variant="outline" size="icon" onClick={fetchActivity} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        {['all', 'owner', 'staff', 'customer'].map(f => (
          <button
            key={f}
            onClick={() => { setActorFilter(f === 'all' ? null : f); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors',
              (f === 'all' && !actorFilter) || actorFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-muted-foreground hover:bg-gray-200',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : error ? (
        <ErrorState title="Couldn't load activity" onRetry={fetchActivity} />
      ) : entries.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white text-muted-foreground">
          No activity recorded yet
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 p-3 bg-white border rounded-lg">
              <Badge variant="outline" className={cn('text-[10px] mt-0.5', ACTOR_COLORS[entry.actor_type] ?? '')}>
                {entry.actor_type}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{entry.actor_name ?? entry.actor_type}</span>{' '}
                  <span className="text-muted-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  {entry.entity_id && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({entry.entity_type} {entry.entity_id.slice(0, 8)}...)
                    </span>
                  )}
                </p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Object.entries(entry.metadata)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
