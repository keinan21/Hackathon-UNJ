export function validateHargaTebus(
  hpp: number,
  hargaTebus: number,
  hargaNormal?: number,
  options?: { ceilingEnabled?: boolean; ceilingRatio?: number },
): { valid: boolean; error?: string; warning?: string } {
  if (!Number.isFinite(hpp) || hpp <= 0) {
    return { valid: false, error: 'HPP harus lebih dari 0' };
  }
  if (!Number.isFinite(hargaTebus)) {
    return { valid: false, error: 'Harga tebus tidak valid' };
  }
  if (Number.isNaN(hargaTebus)) {
    return { valid: false, error: 'Harga tebus tidak boleh NaN' };
  }
  const floor = hpp * 0.85;
  if (hargaTebus < floor - 1e-9) {
    return { valid: false, error: `Harga tebus tidak boleh di bawah HPP x 0.85 (Rp ${Math.round(floor).toLocaleString('id-ID')})` };
  }
  if (options?.ceilingEnabled && hargaNormal !== undefined) {
    const ceiling = hargaNormal * (options.ceilingRatio ?? 0.5);
    // spec says optional ceiling harga_normal*0.5 if enabled configurable
    // but Gherkin says harga > harga_normal warn. We'll treat ceiling as warning if hargaTebus > hargaNormal
    if (hargaTebus > hargaNormal) {
      return { valid: true, warning: `Harga tebus melebihi harga normal Rp ${hargaNormal.toLocaleString('id-ID')}` };
    }
    if (hargaTebus > ceiling) {
      // if ceiling enabled and harga exceeds ceiling, warn
      return { valid: true, warning: `Harga tebus melebihi batas wajar (>${Math.round(ceiling).toLocaleString('id-ID')})` };
    }
  } else if (hargaNormal !== undefined && hargaTebus > hargaNormal) {
    return { valid: true, warning: `Harga tebus melebihi harga normal Rp ${hargaNormal.toLocaleString('id-ID')}` };
  }
  return { valid: true };
}

export function isHargaTebusValid(hpp: number, hargaTebus: number): boolean {
  if (!Number.isFinite(hpp) || hpp <= 0) return false;
  if (!Number.isFinite(hargaTebus) || Number.isNaN(hargaTebus)) return false;
  return hargaTebus >= hpp * 0.85 - 1e-9;
}

export function validateThreshold(threshold: number[]): { valid: boolean; error?: string } {
  if (!threshold.length) return { valid: false, error: 'Threshold tidak boleh kosong' };
  if (new Set(threshold).size !== threshold.length) return { valid: false, error: 'Angka tidak boleh sama' };
  for (let i = 1; i < threshold.length; i++) {
    if (threshold[i] >= threshold[i - 1]) return { valid: false, error: 'Harus urut besar ke kecil' };
  }
  if (threshold.some(v => v <= 0)) return { valid: false, error: 'Harus lebih dari 0' };
  return { valid: true };
}

export function validateHPP(hpp: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(hpp) || hpp <= 0) return { valid: false, error: 'HPP harus lebih dari 0' };
  return { valid: true };
}
