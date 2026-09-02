import { ThresholdForm } from "../settings/ThresholdForm";

export type BatchDetail = {
  batchId: string;
  skuName: string;
  kategoriName: string;
  qty: number;
  receivedDate: string;
  hpp: string;
  isUrgent?: boolean;
  threshold?: number[];
};

type Props = {
  batch?: BatchDetail;
  onSaveThreshold?: (next: number[]) => void;
  onBack?: () => void;
};

const DEFAULT_BATCH: BatchDetail = {
  batchId: "B-20231024-DAIRY-01",
  skuName: "Fresh Milk 1L - Ultra",
  kategoriName: "Dairy",
  qty: 1250,
  receivedDate: "24 Okt 2023",
  hpp: "Rp 12.500",
  isUrgent: true,
  threshold: [7, 3, 1],
};

type HistoryEntry = {
  time: string;
  message: React.ReactNode;
  primary?: boolean;
};

const DEFAULT_HISTORY: HistoryEntry[] = [
  {
    time: "Hari ini, 09:41",
    primary: true,
    message: (
      <>
        Sistem menandai batch sebagai <span className="text-danger font-semibold">Peringatan (H-3)</span>.
      </>
    ),
  },
  {
    time: "24 Okt 2023, 14:20",
    primary: false,
    message: (
      <>
        Supervisor <span className="font-semibold">Budi S.</span> menerima batch awal.
      </>
    ),
  },
];

export function BatchDetailPage({ batch = DEFAULT_BATCH, onSaveThreshold, onBack }: Props) {
  const b = batch;
  const threshold = b.threshold ?? [7, 3, 1];

  const handleSave = (next: number[]) => {
    if (onSaveThreshold) onSaveThreshold(next);
    else {
      // fallback: simpan ke localStorage settings-thresholds jika ada kategori Dairy
      try {
        const raw = localStorage.getItem("settings-thresholds");
        if (raw) {
          const parsed = JSON.parse(raw) as { id: string; name: string; threshold: number[] }[];
          const idx = parsed.findIndex((k) => k.name.toLowerCase() === b.kategoriName.toLowerCase());
          if (idx >= 0) {
            parsed[idx] = { ...parsed[idx], threshold: next };
            localStorage.setItem("settings-thresholds", JSON.stringify(parsed));
          }
        }
      } catch {}
    }
  };

  return (
    <div className="w-full" data-testid="batch-detail-page">
      <main className="w-full flex flex-col gap-lg py-lg">
        {/* Header Section */}
        <section className="mb-lg">
          <div className="flex items-start justify-between mb-sm">
            <div>
              <span className="font-label-caps text-label-caps text-slate-gray uppercase tracking-wider block mb-1">
                Batch ID
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface" data-testid="batch-id">
                {b.batchId}
              </h2>
            </div>
            {b.isUrgent && (
              <div
                className="bg-danger text-white rounded-full px-3 py-1.5 shadow-sm flex items-center gap-1.5"
                aria-label="Status mendesak"
                data-testid="badge-urgent"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden="true"></span>
                <span className="font-data-mono text-data-mono text-white">Urgent</span>
              </div>
            )}
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali"
              className="min-h-[48px] inline-flex items-center gap-1 text-sm text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg px-2 -ml-2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_back
              </span>
              Kembali
            </button>
          )}
        </section>

        {/* Bento Grid: Batch Details */}
        <section className="grid grid-cols-2 gap-sm" aria-label="Detail batch">
          <div className="col-span-2 md:col-span-1 bg-surface-container-lowest border border-border-subtle p-md rounded-xl shadow-sm">
            <span className="font-label-caps text-label-caps text-slate-gray block mb-xs">SKU</span>
            <p className="font-body-lg text-body-lg text-on-surface font-semibold" data-testid="batch-sku">
              {b.skuName}
            </p>
            <div className="mt-xs inline-flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                category
              </span>
              Kategori: {b.kategoriName}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-border-subtle p-md rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-caps text-label-caps text-slate-gray block mb-xs">Total Qty</span>
            <div className="flex items-end gap-2">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface" data-testid="batch-qty">
                {b.qty.toLocaleString("id-ID")}
              </span>
              <span className="text-on-surface-variant font-body-md text-body-md mb-1">units</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-border-subtle p-md rounded-xl shadow-sm">
            <span className="font-label-caps text-label-caps text-slate-gray block mb-xs">Received Date</span>
            <p className="font-body-md text-body-md text-on-surface" data-testid="batch-received">
              {b.receivedDate}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-border-subtle p-md rounded-xl shadow-sm">
            <span className="font-label-caps text-label-caps text-slate-gray block mb-xs">HPP (Unit)</span>
            <p className="font-data-mono text-data-mono text-on-surface" data-testid="batch-hpp">
              {b.hpp}
            </p>
          </div>
        </section>

        {/* Threshold Configuration */}
        <ThresholdForm kategoriId={`batch-${b.kategoriName.toLowerCase()}`} kategoriName={b.kategoriName} threshold={threshold} onSave={handleSave} />

        {/* History Log */}
        <section className="mt-xl" aria-labelledby="history-heading">
          <h3 id="history-heading" className="font-headline-md text-headline-md text-on-surface mb-md">
            Riwayat Perubahan
          </h3>
          <div className="relative border-l-2 border-border-subtle ml-3 space-y-md">
            {DEFAULT_HISTORY.map((item, i) => (
              <div key={i} className="relative pl-6" data-testid={`history-entry-${i}`}>
                <div
                  className={`absolute w-3 h-3 bg-surface border-2 rounded-full -left-[7px] top-1 ${item.primary ? "border-primary" : "border-slate-gray"}`}
                  aria-hidden="true"
                ></div>
                <p className="text-xs text-slate-gray mb-1" style={{ fontSize: "12px" }}>
                  {item.time}
                </p>
                <div className="bg-surface-container-lowest border border-border-subtle p-3 rounded-lg shadow-sm">
                  <p className="font-body-md text-body-md text-on-surface">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default BatchDetailPage;
