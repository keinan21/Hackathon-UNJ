import { describe, test, expect } from "vitest";
import { namaTampilKategori, contohKategori } from "./kategoriTampil";

describe("namaTampilKategori", () => {
  test("alias tampil berubah, nama tak dikenal tampil apa adanya", () => {
    expect(namaTampilKategori("Misc")).toBe("Lain-lain");
    expect(namaTampilKategori("Makanan Frozen")).toBe("Makanan Beku");
    expect(namaTampilKategori("Obat Bebas")).toBe("Obat dan Kesehatan");
    expect(namaTampilKategori("Sembako")).toBe("Sembako");
    expect(namaTampilKategori("Makanan Basah")).toBe("Makanan Basah");
    expect(namaTampilKategori("Kategori Asing")).toBe("Kategori Asing");
  });

  test("setiap kategori seed punya contoh", () => {
    expect(contohKategori("Misc")).toContain("baterai");
    expect(contohKategori("Makanan Basah")).toContain("tempe");
    expect(contohKategori("Makanan Frozen")).toContain("nugget");
    expect(contohKategori("Obat Bebas")).toContain("plester");
    expect(contohKategori("Perawatan Diri")).toContain("sabun");
    expect(contohKategori("Sembako")).toContain("beras");
    expect(contohKategori("Kategori Asing")).toBe("");
  });
});
