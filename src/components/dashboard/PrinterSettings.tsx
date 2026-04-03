'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Pencil, Wifi, Usb, MonitorSmartphone, Check, X, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { PrinterDevice, PrinterConfig, PrinterConnectionType, Category, Restaurant } from '@/types';

const DEFAULT_CONFIG: PrinterConfig = {
  printers: [],
  default_bill_printer: null,
  station_routing: {},
  auto_print_kot: true,
  auto_print_bill: false,
  copies: 1,
};

interface Props {
  restaurant: Restaurant;
  categories: Category[];
}

interface FormState {
  id: string;
  name: string;
  type: PrinterConnectionType;
  ip: string;
  port: string;
  paper_width: '80mm' | '58mm';
  auto_cut: boolean;
}

function newForm(): FormState {
  return { id: crypto.randomUUID(), name: '', type: 'usb', ip: '', port: '9100', paper_width: '80mm', auto_cut: true };
}

const TYPE_ICONS: Record<PrinterConnectionType, React.ReactNode> = {
  usb:     <Usb className="w-4 h-4" />,
  network: <Wifi className="w-4 h-4" />,
  browser: <MonitorSmartphone className="w-4 h-4" />,
};

const TYPE_LABELS: Record<PrinterConnectionType, string> = {
  usb: 'USB', network: 'Network (WiFi/LAN)', browser: 'Browser Print',
};

