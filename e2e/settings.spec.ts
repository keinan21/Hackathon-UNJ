import { test, expect } from "@playwright/test";

test.describe("Settings threshold valid/invalid Formal warung", () => {
  test("happy: edit Dairy to [14,7,3] saves and toast", async ({ page }) => {
    await page.goto("/?view=settings");
    await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible();
    const input = page.getByTestId("input-threshold-k-dairy");
    await expect(input).toBeVisible();
    await expect(input).toHaveCSS("min-height", "48px");
    await expect(input).toHaveCSS("font-size", "16px");
    await input.fill("14,7,3");
    const saveBtn = page.getByTestId("save-k-dairy");
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toHaveCSS("min-height", "48px");
    await saveBtn.click();
    await expect(page.getByTestId("settings-toast")).toBeVisible();
    await expect(page.getByText("Threshold Dairy disimpan: 14,7,3")).toBeVisible();
    // Persist check reload
    await page.reload();
    await expect(page.getByTestId("input-threshold-k-dairy")).toHaveValue("14,7,3");
  });

  test("invalid: duplikat [3,3,1] shows error Bahasa Indonesia", async ({ page }) => {
    await page.goto("/?view=settings");
    const input = page.getByTestId("input-threshold-k-dairy");
    await input.fill("3,3,1");
    await page.getByTestId("save-k-dairy").click();
    const err = page.getByTestId("error-k-dairy");
    await expect(err).toBeVisible();
    await expect(err).toHaveAttribute("role", "alert");
    await expect(page.getByText("Threshold tidak boleh duplikat")).toBeVisible();
  });

  test("invalid: empty shows Threshold tidak boleh kosong", async ({ page }) => {
    await page.goto("/?view=settings");
    const input = page.getByTestId("input-threshold-k-dairy");
    await input.fill("");
    await page.getByTestId("save-k-dairy").click();
    await expect(page.getByText("Threshold tidak boleh kosong")).toBeVisible();
    await expect(page.getByTestId("error-k-dairy")).toBeVisible();
  });

  test("invalid: not descending [1,7,3] shows urut menurun", async ({ page }) => {
    await page.goto("/?view=settings");
    const input = page.getByTestId("input-threshold-k-dairy");
    await input.fill("1,7,3");
    await page.getByTestId("save-k-dairy").click();
    await expect(page.getByText("Threshold harus urut menurun, contoh 7,3,1")).toBeVisible();
  });

  test("guardrail floor HPP*0.85 view displayed", async ({ page }) => {
    await page.goto("/?view=settings");
    await expect(page.getByText(/Guardrail harga: HPP x 0\.85/)).toBeVisible();
    await expect(page.getByText(/floor Rp8\.500/)).toBeVisible();
    await expect(page.getByText(/Harga tebus tidak boleh di bawah floor/)).toBeVisible();
  });

  test("all inputs and buttons 48px + DaisyUI", async ({ page }) => {
    await page.goto("/?view=settings");
    for (const id of ["k-dairy", "k-snack", "k-beras"]) {
      const inp = page.getByTestId(`input-threshold-${id}`);
      await expect(inp).toHaveCSS("min-height", "48px");
      await expect(inp).toHaveCSS("font-size", "16px");
      const btn = page.getByTestId(`save-${id}`);
      await expect(btn).toHaveCSS("min-height", "48px");
      await expect(btn).toHaveClass(/btn-primary/);
      await expect(btn).toHaveClass(/w-full/);
    }
    // alert styled
    await page.getByTestId("input-threshold-k-dairy").fill("3,3,1");
    await page.getByTestId("save-k-dairy").click();
    const alert = page.getByTestId("error-k-dairy");
    await expect(alert).toHaveClass(/alert-error/);
  });
});
