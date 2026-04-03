// ─── ESC/POS Command Builder ──────────────────────────────────────────────────
// Standard commands compatible with Epson, TVS-E, Rongta, Bixolon, and most
// Chinese 80mm/58mm thermal printers.

export class ESCPOSBuilder {
  private buf: number[] = [];

  private push(...bytes: number[]): this {
    this.buf.push(...bytes);
    return this;
  }

  // ── Printer control ──────────────────────────────────────────────────────────

  initialize(): this {
    return this.push(0x1b, 0x40); // ESC @
  }

  cut(): this {
    return this.push(0x1d, 0x56, 0x42, 0x03); // GS V B 3 — partial cut
  }

  feed(lines: number): this {
    return this.push(0x1b, 0x64, lines & 0xff); // ESC d n
  }

  // ── Alignment ───────────────────────────────────────────────────────────────

  alignLeft(): this   { return this.push(0x1b, 0x61, 0x00); }
  alignCenter(): this { return this.push(0x1b, 0x61, 0x01); }
  alignRight(): this  { return this.push(0x1b, 0x61, 0x02); }

  // ── Text styles ─────────────────────────────────────────────────────────────

  bold(on: boolean): this {
    return this.push(0x1b, 0x45, on ? 0x01 : 0x00); // ESC E n
  }

  underline(on: boolean): this {
    return this.push(0x1b, 0x2d, on ? 0x01 : 0x00); // ESC - n
  }

  // Combined double-height + double-width (most common large text usage)
  doubleSize(on: boolean): this {
    return this.push(0x1b, 0x21, on ? 0x30 : 0x00); // ESC ! 0x30 = dbl height+width
  }

  doubleHeight(on: boolean): this {
    return this.push(0x1b, 0x21, on ? 0x10 : 0x00); // ESC ! 0x10 = dbl height only
  }

  doubleWidth(on: boolean): this {
    return this.push(0x1b, 0x21, on ? 0x20 : 0x00); // ESC ! 0x20 = dbl width only
  }

  // ── Content ──────────────────────────────────────────────────────────────────

  text(content: string): this {
    // Encode as Latin-1 (cp437/cp850 subset). Strip non-ASCII chars that
    // most cheap thermal printers can't render (e.g. Devanagari).
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      if (code < 128) {
        this.buf.push(code);
      } else if (code <= 0xff) {
        this.buf.push(code); // extended Latin (accents, etc.)
      }
      // Skip characters above U+00FF (Devanagari, emoji, etc.)
    }
    return this;
  }

  newLine(): this {
    return this.push(0x0a); // LF
  }

  dashLine(chars = 42): this {
    return this.text('-'.repeat(chars)).newLine();
  }

  // Print two strings left and right on the same line (total width = `lineWidth`)
  textColumns(left: string, right: string, lineWidth = 42): this {
    const space = lineWidth - left.length - right.length;
    if (space <= 0) {
      return this.text((left + ' ' + right).slice(0, lineWidth)).newLine();
    }
    return this.text(left + ' '.repeat(space) + right).newLine();
  }

  // Fixed-width columns: pad/truncate left string, right-align right string
  itemLine(name: string, qty: string, rate: string, amt: string, widths = [20, 4, 8, 10]): this {
    const col = (s: string, w: number, right = false) => {
      const str = s.slice(0, w);
      return right ? str.padStart(w) : str.padEnd(w);
    };
    return this
      .text(col(name, widths[0]))
      .text(col(qty,  widths[1], true))
      .text(col(rate, widths[2], true))
      .text(col(amt,  widths[3], true))
      .newLine();
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  build(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatINR(amount: number): string {
  return '\u20B9' + amount.toFixed(0);
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}  ${time}`;
}