export default function PrinterSettings({ restaurant, categories }: Props) {
  const [config, setConfig] = useState<PrinterConfig>({
    ...DEFAULT_CONFIG,
    ...(restaurant.printer_config ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(newForm());
  const [usbConnecting, setUsbConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [usbStatus, setUsbStatus] = useState<Record<string, string>>({}); // printerId → device name

  const webUSBSupported = typeof window !== 'undefined' && 'usb' in navigator;

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function setConf<K extends keyof PrinterConfig>(k: K, v: PrinterConfig[K]) {
    setConfig((prev) => ({ ...prev, [k]: v }));
  }

  function openAdd() {
    setForm(newForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(printer: PrinterDevice) {
    setForm({
      id: printer.id,
      name: printer.name,
      type: printer.type,
      ip: printer.ip ?? '',
      port: String(printer.port ?? 9100),
      paper_width: printer.paper_width,
      auto_cut: printer.auto_cut,
    });
    setEditingId(printer.id);
    setShowForm(true);
  }

  function saveForm() {
    if (!form.name.trim()) { toast.error('Printer name is required'); return; }
    if (form.type === 'network' && !form.ip.trim()) { toast.error('IP address is required'); return; }

    const device: PrinterDevice = {
      id: form.id,
      name: form.name.trim(),
      type: form.type,
      ip: form.type === 'network' ? form.ip.trim() : undefined,
      port: form.type === 'network' ? (parseInt(form.port) || 9100) : undefined,
      paper_width: form.paper_width,
      auto_cut: form.auto_cut,
    };

    setConfig((prev) => {
      const printers = editingId
        ? prev.printers.map((p) => p.id === editingId ? device : p)
        : [...prev.printers, device];
      const default_bill_printer = prev.default_bill_printer ?? (printers.length === 1 ? device.id : prev.default_bill_printer);
      return { ...prev, printers, default_bill_printer };
    });
    setShowForm(false);
    setEditingId(null);
  }

  function deletePrinter(id: string) {
    if (!confirm('Delete this printer?')) return;
    setConfig((prev) => ({
      ...prev,
      printers: prev.printers.filter((p) => p.id !== id),
      default_bill_printer: prev.default_bill_printer === id ? null : prev.default_bill_printer,
      station_routing: Object.fromEntries(
        Object.entries(prev.station_routing).filter(([, v]) => v !== id)
      ),
    }));
  }

  async function connectUSB(printer: PrinterDevice) {
    setUsbConnecting(printer.id);
    try {
      const { printerService } = await import('@/lib/printer-service');
      const result = await printerService.connectUSB(printer.id);
      if (result.success) {
        setUsbStatus((prev) => ({ ...prev, [printer.id]: result.deviceName ?? 'Connected' }));
        toast.success(`Connected: ${result.deviceName ?? 'USB Printer'}`);
      } else {
        if (result.error !== 'No device selected') toast.error(result.error ?? 'Connection failed');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setUsbConnecting(null);
    }
  }

  async function testPrinter(printer: PrinterDevice) {
    setTesting(printer.id);
    try {
      const { printerService } = await import('@/lib/printer-service');
      const result = await printerService.testPrint(printer);
      if (result.success) {
        toast.success('Test page sent!');
      } else {
        // browser fallback
        if (result.error === 'Use browser fallback') {
          window.print();
        } else {
          toast.error(result.error ?? 'Test failed');
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(null);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('restaurants')
        .update({ printer_config: config })
        .eq('id', restaurant.id);
      if (error) throw error;
      toast.success('Printer settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Printer list ── */}
      <div className="space-y-3">
        {config.printers.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed rounded-xl text-muted-foreground">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No printers configured</p>
            <p className="text-xs mt-1">Add a USB or network thermal printer</p>
          </div>
        )}

        {config.printers.map((printer) => {
          const isDefault = config.default_bill_printer === printer.id;
          const usbConnected = usbStatus[printer.id];

          return (
            <div key={printer.id} className={cn(
              'flex items-center gap-3 p-4 rounded-xl border bg-white',
              isDefault && 'border-blue-300 bg-blue-50/30'
            )}>
              <div className={cn(
                'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                printer.type === 'usb'     ? 'bg-purple-100 text-purple-600' :
                printer.type === 'network' ? 'bg-green-100 text-green-600' :
                                             'bg-gray-100 text-gray-600'
              )}>
                {TYPE_ICONS[printer.type]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{printer.name}</p>
                  {isDefault && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Bill</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABELS[printer.type]}
                  {printer.type === 'network' && printer.ip ? ` · ${printer.ip}:${printer.port ?? 9100}` : ''}
                  {printer.type === 'usb' && usbConnected ? ` · ${usbConnected} ✓` : ''}
                  {printer.type === 'usb' && !usbConnected ? ' · Not connected' : ''}
                  {' · '}{printer.paper_width}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {printer.type === 'usb' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connectUSB(printer)}
                    disabled={usbConnecting === printer.id || !webUSBSupported}
                    title={!webUSBSupported ? 'WebUSB requires Chrome or Edge' : 'Connect USB printer'}
                  >
                    {usbConnecting === printer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Usb className="w-3.5 h-3.5" />}
                    {usbConnected ? 'Reconnect' : 'Connect'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testPrinter(printer)}
                  disabled={testing === printer.id}
                  title="Send test print"
                >
                  {testing === printer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                </Button>
                {!isDefault && config.printers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConf('default_bill_printer', printer.id)}
                    title="Set as default bill printer"
                    className="text-xs text-muted-foreground"
                  >
                    Set Bill
                  </Button>
                )}
                <button onClick={() => openEdit(printer)} className="p-1.5 rounded hover:bg-gray-100 text-muted-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deletePrinter(printer.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {!showForm && (
          <Button variant="outline" onClick={openAdd} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Printer
          </Button>
        )}
      </div>

      {/* ── Add/Edit form ── */}
      {showForm && (
        <div className="p-5 rounded-xl border bg-white space-y-4">
          <h3 className="font-semibold text-sm">{editingId ? 'Edit Printer' : 'Add Printer'}</h3>

          <div className="space-y-1">
            <Label>Printer Name</Label>
            <Input value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="e.g. Kitchen Printer" />
          </div>

          <div className="space-y-2">
            <Label>Connection Type</Label>
            <div className="flex gap-2">
              {(['usb', 'network', 'browser'] as PrinterConnectionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setF('type', t)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors',
                    form.type === t ? 'bg-blue-50 border-blue-400 text-blue-800' : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {TYPE_ICONS[t]}
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {form.type === 'browser' && (
              <p className="text-xs text-muted-foreground">Falls back to browser print dialog. Works everywhere.</p>
            )}
            {form.type === 'usb' && !webUSBSupported && (
              <p className="text-xs text-amber-600">WebUSB requires Chrome or Edge browser.</p>
            )}
          </div>

          {form.type === 'network' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>IP Address</Label>
                <Input value={form.ip} onChange={(e) => setF('ip', e.target.value)} placeholder="192.168.1.100" />
              </div>
              <div className="space-y-1">
                <Label>Port</Label>
                <Input value={form.port} onChange={(e) => setF('port', e.target.value)} placeholder="9100" />
              </div>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <div className="space-y-1 flex-1">
              <Label>Paper Width</Label>
              <div className="flex gap-2">
                {(['80mm', '58mm'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setF('paper_width', w)}
                    className={cn(
                      'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                      form.paper_width === w ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-5">
              <input
                type="checkbox"
                checked={form.auto_cut}
                onChange={(e) => setF('auto_cut', e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm">Auto-cut</span>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={saveForm} size="sm">
              <Check className="w-4 h-4 mr-1.5" />
              {editingId ? 'Update' : 'Add Printer'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Station routing ── */}
      {config.printers.length > 0 && categories.length > 0 && (
        <div className="rounded-xl border bg-white p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Station Routing</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Route each menu category&apos;s KOT to a specific printer</p>
          </div>
          <div className="space-y-2">
            {/* Deduplicate by name — routing key is category name to match order_items.category_name */}
            {categories
              .filter((cat, idx, arr) => arr.findIndex((c) => c.name === cat.name) === idx)
              .map((cat) => (
              <div key={cat.name} className="flex items-center justify-between gap-3">
                <span className="text-sm flex-1 truncate">{cat.name}</span>
                <select
                  value={config.station_routing[cat.name] ?? ''}
                  onChange={(e) => setConf('station_routing', { ...config.station_routing, [cat.name]: e.target.value })}
                  className="text-sm rounded-md border border-input bg-background px-2 py-1 w-48"
                >
                  <option value="">Default (first printer)</option>
                  {config.printers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Global print settings ── */}
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <h3 className="font-semibold text-sm">Print Behaviour</h3>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium">Auto-print KOT on acceptance</p>
            <p className="text-xs text-muted-foreground">Automatically print kitchen ticket when order is accepted</p>
          </div>
          <input type="checkbox" checked={config.auto_print_kot} onChange={(e) => setConf('auto_print_kot', e.target.checked)} className="h-4 w-4 rounded" />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium">Auto-print bill on delivery</p>
            <p className="text-xs text-muted-foreground">Automatically print customer bill when order is delivered</p>
          </div>
          <input type="checkbox" checked={config.auto_print_bill} onChange={(e) => setConf('auto_print_bill', e.target.checked)} className="h-4 w-4 rounded" />
        </label>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Print copies</span>
          <div className="flex gap-2">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConf('copies', n)}
                className={cn(
                  'w-10 h-8 rounded-md border text-sm font-medium transition-colors',
                  config.copies === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Save button ── */}
      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Printer Settings
        </Button>
      </div>
    </div>
  );
}
