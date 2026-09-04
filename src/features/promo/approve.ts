import type { InventoryRepository } from '../../db/repository';
import type { Promo } from '../../db/types';
import { daysToExpiry } from '../../engine/expiry';
import { validatePromoUsul } from '../../lib/validation';

export async function approvePromo(repo: InventoryRepository, promoId: string, now = new Date()): Promise<Promo> {
  const promo = await repo.getPromo(promoId);
  if (!promo) throw new Error('Promo tidak ditemukan');
  if (promo.status !== 'proposed') throw new Error('Hanya proposed bisa di-approve');
  const batch = await repo.getBatch(promo.batch_id);
  if (!batch) throw new Error('Batch tidak ditemukan');
  if (batch.qty <= 0) throw new Error('Stok habis, tidak bisa approve tebus murah');
  const sku = await repo.getSku(batch.sku_id);
  if (!sku) throw new Error('SKU tidak ditemukan');
  const hpp = batch.hpp_snapshot;
  const hargaTebus = promo.harga_tebus;
  const guard = validatePromoUsul('tebus', { hpp, harga_tebus: hargaTebus, harga_normal: sku.harga_normal });
  if (!guard.valid) throw new Error(guard.error ?? 'Harga tebus tidak valid');
  const active = { ...promo, status: 'active' as const, updated_at: now.toISOString() };
  await repo.updatePromo(active);
  return active;
}

export async function rejectPromo(repo: InventoryRepository, promoId: string): Promise<void> {
  const promo = await repo.getPromo(promoId);
  if (!promo) throw new Error('Promo tidak ditemukan');
  if (promo.status !== 'proposed') throw new Error('Hanya proposed bisa ditolak');
  await repo.deletePromo(promo.id);
}

export async function updatePromoLifecycle(repo: InventoryRepository, orgId: string, today = new Date()): Promise<Promo[]> {
  const active = await repo.listPromos(orgId, 'active');
  const changed: Promo[] = [];
  for (const promo of active) {
    const batch = await repo.getBatch(promo.batch_id);
    const days = batch?.expiry_date ? daysToExpiry(batch.expiry_date, today) : null;
    const status: Promo['status'] | null = !batch || batch.qty <= 0 ? 'consumed' : days !== null && days < 0 ? 'expired' : null;
    if (!status) continue;
    const updated: Promo = { ...promo, status, updated_at: today.toISOString() };
    await repo.updatePromo(updated);
    changed.push(updated);
  }
  return changed;
}
