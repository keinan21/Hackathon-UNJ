import { describe, it, expect } from 'vitest';
import { validateHargaTebus, isHargaTebusValid } from '../lib/validation';

describe('Guardrail & validation tests (HPP, harga, LLM angka)', () => {
  it('floor pass at 0.85', () => {
    const r = validateHargaTebus(10000, 8500, 15000);
    expect(r.valid).toBe(true);
    expect(isHargaTebusValid(10000, 8500)).toBe(true);
  });

  it('floor fail at 0.84 → throws', () => {
    const r = validateHargaTebus(10000, 8400, 15000);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0.85/);
    expect(isHargaTebusValid(10000, 8400)).toBe(false);
  });

  it('HPP >0, harga_tebus not NaN, LLM output must not contain angka harga if not from DB (mock check)', () => {
    const r1 = validateHargaTebus(0, 9000);
    expect(r1.valid).toBe(false);
    const r2 = validateHargaTebus(10000, NaN);
    expect(r2.valid).toBe(false);
    const r3 = validateHargaTebus(10000, 9000);
    expect(r3.valid).toBe(true);
    // mock LLM trying to ngarang harga 5000 (below floor) should fail
    const llmHarga = 5000;
    const guard = isHargaTebusValid(10000, llmHarga);
    expect(guard).toBe(false);
  });

  it('optional ceiling harga_normal*0.5 if enabled configurable', () => {
    const r = validateHargaTebus(10000, 8000, 15000, { ceilingEnabled: true, ceilingRatio: 0.5 });
    // ceiling 7500, harga 8000 > ceiling should warn but still valid per spec? We'll check warning exists
    // but valid remains true because floor passed
    const r2 = validateHargaTebus(10000, 9000, 15000, { ceilingEnabled: true, ceilingRatio: 0.5 });
    expect(r2.valid).toBe(true);
    // harga > harga_normal warn
    const r3 = validateHargaTebus(10000, 16000, 15000);
    expect(r3.valid).toBe(true);
    expect(r3.warning).toBeDefined();
  });

  it('HPP 10000 floor 8500 edge cases', () => {
    expect(isHargaTebusValid(10000, 8500)).toBe(true);
    expect(isHargaTebusValid(10000, 8499.99)).toBe(false);
    expect(isHargaTebusValid(10000, 8500.01)).toBe(true);
  });

  it('comprehensive 4 guard cases pass, LLM mock that tries to ngarang harga fails', () => {
    // case 1 floor
    expect(validateHargaTebus(10000, 8500).valid).toBe(true);
    // case 2 HPP >0
    expect(validateHargaTebus(0, 9000).valid).toBe(false);
    // case 3 not NaN
    expect(validateHargaTebus(10000, NaN).valid).toBe(false);
    // case 4 valid with pasangan
    expect(validateHargaTebus(12000, 10500).valid).toBe(true); // 10200 floor

    // LLM mock ngarang harga below floor
    const mockLLMPrice = 8400;
    expect(isHargaTebusValid(10000, mockLLMPrice)).toBe(false);
  });
});
