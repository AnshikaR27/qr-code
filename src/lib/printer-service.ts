import type { PrinterDevice, PrinterConfig } from '@/types';

// ── Minimal WebUSB type declarations ─────────────────────────────────────────

interface USBDevice {
  productName?: string;
  serialNumber?: string;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ bytesWritten: number }>;
  configuration?: {
    interfaces: Array<{
      interfaceNumber: number;
      alternates: Array<{
        endpoints: Array<{
          direction: string;
          type: string;
          endpointNumber: number;
        }>;
      }>;
    }>;
  };
}

interface USBRequestDeviceOptions {
  filters: Array<{ classCode?: number; vendorId?: number }>;
}

interface USB {
  requestDevice(options: USBRequestDeviceOptions): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

function getUSB(): USB | null {
  if (typeof window === 'undefined') return null;
  const nav = navigator as unknown as { usb?: USB };
  return nav.usb ?? null;
}

// ── Printer Service ───────────────────────────────────────────────────────────

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface ConnectResult {
  success: boolean;
  deviceName?: string;
  error?: string;
}

class ThermalPrinterService {
  private usbDevices = new Map<string, USBDevice>();
  private lastPrintTime = new Map<string, Date>();

  isWebUSBSupported(): boolean {
    return getUSB() !== null;
  }

  // Connect a new USB printer via device picker
  async connectUSB(printerId: string): Promise<ConnectResult> {
    const usb = getUSB();
    if (!usb) return { success: false, error: 'WebUSB not supported in this browser' };

    try {
      const device = await usb.requestDevice({
        filters: [{ classCode: 7 }], // USB Printer class
      });
      await device.open();
      if (device.configuration === null || device.configuration === undefined) {
        await device.selectConfiguration(1);
      }
      await this.claimPrinterInterface(device);
      this.usbDevices.set(printerId, device);
      return { success: true, deviceName: device.productName ?? 'USB Printer' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      if (msg.includes('No device selected')) return { success: false, error: 'No device selected' };
      return { success: false, error: msg };
    }
  }

  // Auto-reconnect previously paired USB devices (no picker)
  async reconnectAll(config: PrinterConfig): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const usb = getUSB();
    if (!usb) return results;

    const usbPrinters = config.printers.filter((p) => p.type === 'usb');
    if (usbPrinters.length === 0) return results;

    try {
      const pairedDevices = await usb.getDevices();
      for (const printer of usbPrinters) {
        if (pairedDevices.length > 0) {
          // Try each paired device — match by index or use first available
          const device = pairedDevices[0];
          try {
            await device.open();
            if (device.configuration === null || device.configuration === undefined) {
              await device.selectConfiguration(1);
            }
            await this.claimPrinterInterface(device);
            this.usbDevices.set(printer.id, device);
            results.set(printer.id, true);
          } catch {
            results.set(printer.id, false);
          }
        } else {
          results.set(printer.id, false);
        }
      }
    } catch {
      for (const p of usbPrinters) results.set(p.id, false);
    }

    return results;
  }

  private async claimPrinterInterface(device: USBDevice): Promise<void> {
    const config = device.configuration;
    if (!config) return;
    for (const iface of config.interfaces) {
      try {
        await device.claimInterface(iface.interfaceNumber);
        return;
      } catch {
        // try next interface
      }
    }
    // Fallback: try interface 0
    await device.claimInterface(0);
  }

  private findBulkOutEndpoint(device: USBDevice): number {
    const config = device.configuration;
    if (config) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out' && ep.type === 'bulk') {
              return ep.endpointNumber;
            }
          }
        }
      }
    }
    return 1; // fallback
  }

  async printToUSB(printerId: string, data: Uint8Array): Promise<PrintResult> {
    const device = this.usbDevices.get(printerId);
    if (!device) return { success: false, error: 'Printer not connected' };

    try {
      const endpoint = this.findBulkOutEndpoint(device);
      await device.transferOut(endpoint, data as unknown as ArrayBuffer);
      this.lastPrintTime.set(printerId, new Date());
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      // Try once more — device may have reconnected
      if (msg.includes('disconnected') || msg.includes('closed')) {
        this.usbDevices.delete(printerId);
        return { success: false, error: 'Printer disconnected. Please reconnect.' };
      }
      return { success: false, error: msg };
    }
  }

  async printToNetwork(ip: string, port: number, data: Uint8Array): Promise<PrintResult> {
    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_ip: ip, printer_port: port, data: Array.from(data) }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        return { success: false, error: json.error ?? 'Network print failed' };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  // Smart print — picks the right method based on printer config
  async print(printer: PrinterDevice, data: Uint8Array): Promise<PrintResult> {
    if (printer.type === 'usb') {
      return this.printToUSB(printer.id, data);
    } else if (printer.type === 'network') {
      return this.printToNetwork(printer.ip ?? '', printer.port ?? 9100, data);
    } else {
      // Browser fallback — caller should handle this
      return { success: false, error: 'Use browser fallback' };
    }
  }

  async testPrint(printer: PrinterDevice): Promise<PrintResult> {
    const { ESCPOSBuilder } = await import('./escpos');
    const data = new ESCPOSBuilder()
      .initialize()
      .alignCenter()
      .bold(true)
      .text('TEST PRINT')
      .newLine()
      .bold(false)
      .text(printer.name)
      .newLine()
      .text(new Date().toLocaleString('en-IN'))
      .newLine()
      .dashLine(printer.paper_width === '58mm' ? 32 : 42)
      .text('Printer OK!')
      .newLine()
      .feed(4)
      .cut()
      .build();
    return this.print(printer, data);
  }

  isUSBConnected(printerId: string): boolean {
    return this.usbDevices.has(printerId);
  }

  getLastPrintTime(printerId: string): Date | null {
    return this.lastPrintTime.get(printerId) ?? null;
  }

  async disconnectUSB(printerId: string): Promise<void> {
    const device = this.usbDevices.get(printerId);
    if (device) {
      try { await device.close(); } catch { /* ignore */ }
      this.usbDevices.delete(printerId);
    }
  }
}

// Module-level singleton
export const printerService = new ThermalPrinterService();
