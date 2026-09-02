import type { InventoryRepository } from '../../db/repository';

export async function approvePromo(repo: InventoryRepository, promoId: string) {
  const promo = await repo.getPromo(promoId);
  if (!promo) throw new Error('Promo tidak ditemukan');
  if (promo.status !== 'proposed') throw new Error('Hanya proposed bisa di-approve');
  promo.status = 'active';
  (promo as unknown as { updated_at: string }).updated_at = new Date().toISOString();
  await repo.updatePromo(promo);
}
