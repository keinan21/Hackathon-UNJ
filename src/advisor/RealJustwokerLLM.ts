import type { LLMPort } from "./LangChainGeminiAdvisor";

/**
 * Real LLM via JustWoker OpenAI-compatible proxy (jwc/claude-opus-5-thinking)
 * Implements LLMPort for LangChainGeminiAdvisor.
 * Harga dari DB, LLM hanya wording+pairing — guardrail HPP*0.85 tetap enforced di advisor (src/lib/validation.ts).
 */
export class RealJustwokerLLM implements LLMPort {
  constructor(
    private apiKey: string,
    private baseUrl: string = "https://api.justwoker.icu/v1/chat/completions",
    private model: string = "claude-opus-5-thinking",
  ) {
    // Normalisasi model: user input jwc/... -> strip prefix (proxy butuh tanpa jwc/)
    if (this.model.startsWith("jwc/")) this.model = this.model.replace(/^jwc\//, "");
  }

  async generate(input: {
    sku: { nama: string; kategori_id: string; harga_normal: number };
    batch: { qty: number; expiry_date: string | null; hpp_snapshot: number };
    daysToExpiry: number;
    pasanganSku: { nama: string } | null;
    hpp: number;
    hargaNormal: number;
  }): Promise<{
    aksi: string;
    alasan: string;
    harga_tebus: number;
    confidence: "Tinggi" | "Sedang" | "Rendah";
  }> {
    if (!this.apiKey) throw new Error("API key missing");
    const floor = Math.round(input.hpp * 0.85);
    const targetHarga = Math.max(floor, Math.round(input.hpp * 0.9));

    const systemPrompt =
      "Kamu adalah Advisor Tebus Murah untuk UMKM warung. Tugas: buat bundling 'tebus murah' agar stok mau kadaluarsa cepat habis tanpa rugi. " +
      "Aturan: harga_tebus HARUS >= HPP*0.85 (floor) dan <= harga_normal. Jawab HANYA JSON valid tanpa markdown, dengan key: aksi (string pendek 'Tebus murah {SKU} dengan {pasangan}'), alasan (1-2 kalimat bahasa warung Indonesia, jelaskan kenapa pasangan dipilih), harga_tebus (number integer Rupiah), confidence ('Tinggi'|'Sedang'|'Rendah').";

    const userPrompt = [
      `SKU: ${input.sku.nama} (kategori ${input.sku.kategori_id})`,
      `Batch: ${input.batch.qty} pcs, kadaluarsa ${input.batch.expiry_date ?? "null"} (H-${input.daysToExpiry}), HPP snapshot Rp${input.hpp.toLocaleString("id-ID")}, harga normal Rp${input.hargaNormal.toLocaleString("id-ID")}`,
      `Pasangan yang disarankan: ${input.pasanganSku?.nama ?? "tidak ada, pilih yang laris"}`,
      `Floor: Rp${floor.toLocaleString("id-ID")} (HPP×0.85), target aman: Rp${targetHarga.toLocaleString("id-ID")}`,
      `Instruksi: harga_tebus pilih di antara floor dan harga_normal, bulatkan, jangan di bawah floor.`,
    ].join("\n");

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        // jwc thinking model may need max_tokens
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: string;
    };

    // OpenAI format: choices[0].message.content, or direct content
    let content = data.choices?.[0]?.message?.content ?? (data as unknown as { content?: string }).content ?? "";
    if (!content) throw new Error("LLM empty response");

    // Strip markdown fence if any
    content = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: { aksi?: string; alasan?: string; harga_tebus?: number; confidence?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      // fallback: try extract JSON object substring
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`LLM JSON parse fail: ${content.slice(0, 300)}`);
      parsed = JSON.parse(m[0]);
    }

    const harga = Number(parsed.harga_tebus);
    if (!Number.isFinite(harga)) throw new Error("LLM harga_tebus NaN");

    // Clamp to floor if LLM still below (guardrail will also throw, but we clamp for UX)
    const clampedHarga = Math.max(harga, floor);

    const confidence = (parsed.confidence === "Tinggi" || parsed.confidence === "Sedang" || parsed.confidence === "Rendah"
      ? parsed.confidence
      : "Sedang") as "Tinggi" | "Sedang" | "Rendah";

    return {
      aksi: String(parsed.aksi ?? `Tebus murah ${input.sku.nama} dengan ${input.pasanganSku?.nama ?? "pasangan laris"}`),
      alasan: String(parsed.alasan ?? `${input.sku.nama} mau kadaluarsa H-${input.daysToExpiry}, pasangkan dengan ${input.pasanganSku?.nama ?? "SKU laris"} biar cepat habis.`),
      harga_tebus: Math.round(clampedHarga),
      confidence,
    };
  }
}

/**
 * Factory: coba ambil API key terenkripsi via pinStore (PIN 2005), jika ada pakai Real, jika tidak fallback Mock.
 */
export async function createLLMFromPinStore(pin: string = "2005"): Promise<LLMPort> {
  try {
    const { getApiKey } = await import("../features/auth/pinStore");
    const key = await getApiKey(pin);
    if (key && key.startsWith("sk-")) {
      // baseUrl/model dari user: justwoker proxy — model dinormalisasi di constructor (jwc/ prefix di-strip)
      return new RealJustwokerLLM(key, "https://api.justwoker.icu/v1/chat/completions", "claude-opus-5-thinking");
    }
  } catch {}
  const { MockLLM } = await import("./LangChainGeminiAdvisor");
  return new MockLLM();
}
