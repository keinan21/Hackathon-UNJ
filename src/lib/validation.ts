export function validateHargaTebus(
  hpp: number,
  hargaTebus: number,
  hargaNormal?: number,
  options?: { ceilingEnabled?: boolean; ceilingRatio?: number },
): { valid: boolean; error?: string; warning?: string } {
  if (!Number.isFinite(hpp) || hpp <= 0) {
    return { valid: false, error: 'HPP harus lebih dari 0' };
  }
  if (Number.isNaN(hargaTebus)) {
    return { valid: false, error: 'Harga tebus tidak boleh NaN' };
  }
  if (!Number.isFinite(hargaTebus)) {
    return { valid: false, error: 'Harga tebus tidak valid' };
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

export type PromoJenis = 'tebus' | 'bundling' | 'bogo' | 'diskon' | 'cashback';

export type PromoUsulParams = {
  hpp?: number;
  harga_tebus?: number;
  harga_normal?: number;
  hppList?: number[];
  total_paket?: number;
  margin?: number;
  cashback?: number;
};

function formatRp(n: number): string {
  return Math.round(n).toLocaleString('id-ID');
}

/**
 * Guardrail per-jenis promo — TASK-19
 * - tebus & diskon: harga >= HPP*0.85
 * - bundling: total paket >= ΣHPP*0.85
 * - BOGO: harga_normal/2 >= HPP*0.85
 * - cashback: margin − cashback >= 0 + floor HPP*0.85 tetap
 * Pesan Bahasa Indonesia, menyebut floor exact Rp.
 */
export function validatePromoUsul(
  jenis: PromoJenis,
  params: PromoUsulParams,
): { valid: boolean; error?: string; warning?: string } {
  switch (jenis) {
    case 'tebus':
    case 'diskon': {
      const hpp = params.hpp;
      const harga = params.harga_tebus;
      if (hpp === undefined || !Number.isFinite(hpp) || hpp <= 0) {
        return { valid: false, error: 'HPP harus lebih dari 0' };
      }
      if (harga === undefined || Number.isNaN(harga) || !Number.isFinite(harga)) {
        return { valid: false, error: jenis === 'diskon' ? 'Harga diskon tidak valid' : 'Harga tebus tidak valid' };
      }
      const floor = hpp * 0.85;
      if (harga < floor - 1e-9) {
        const label = jenis === 'diskon' ? 'Harga diskon' : 'Harga tebus';
        return { valid: false, error: `${label} tidak boleh di bawah HPP x 0.85 (Rp ${formatRp(floor)})` };
      }
      if (params.harga_normal !== undefined && harga > params.harga_normal) {
        return { valid: true, warning: `Harga tebus melebihi harga normal Rp ${params.harga_normal.toLocaleString('id-ID')}` };
      }
      return { valid: true };
    }
    case 'bundling': {
      const list = params.hppList;
      const total = params.total_paket;
      if (!Array.isArray(list) || list.length === 0) {
        return { valid: false, error: 'Daftar HPP bundling tidak boleh kosong' };
      }
      for (const v of list) {
        if (!Number.isFinite(v) || v <= 0) return { valid: false, error: 'HPP harus lebih dari 0' };
      }
      if (total === undefined || !Number.isFinite(total) || Number.isNaN(total)) {
        return { valid: false, error: 'Total paket tidak valid' };
      }
      const sum = list.reduce((a, b) => a + b, 0);
      const floor = sum * 0.85;
      if (total < floor - 1e-9) {
        return { valid: false, error: `Total paket tidak boleh di bawah ΣHPP x 0.85 (Rp ${formatRp(floor)}) — HPP x 0.85 = Rp ${formatRp(floor)}` };
      }
      return { valid: true };
    }
    case 'bogo': {
      const hpp = params.hpp;
      const hargaNormal = params.harga_normal;
      if (hpp === undefined || !Number.isFinite(hpp) || hpp <= 0) {
        return { valid: false, error: 'HPP harus lebih dari 0' };
      }
      if (hargaNormal === undefined || !Number.isFinite(hargaNormal) || hargaNormal <= 0) {
        return { valid: false, error: 'Harga normal tidak valid' };
      }
      const floor = hpp * 0.85;
      const half = hargaNormal / 2;
      if (half < floor - 1e-9) {
        return { valid: false, error: `Harga tebus tidak boleh di bawah HPP x 0.85 (Rp ${formatRp(floor)}) — harga_normal/2 = Rp ${formatRp(half)} di bawah floor` };
      }
      return { valid: true };
    }
    case 'cashback': {
      const hpp = params.hpp;
      const harga = params.harga_tebus;
      const margin = params.margin;
      const cashback = params.cashback;
      if (hpp === undefined || !Number.isFinite(hpp) || hpp <= 0) {
        return { valid: false, error: 'HPP harus lebih dari 0' };
      }
      if (harga === undefined || Number.isNaN(harga) || !Number.isFinite(harga)) {
        return { valid: false, error: 'Harga tebus tidak valid' };
      }
      const floor = hpp * 0.85;
      if (harga < floor - 1e-9) {
        return { valid: false, error: `Harga tebus tidak boleh di bawah HPP x 0.85 (Rp ${formatRp(floor)})` };
      }
      if (margin === undefined || !Number.isFinite(margin)) {
        return { valid: false, error: 'Margin tidak valid' };
      }
      if (cashback === undefined || !Number.isFinite(cashback) || cashback < 0) {
        return { valid: false, error: 'Cashback tidak valid' };
      }
      if (margin - cashback < -1e-9) {
        return { valid: false, error: `Cashback melebihi margin (margin Rp ${formatRp(margin)} − cashback Rp ${formatRp(cashback)} < 0)` };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: 'Jenis promo tidak dikenal' };
  }
}
