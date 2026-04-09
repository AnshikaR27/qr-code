import type { PrinterDevice, PrinterConfig } from '@/types';

// ── Minimal WebUSB type declarations ─────────────────────────────────────────

interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
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
  filters: Array<{ classCode?: number; vendorId?: number; productId?: number }>;
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

// Broad set of filters covering common thermal printer vendors + generic USB printer class
const PRINTER_FILTERS: USBRequestDeviceOptions['filters'] = [
  { classCode: 7 },        // USB Printer class (works for most ESC/POS printers)
  { vendorId: 0x04b8 },    // Epson
  { vendorId: 0x0519 },    // Star Micronics
  { vendorId: 0x154f },    // Bixolon
  { vendorId: 0x1504 },    // Bixolon alternate
  { vendorId: 0x0fe6 },    // ICS Advent / Bixolon
  { vendorId: 0x28e9 },    // Xprinter (common in India)
  { vendorId: 0x0dd4 },    // Custom / generic Chinese
  { vendorId: 0x1cbe },    // Rongta
  { vendorId: 0x0483 },    // STMicroelectronics
  { vendorId: 0x0416 },    // Winbond
  { vendorId: 0x20d1 },    // TVS Electronics (common in India)
  { vendorId: 0x1d5f },    // POS-X
  { vendorId: 0x0525 },    // Netchip Technology
];

// ── Printer Service ───────────────────────────────────────────────────────────

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface ConnectResult {
  success: boolean;
  deviceName?: string;
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
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
    if (!usb) return { success: false, error: 'WebUSB not supported in this browser. Please use Chrome or Edge.' };

    try {
      const device = await usb.requestDevice({ filters: PRINTER_FILTERS });
      try { await device.open(); } catch { /* may already be open */ }
      if (device.configuration === null || device.configuration === undefined) {
        await device.selectConfiguration(1);
      }
      await this.claimPrinterInterface(device);
      this.usbDevices.set(printerId, device);
      return {
        success: true,
        deviceName: device.productName ?? device.manufacturerName ?? 'USB Printer',
        vendorId: device.vendorId,
        productId: device.productId,
        serialNumber: device.serialNumber,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      if (msg.includes('No device selected') || msg.includes('NotFoundError')) {
        return { success: false, error: 'No device selected' };
      }
      // Windows driver conflict — give actionable guidance
      if (msg.includes('access') || msg.includes('claim') || msg.includes('NetworkError')) {
        return {
          success: false,
          error: 'Windows USB driver conflict. Open Zadig, select your printer, install WinUSB driver, then try again.',
        };
      }
      return { success: false, error: msg };
    }
  }

  // Auto-reconnect previously paired USB devices — matches by VID/PID/serial if stored
  async reconnectAll(config: PrinterConfig): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const usb = getUSB();
    if (!usb) return results;

    const usbPrinters = config.printers.filter((p) => p.type === 'usb');
    if (usbPrinters.length === 0) return results;

    let pairedDevices: USBDevice[] = [];
    try {
      pairedDevices = await usb.getDevices();
    } catch {
      for (const p of usbPrinters) results.set(p.id, false);
      return results;
    }

    if (pairedDevices.length === 0) {
      for (const p of usbPrinters) results.set(p.id, false);
      return results;
    }

    for (const printer of usbPrinters) {
      // Try to find the specific device this printer was paired with
      let device: USBDevice | undefined;

      if (printer.vendor_id !== undefined && printer.product_id !== undefined) {
        // Match by VID+PID, optionally serial
        device = pairedDevices.find(
          (d) =>
            d.vendorId === printer.vendor_id &&
            d.productId === printer.product_id &&
            (!printer.serial_number || d.serialNumber === printer.serial_number),
        );
      }

      // Fallback: use first available paired device
      if (!device) device = pairedDevices[0];

      try {
        try { await device.open(); } catch { /* may already be open */ }
        if (device.configuration === null || device.configuration === undefined) {
          await device.selectConfiguration(1);
        }
        await this.claimPrinterInterface(device);
        this.usbDevices.set(printer.id, device);
        results.set(printer.id, true);
      } catch {
        results.set(printer.id, false);
      }
    }

    return results;
  }

  private async claimPrinterInterface(device: USBDevice): Promise<void> {
    const config = device.configuration;
    if (config) {
      for (const iface of config.interfaces) {
        try {
          await device.claimInterface(iface.interfaceNumber);
          return;
        } catch {
          // try next interface
        }
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
      if (msg.includes('disconnected') || msg.includes('closed') || msg.includes('device lost')) {
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
