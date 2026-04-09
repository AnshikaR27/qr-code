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

// ── Minimal Web Serial type declarations ──────────────────────────────────────

interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array>;
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
}

interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

function getSerial(): Serial | null {
  if (typeof window === 'undefined') return null;
  const nav = navigator as unknown as { serial?: Serial };
  return nav.serial ?? null;
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
  private usbDevices    = new Map<string, USBDevice>();
  private serialPorts   = new Map<string, SerialPort>();
  private lastPrintTime = new Map<string, Date>();

  isWebUSBSupported(): boolean {
    return getUSB() !== null;
  }

  isWebSerialSupported(): boolean {
    return getSerial() !== null;
  }

  // ── Web Serial ─────────────────────────────────────────────────────────────

  async connectSerial(printerId: string): Promise<ConnectResult> {
    const serial = getSerial();
    if (!serial) return { success: false, error: 'Web Serial not supported. Use Chrome or Edge 89+.' };
    try {
      const port = await serial.requestPort();
      // Store so we can open it on demand per print (port may need to be opened fresh each time)
      this.serialPorts.set(printerId, port);
      return { success: true, deviceName: 'Serial Port' };
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotFoundError') return { success: false, error: 'No device selected' };
      return { success: false, error: err instanceof Error ? err.message : 'Serial connection failed' };
    }
  }

  async printToSerial(printerId: string, data: Uint8Array, baudRate = 9600): Promise<PrintResult> {
    const port = this.serialPorts.get(printerId);
    if (!port) return { success: false, error: 'Printer not connected' };
    try {
      await port.open({ baudRate });
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      await port.close();
      this.lastPrintTime.set(printerId, new Date());
      return { success: true };
    } catch (err: unknown) {
      // Port may already be open from a previous failed print
      try { await port.close(); } catch { /* ignore */ }
      return { success: false, error: err instanceof Error ? err.message : 'Serial print failed' };
    }
  }

  async reconnectSerial(config: PrinterConfig): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const serial = getSerial();
    if (!serial) return results;
    const serialPrinters = config.printers.filter((p) => p.type === 'serial');
    if (serialPrinters.length === 0) return results;
    try {
      const ports = await serial.getPorts();
      for (const printer of serialPrinters) {
        if (ports.length > 0) {
          this.serialPorts.set(printer.id, ports[0]);
          results.set(printer.id, true);
        } else {
          results.set(printer.id, false);
        }
      }
    } catch {
      for (const p of serialPrinters) results.set(p.id, false);
    }
    return results;
  }

  // Connect a new USB printer via device picker
  async connectUSB(printerId: string): Promise<ConnectResult> {
    const usb = getUSB();
    if (!usb) return { success: false, error: 'WebUSB not supported in this browser. Please use Chrome or Edge.' };

    let device: USBDevice | null = null;
    try {
      device = await usb.requestDevice({ filters: PRINTER_FILTERS });
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      const msg  = err instanceof Error ? err.message : '';
      if (name === 'NotFoundError' || msg.includes('No device selected')) {
        return { success: false, error: 'No device selected' };
      }
      return { success: false, error: msg || 'Could not open device picker' };
    }

    // Open the device — only ignore "already open" error
    try {
      await device.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('already')) {
        console.error('[printer] device.open() failed:', err);
        return { success: false, error: this.friendlyUSBError(err) };
      }
    }

    // Select configuration if needed
    try {
      if (device.configuration === null || device.configuration === undefined) {
        await device.selectConfiguration(1);
      }
    } catch (err: unknown) {
      console.error('[printer] selectConfiguration failed:', err);
      // Non-fatal on some devices — continue
    }

    // Claim interface
    try {
      await this.claimPrinterInterface(device);
    } catch (err: unknown) {
      console.error('[printer] claimInterface failed:', err);
      return { success: false, error: this.friendlyUSBError(err) };
    }

    this.usbDevices.set(printerId, device);
    return {
      success: true,
      deviceName: device.productName ?? device.manufacturerName ?? 'USB Printer',
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber,
    };
  }

  private friendlyUSBError(err: unknown): string {
    const name = err instanceof DOMException ? err.name : '';
    const msg  = (err instanceof Error ? err.message : String(err)).toLowerCase();

    if (name === 'SecurityError' || msg.includes('access denied') || msg.includes('access') && msg.includes('denied')) {
      return 'Access denied. Windows USB driver is blocking the connection. See instructions below to fix this.';
    }
    if (name === 'NetworkError' || msg.includes('unable to claim') || msg.includes('claim interface') || msg.includes('failed to open')) {
      return 'Windows USB driver conflict — the printer is claimed by Windows. See instructions below to fix this.';
    }
    if (msg.includes('not found') || name === 'NotFoundError') {
      return 'Printer not found. Make sure it is plugged in and turned on.';
    }
    return (err instanceof Error ? err.message : String(err)) || 'USB connection failed';
  }

  // Auto-reconnect previously paired USB devices — matches by VID/PID/serial if stored
  async reconnectAll(config: PrinterConfig): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Serial printers
    const serialResults = await this.reconnectSerial(config);
    serialResults.forEach((v, k) => results.set(k, v));

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
    } else if (printer.type === 'serial') {
      return this.printToSerial(printer.id, data, printer.baud_rate ?? 9600);
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
