import { useEffect, useMemo, useRef, useState } from "react";
import { realRepo } from "../../db/dexieRepository";
import { consumeKeluarTercepat } from "../../db/keluar";
import type { SKU } from "../../db/types";
import { PageHeader, AppButton } from "../../components/ui";
import { Shop, WarningCircle, CheckCircle, Minus, Plus } from "iconoir-react";

type Row = {
  sku: SKU;
  stok: number;
};

function formatRp(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

export function KasirPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [penerima, setPenerima] = useState("");
  const [catatan, setCatatan] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const skus = await realRepo.listSkus("toko-01").catch(() => [] as SKU[]);
      const out: Row[] = [];
      for (const s of skus) {
        const batches = await realRepo.listBatchesBySku(s.id, "toko-01").catch(() => []);
        out.push({ sku: s, stok: batches.reduce((t, b) => t + b.qty, 0) });
      }
      setRows(out);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.sku.nama.toLowerCase().includes(q) ||
        (r.sku.kode ?? "").toLowerCase().includes(q) ||
        (r.sku.barcode ?? "").includes(q),
    );
  }, [rows, search]);

  const setQty = (id: string, qty: number) => {
    const v = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    setCart((c) => ({ ...c, [id]: v }));
    setRowErrors((e) => {
      if (!e[id]) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
  };

  const items = useMemo(
    () =>
      filtered
        .map((r) => ({ row: r, qty: cart[r.sku.id] ?? 0 }))
        .filter((x) => x.qty > 0),
    [filtered, cart],
  );
  const total = items.reduce((s, x) => s + x.row.sku.harga_normal * x.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (items.length === 0) return;

    const byId = new Map(rows.map((r) => [r.sku.id, r]));
    const bad: Record<string, string> = {};
    for (const x of items) {
      const stok = byId.get(x.row.sku.id)?.stok ?? 0;
      if (x.qty > stok) bad[x.row.sku.id] = `${x.row.sku.nama} tinggal ${stok}. Kurangi jumlahnya.`;
    }
    if (Object.keys(bad).length > 0) {
      setRowErrors(bad);
      const firstId = Object.keys(bad)[0];
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(`[data-testid="kasir-qty-${firstId}"]`)?.focus();
      });
      return;
    }

    setSubmitting(true);
    try {
      await consumeKeluarTercepat(
        items.map((x) => ({ skuId: x.row.sku.id, qty: x.qty, penerima, catatan })),
      );
      const totalStr = formatRp(total);
      const count = items.length;
      setCart({});
      setRowErrors({});
      setSuccess(`Jualan ${totalStr} tersimpan (${count} barang).`);
      await loadRows();
      window.dispatchEvent(new CustomEvent("outbound-created", { detail: { count: items.length } }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Stok tidak cukup")) setError("Ada jumlah melebihi stok. Baris yang salah ditandai merah di atas.");
      else if (msg.includes("Qty harus lebih dari 0")) setError("Qty harus lebih dari 0");
      else if (msg.includes("SKU tidak ditemukan")) setError("SKU tidak ditemukan");
      else setError(msg || "Gagal menyimpan penjualan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="kasir-page" className="w-full max-w-[640px] mx-auto space-y-5">
        <PageHeader
          title="Kasir"
          subtitle="Cari barang, atur jumlah, tap Selesaikan Jualan."
          icon={<Shop width={18} height={18} />}
        />
        <div data-testid="kasir-loading" aria-busy="true" aria-label="Memuat barang" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="card bg-base-100 rounded-2xl border border-base-300/50 p-4 animate-pulse">
              <div className="h-5 w-2/3 rounded bg-base-300" />
              <div className="h-4 w-1/3 rounded bg-base-300 mt-2" />
            </div>
          ))}
          <p className="text-sm text-base-content/70 text-center">Memuat barang...</p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="kasir-page" className="w-full max-w-[640px] mx-auto space-y-5">
        <PageHeader
          title="Kasir"
          subtitle="Cari barang, atur jumlah, tap Selesaikan Jualan."
          icon={<Shop width={18} height={18} />}
        />
        <div
          data-testid="kasir-empty"
          role="status"
          className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center"
        >
          <h3 className="text-base font-bold text-neutral">Belum ada barang</h3>
          <p className="text-sm text-[#595959] mt-1.5 leading-relaxed">Tambah barang dan stok dulu sebelum jualan.</p>
          <AppButton
            onClick={() => {
              window.history.pushState({}, "", "/sku/baru");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid="kasir-empty-cta"
            className="mt-5 rounded-xl"
          >
            Tambah Barang
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="kasir-page" className="w-full max-w-[640px] mx-auto space-y-5">
      <PageHeader
        title="Kasir"
        subtitle="Cari barang, atur jumlah, tap Selesaikan Jualan."
        icon={<Shop width={18} height={18} />}
      />

      <input
        type="search"
        ref={searchRef}
        data-testid="kasir-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama barang... contoh: Susu UHT"
        aria-label="Cari barang"
        className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
      />

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {filtered.length === 0 ? (
          <div role="status" data-testid="kasir-no-result" className="card bg-base-100 rounded-2xl border border-base-300/50 p-6 text-center">
            <p className="text-base font-semibold">Tidak ketemu “{search.trim()}”</p>
            <p className="text-sm text-[#595959] mt-1">Coba kata lain.</p>
          </div>
        ) : (
          <ul aria-label="Daftar barang jualan" className="space-y-3">
            {filtered.map(({ sku, stok }) => {
              const qty = cart[sku.id] ?? 0;
              return (
                <li
                  key={sku.id}
                  data-testid={`kasir-row-${sku.id}`}
                  className="card card-border bg-base-100"
                >
                  <div className="card-body gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold truncate">{sku.nama}</p>
                        <p className="text-sm text-base-content/70">
                          {formatRp(sku.harga_normal)} • Stok: {stok}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Jumlah ${sku.nama}`}>
                        <button
                          type="button"
                          data-testid={`kasir-minus-${sku.id}`}
                          aria-label={`Kurangi ${sku.nama}`}
                          onClick={() => setQty(sku.id, qty - 1)}
                          className="btn btn-outline btn-square min-h-[48px] min-w-[48px]"
                        >
                          <Minus width={18} height={18} />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          data-testid={`kasir-qty-${sku.id}`}
                          aria-label={`Jumlah ${sku.nama}`}
                          value={qty}
                          min={0}
                          onChange={(e) => setQty(sku.id, Number(e.target.value))}
                          className="input input-bordered w-16 min-h-[48px] text-[16px] text-center rounded-xl px-1"
                        />
                        <button
                          type="button"
                          data-testid={`kasir-plus-${sku.id}`}
                          aria-label={`Tambah ${sku.nama}`}
                          onClick={() => setQty(sku.id, qty + 1)}
                          className="btn btn-primary btn-square min-h-[48px] min-w-[48px]"
                        >
                          <Plus width={18} height={18} />
                        </button>
                      </div>
                    </div>
                    {rowErrors[sku.id] && (
                      <p role="alert" data-testid={`kasir-error-${sku.id}`} className="text-sm font-medium text-[#C62828]">
                        {rowErrors[sku.id]}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <details data-testid="kasir-lanjutan" className="card card-border bg-base-100">
          <summary className="cursor-pointer min-h-[48px] flex items-center px-4 text-base font-semibold">
            Catatan (boleh kosong)
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <input
              type="text"
              data-testid="kasir-penerima"
              value={penerima}
              onChange={(e) => setPenerima(e.target.value)}
              placeholder="Contoh: Bu Ani"
              aria-label="Nama pembeli"
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl px-3"
            />
            <input
              type="text"
              data-testid="kasir-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (boleh kosong)"
              aria-label="Catatan"
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl px-3"
            />
          </div>
        </details>

        {error && (
          <p data-testid="form-error" role="alert" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
            <WarningCircle width={16} height={16} className="shrink-0" />
            {error}
          </p>
        )}

        {success && (
          <div className="space-y-2">
            <p data-testid="form-success" role="status" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#E8F5E9] text-[#0F7A4A] border border-[#C8E6C9]">
              <CheckCircle width={16} height={16} className="shrink-0" />
              {success}
            </p>
            <AppButton
              type="button"
              variant="outline"
              data-testid="kasir-baru"
              fullWidth
              className="rounded-xl"
              onClick={() => {
                setSuccess("");
                setSearch("");
                searchRef.current?.focus();
              }}
            >
              Mulai jualan baru
            </AppButton>
          </div>
        )}

        <div
          className="card card-border bg-base-100 sticky bottom-20 lg:static"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          <div className="card-body gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">Total</span>
              <span data-testid="kasir-total" className="text-lg font-bold text-primary">
                {formatRp(total)}
              </span>
            </div>
            {items.length === 0 && (
              <p data-testid="kasir-empty-hint" className="text-sm text-base-content/70">
                Belum ada yang dipilih. Tap + pada barang.
              </p>
            )}
            <AppButton type="submit" data-testid="kasir-simpan" disabled={submitting || items.length === 0} loading={submitting} fullWidth className="rounded-xl">
              {submitting ? "Menyimpan..." : "Selesaikan Jualan"}
            </AppButton>
          </div>
        </div>
      </form>
    </div>
  );
}

export default KasirPage;
