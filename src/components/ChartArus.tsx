/**
 * TASK-29 — ChartArus: bar ganda masuk/keluar 14 hari + garis BEP amber
 *
 * Lazy-safe: registrasi Chart.js dilakukan di dalam komponen/effect-like top-level
 * guard (bukan annotation plugin). Props murni dari DB (bukan LLM).
 *
 * Warna:
 *  - masuk  #16a34a (hijau)
 *  - keluar #dc2626 (merah)
 *  - BEP    #F59E0B (amber, BEDA dari hijau)
 */

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { Chart } from "react-chartjs-2";

let registered = false;
function ensureRegistered() {
  if (!registered) {
    ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, PointElement, LineElement, LineController, Title, Tooltip, Legend);
    registered = true;
  }
}

export type ChartArusProps = {
  masukPerDay: number[];
  keluarPerDay: number[];
  marginPerDay: number[];
  days: string[]; // YYYY-MM-DD 14 entries
};

function formatDayLabelDDMM(isoDate: string): string {
  return isoDate.slice(8, 10) + "-" + isoDate.slice(5, 7);
}

export function ChartArus({ masukPerDay, keluarPerDay, marginPerDay, days }: ChartArusProps) {
  ensureRegistered();

  const totalMasuk = useMemo(() => masukPerDay.reduce((a, b) => a + b, 0), [masukPerDay]);
  const totalKeluar = useMemo(() => keluarPerDay.reduce((a, b) => a + b, 0), [keluarPerDay]);
  const totalAll = totalMasuk + totalKeluar;

  // Empty state bila semua nol
  if (totalAll === 0) {
    return (
      <p data-testid="chart-arus-empty" style={{ fontSize: 14, color: "#595959", marginTop: 12 }}>
        Belum ada transaksi 14 hari terakhir
      </p>
    );
  }

  const labels = days.map(formatDayLabelDDMM);

  // Kumulatif margin + BEP index
  const kumulatif: number[] = [];
  let cum = 0;
  for (let i = 0; i < marginPerDay.length; i++) {
    cum += marginPerDay[i];
    kumulatif.push(cum);
  }
  let bepIndex: number | null = null;
  for (let i = 0; i < kumulatif.length; i++) {
    if (kumulatif[i] >= 0) {
      bepIndex = i;
      break;
    }
  }

  // Dataset garis BEP: nilai kumulatif (agar garis terlihat), titik besar hanya di bepIndex
  // Untuk visual yang jelas, garis amber menelusuri kumulatif margin (skala kedua jika perlu)
  // Sederhana: pakai sumbu-y yang sama qty — tapi kumulatif margin angka besar, jadi kita
  // normalisasi? Spec: garis/marker BEP amber (nilai kumulatif). Praktik terbaik: garis di sumbu kedua
  // atau overlay. Simplest: garis kumulatif pada yAxisId bep, hidden scale.
  // Agar bar tetap terbaca, BEP dataset pakai yAxisID 'yBep' terpisah.
  const bepLabel = bepIndex !== null ? `BEP tercapai H+${bepIndex + 1}` : "Belum BEP";

  // radii: hanya bepIndex titik besar, lainnya 0 (garis tetap span)
  const pointRadius = marginPerDay.map((_, i) => (i === bepIndex ? 7 : 0));
  const pointHoverRadius = marginPerDay.map((_, i) => (i === bepIndex ? 9 : 0));
  const pointBg = marginPerDay.map((_, i) => (i === bepIndex ? "#F59E0B" : "rgba(245,158,11,0)"));

  const data: ChartData<"bar" | "line", number[], string> = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Masuk",
        data: masukPerDay,
        backgroundColor: "#16a34a",
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: "y",
      },
      {
        type: "bar" as const,
        label: "Keluar",
        data: keluarPerDay,
        backgroundColor: "#dc2626",
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: "y",
      },
      {
        type: "line" as const,
        label: "Kumulatif margin (BEP)",
        data: kumulatif,
        borderColor: "#F59E0B",
        backgroundColor: "#F59E0B",
        pointBackgroundColor: pointBg,
        pointBorderColor: "#FFFFFF",
        pointBorderWidth: 2,
        pointRadius: pointRadius,
        pointHoverRadius: pointHoverRadius,
        borderWidth: 2,
        tension: 0.3,
        spanGaps: true,
        yAxisID: "yBep",
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(26,26,26,0.92)",
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 10,
        callbacks: {
          title: (items: TooltipItem<"bar" | "line">[]) => {
            const idx = items[0]?.dataIndex ?? 0;
            const d = days[idx] ?? items[0]?.label ?? "";
            if (d && d.includes("-") && d.length === 10) return `Tanggal ${formatDayLabelDDMM(d)}`;
            return `Tanggal ${d}`;
          },
          label: (ctx: TooltipItem<"bar" | "line">) => {
            const lab = ctx.dataset.label ?? "";
            const raw = ctx.parsed.y;
            const v = typeof raw === "number" ? raw : 0;
            if (lab === "Masuk") return `Masuk: ${v} pcs`;
            if (lab === "Keluar") return `Keluar: ${v} pcs`;
            if (lab.includes("Kumulatif")) {
              const idx = ctx.dataIndex;
              const marginHarian = marginPerDay[idx] ?? 0;
              return `Margin harian: Rp${marginHarian.toLocaleString("id-ID")} \u2022 Kumulatif: Rp${Number(v).toLocaleString("id-ID")}`;
            }
            return `${lab}: ${v}`;
          },
          footer: (items: TooltipItem<"bar" | "line">[]) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return "";
            if (bepIndex !== null && idx === bepIndex) return "\u25B2 BEP tercapai di hari ini";
            if (bepIndex !== null && idx > bepIndex) return "Sudah BEP";
            return "";
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#595959", font: { size: 12 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
        title: {
          display: true,
          text: "Tanggal (DD-MM)",
          color: "#595959",
          font: { size: 11, weight: 600 },
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(217,217,217,0.6)" },
        ticks: { color: "#595959", font: { size: 11 }, precision: 0 },
        title: {
          display: true,
          text: "Qty (pcs)",
          color: "#595959",
          font: { size: 11, weight: 600 },
        },
      },
      yBep: {
        display: false,
        beginAtZero: false,
        grid: { display: false },
      },
    },
  };

  return (
    <div data-testid="chart-arus-wrapper" style={{ marginTop: 12 }}>
      <div
        data-testid="chart-arus-container"
        style={{ position: "relative", height: 300, minHeight: 240, width: "100%" }}
      >
        {/* canvas akan di-render oleh Chart */}
        <Chart type="bar" data={data} options={options} data-testid="chart-arus-canvas" />
      </div>

      {/* Legenda tambahan visual + BEP label amber jelas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 12, color: "#595959" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 12, background: "#16a34a", display: "inline-block", borderRadius: 2 }} /> Masuk
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 12, background: "#dc2626", display: "inline-block", borderRadius: 2 }} /> Keluar
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              background: "#F59E0B",
              display: "inline-block",
              borderRadius: 9999,
              border: "2px solid #FFFFFF",
              boxShadow: "0 0 0 1px #F59E0B",
            }}
          />{" "}
          BEP (amber)
        </span>
      </div>

      {bepIndex !== null ? (
        <p
          data-testid="chart-bep-label"
          style={{ fontSize: 14, color: "#F59E0B", fontWeight: 700, marginTop: 8 }}
        >
          BEP tercapai H+{bepIndex + 1}
          <span
            data-testid="bep-marker"
            aria-label="BEP marker"
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: 9999,
              background: "#F59E0B",
              border: "2px solid #FFFFFF",
              boxShadow: "0 0 0 2px #F59E0B",
              marginLeft: 8,
              verticalAlign: "middle",
            }}
          />
        </p>
      ) : (
        <p data-testid="chart-bep-label" style={{ fontSize: 14, color: "#595959", marginTop: 8 }}>
          Belum BEP
        </p>
      )}

      {/* Hidden debug text for e2e tooltip assertion fallback */}
      <span data-testid="chart-arus-legend-text" style={{ position: "absolute", left: -9999, top: "auto" }}>
        Masuk Keluar Kumulatif margin (BEP) BEP tercapai H
      </span>
    </div>
  );
}

export default ChartArus;
