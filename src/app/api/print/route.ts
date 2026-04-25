import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import net from 'net';

// In-memory de-dupe for network printers: prevents double-prints when multiple
// devices with dashboard open all forward the same bill-print broadcast to the
// same network printer. USB/serial prints skip this route entirely.
const recentPrints = new Map<string, number>();

function pruneStaleEntries() {
  const cutoff = Date.now() - 30_000;
  for (const [key, ts] of recentPrints) {
    if (ts < cutoff) recentPrints.delete(key);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { printer_ip, printer_port, data, dedupe_key } = body as {
    printer_ip?: string;
    printer_port?: number;
    data?: number[];
    dedupe_key?: string;
  };

  if (!printer_ip || typeof printer_ip !== 'string') {
    return NextResponse.json({ error: 'printer_ip required' }, { status: 400 });
  }
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: 'data required' }, { status: 400 });
  }

  if (dedupe_key) {
    pruneStaleEntries();
    const lastPrint = recentPrints.get(dedupe_key);
    if (lastPrint && Date.now() - lastPrint < 10_000) {
      return NextResponse.json({ success: true, deduplicated: true });
    }
    recentPrints.set(dedupe_key, Date.now());
  }

  const port = printer_port ?? 9100;
  const buffer = Buffer.from(data);

  return new Promise<NextResponse>((resolve) => {
    const client = new net.Socket();
    let settled = false;

    const done = (res: NextResponse) => {
      if (!settled) {
        settled = true;
        try { client.destroy(); } catch { /* ignore */ }
        resolve(res);
      }
    };

    const timeout = setTimeout(() => {
      done(NextResponse.json({ success: false, error: 'Printer timeout' }, { status: 504 }));
    }, 5000);

    client.connect(port, printer_ip, () => {
      client.write(buffer, () => {
        client.end();
      });
    });

    client.on('close', () => {
      clearTimeout(timeout);
      done(NextResponse.json({ success: true }));
    });

    client.on('error', (err: Error) => {
      clearTimeout(timeout);
      done(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
    });
  });
}
