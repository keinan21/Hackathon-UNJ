import { realRepo } from "../../db/dexieRepository";
import { LangChainGeminiAdvisor, type LLMPort } from "../../advisor/LangChainGeminiAdvisor";
import { validatePromoUsul } from "../../lib/validation";

/**
 * Wording lokal tanpa LLM — dipakai saat offline / tanpa API key.
 * Bentuk hasil sama seperti LLMPort.generate, angka tetap dari DB.
 */
class LocalWordingLLM implements LLMPort {
  async generate(input: {
    sku: { nama: string };
    batch: { qty: number };
    daysToExpiry: number;
    pasanganSku: { nama: string } | null;
    hpp: number;
    hargaNormal: number;
    hargaTebus: number;
  }): Promise<{ aksi: string; alasan: string; confidence: "Tinggi" | "Sedang" | "Rendah" }> {
    const pasangan = input.pasanganSku?.nama ?? "barang laris";
    return {
      aksi: `Tebus murah ${input.sku.nama} dengan ${pasangan}`,
      alasan: `${input.sku.nama} sisa ${input.batch.qty} dan mau kadaluarsa ${input.daysToExpiry} hari lagi. Pasangkan dengan ${pasangan} biar cepat habis tanpa rugi. (Saran lokal, bukan dari AI)`,
      confidence: "Sedang",
    };
  }
}

export type SaranResult =
  | { ok: true; promoId: string; existed: boolean; lokal: boolean; harga_tebus: number }
  | { ok: false; error: string };

/**
 * Buat usulan promo tebus murah dari satu batch mepet.
 * - Idempoten: jika sudah ada promo proposed/active untuk batch → tidak tulis baru.
 * - Guardrail validatePromoUsul('tebus') WAJIB lolos sebelum tulis (angka dari DB).
 * - LLM tidak pernah dipanggil langsung dari UI — wording via LocalWordingLLM
 *   (aturan lokal, jalan offline). Advisor tetap dipakai untuk pairing +
 *   guardrail floor + tulis advisorCache TTL 24h.
 * - Status selalu 'proposed' — tidak auto-activate.
 */
export async function requestSaranTebus(batchId: string, orgId = "toko-01"): Promise<SaranResult> {
  const nowIso = new Date().toISOString();
  try {
    const existing = await realRepo.listPromos(orgId).catch(() => []);
    const found = existing.find((p) => p.batch_id === batchId && (p.status === "proposed" || p.status === "active"));
    if (found) return { ok: true, promoId: found.id, existed: true, lokal: true, harga_tebus: found.harga_tebus };

    const batch = await realRepo.getBatch(batchId);
    if (!batch) return { ok: false, error: "Stok tidak ditemukan" };
    const sku = await realRepo.getSku(batch.sku_id);
    if (!sku) return { ok: false, error: "Barang tidak ditemukan" };

    const advisor = new LangChainGeminiAdvisor(realRepo, new LocalWordingLLM());
    let suggestion;
    try {
      suggestion = await advisor.suggestForBatch(batchId, orgId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg || "Belum bisa buat saran untuk stok ini" };
    }
    if (!suggestion) return { ok: false, error: "Belum bisa buat saran untuk stok ini" };

    // Guardrail kedua sebelum tulis — angka dari DB, bukan dari LLM.
    const guard = validatePromoUsul("tebus", {
      hpp: batch.modal_snapshot,
      harga_tebus: suggestion.harga_tebus,
      harga_normal: sku.harga_normal,
    });
    if (!guard.valid) return { ok: false, error: guard.error ?? "Harga tebus tidak valid" };

    const promoId = crypto.randomUUID();
    await realRepo.createPromo({
      id: promoId,
      batch_id: batch.id,
      sku_pasangan_id: suggestion.pasangan_tebus_murah,
      harga_tebus: suggestion.harga_tebus,
      status: "proposed",
      org_id: orgId,
      created_at: nowIso,
    });

    try {
      window.dispatchEvent(new CustomEvent("promo-created", { detail: { batchId, promoId } }));
    } catch {
      /* non-browser (unit test) — lewati event */
    }
    return { ok: true, promoId, existed: false, lokal: true, harga_tebus: suggestion.harga_tebus };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Gagal membuat saran, coba lagi" };
  }
}
