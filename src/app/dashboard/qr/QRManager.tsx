'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Loader2, Download, Trash2, QrCode, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import type { Restaurant, Table } from '@/types';

interface Props {
  restaurant: Restaurant;
  initialTables: Table[];
}

interface QRTable extends Table {
  qrDataUrl?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function QRManager({ restaurant, initialTables }: Props) {
  const [tables, setTables] = useState<QRTable[]>(initialTables);
  const [tableCount, setTableCount] = useState('');
  const [generating, setGenerating] = useState(false);
  const [qrsReady, setQrsReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Generate QR data URLs for all tables on load and when tables change
  useEffect(() => {
    if (tables.length === 0) return;
    setQrsReady(false);
    Promise.all(
      tables.map(async (t) => {
        const url = `${APP_URL}/${restaurant.slug}?table=${t.id}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        return { ...t, qrDataUrl: dataUrl };
      })
    ).then((updated) => {
      setTables(updated);
      setQrsReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.length, restaurant.slug]);

  async function handleGenerate() {
    const count = parseInt(tableCount);
    if (!tableCount || isNaN(count) || count < 1 || count > 200) {
      toast.error('Enter a number between 1 and 200');
      return;
    }

    setGenerating(true);
    try {
      const supabase = createClient();

      // Find the highest existing table number
      const maxExisting = tables.reduce((m, t) => Math.max(m, t.table_number), 0);

      // Build new table rows (only tables that don't exist yet)
      const newRows = Array.from({ length: count }, (_, i) => ({
        restaurant_id: restaurant.id,
        table_number: maxExisting + i + 1,
      }));

      const { data, error } = await supabase
        .from('tables')
        .insert(newRows)
        .select();

      if (error) throw error;

      setTables((prev) => [...prev, ...(data as Table[])]);
      setTableCount('');
      toast.success(`${count} table${count > 1 ? 's' : ''} added`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate tables');
    } finally {
      setGenerating(false);
    }
  }

  function tLabel(table: QRTable) {
    return table.display_name?.trim() || `#${table.table_number}`;
  }

  async function deleteTable(table: QRTable) {
    if (!confirm(`Delete QR for Table ${tLabel(table)}?`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tables').delete().eq('id', table.id);
      if (error) throw error;
      setTables((prev) => prev.filter((t) => t.id !== table.id));
      toast.success(`Table ${tLabel(table)} deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete table');
    }
  }

  function downloadSingle(table: QRTable) {
    if (!table.qrDataUrl) return;
    const a = document.createElement('a');
    a.href = table.qrDataUrl;
    a.download = `${restaurant.slug}-table-${tLabel(table)}.png`;
    a.click();
  }

  async function downloadAll() {
    if (tables.length === 0) return;
    setDownloading(true);

    try {
      // Dynamically import jsPDF only when needed
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = 210;
      const pageH = 297;
      const cols = 2;
      const rows = 3;
      const cardW = pageW / cols;
      const cardH = pageH / rows;
      const qrSize = 55;
      const perPage = cols * rows;

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        if (!table.qrDataUrl) continue;

        if (i > 0 && i % perPage === 0) pdf.addPage();

        const col = (i % perPage) % cols;
        const row = Math.floor((i % perPage) / cols);
        const x = col * cardW + (cardW - qrSize) / 2;
        const y = row * cardH + (cardH - qrSize) / 2 - 8;

        // QR image
        pdf.addImage(table.qrDataUrl, 'PNG', x, y, qrSize, qrSize);

        // Restaurant name
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(restaurant.name, x + qrSize / 2, y + qrSize + 6, { align: 'center' });

        // Table number
        pdf.setFontSize(12);
        pdf.text(`Table ${tLabel(table)}`, x + qrSize / 2, y + qrSize + 12, {
          align: 'center',
        });
      }

      pdf.save(`${restaurant.slug}-qr-codes.pdf`);
      toast.success('PDF downloaded');
    } catch (err: unknown) {
      toast.error('Failed to generate PDF');
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            QR Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tables.length} table{tables.length !== 1 ? 's' : ''} · Each QR links to your menu
          </p>
        </div>
        {tables.length > 0 && (
          <Button
            variant="outline"
            onClick={downloadAll}
            disabled={!qrsReady || downloading}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download All PDF
          </Button>
        )}
      </div>

      {/* Generate form */}
      <div className="bg-white rounded-xl border p-4 mb-6 flex items-end gap-3">
        <div className="space-y-1 flex-1 max-w-xs">
          <Label htmlFor="table-count">Number of tables to add</Label>
          <Input
            id="table-count"
            type="number"
            min="1"
            max="200"
            value={tableCount}
            onChange={(e) => setTableCount(e.target.value)}
            placeholder="e.g. 10"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Generate
        </Button>
      </div>

      {/* Empty state */}
      {tables.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <QrCode className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No tables yet</p>
          <p className="text-sm mt-1">Enter the number of tables above and click Generate</p>
        </div>
      )}

      {/* QR grid */}
      {tables.length > 0 && (
        <div ref={printRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="bg-white rounded-xl border p-4 flex flex-col items-center gap-3"
            >
              {/* QR code */}
              <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center border overflow-hidden">
                {table.qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={table.qrDataUrl}
                    alt={`Table ${tLabel(table)} QR`}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Label */}
              <div className="text-center">
                <p className="font-semibold text-sm">{restaurant.name}</p>
                <p className="text-xs text-muted-foreground">Table {tLabel(table)}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadSingle(table)}
                  disabled={!table.qrDataUrl}
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  PNG
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive px-2"
                  onClick={() => deleteTable(table)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
