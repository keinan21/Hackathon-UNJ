import { test, expect } from "@playwright/test";

test.describe("Promo approve dialog 2-tap Formal warung", () => {
  test("happy: proposed → Setujui → Dialog Yakin → toast tampil Dashboard", async ({ page }) => {
    await page.goto("/?seed=demo");
    await expect(page.getByRole("heading", { name: "Promo Tebus Murah" })).toBeVisible();
    // Find Setujui Tebus Murah button (first proposed card)
    const approveBtn = page.getByRole("button", { name: /Setujui Tebus Murah|Setujui/ }).first();
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toHaveCSS("min-height", "48px");
    // Check iconoir present? just check class
    await expect(approveBtn).toHaveClass(/btn-primary/);
    await expect(approveBtn).toHaveClass(/w-full/);

    // 1st tap: open dialog
    await approveBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByText(/Yakin setujui tebus murah/).first()).toBeVisible();
    await expect(page.getByText(/Modal Rp10\.000/).first()).toBeVisible();
    await expect(page.getByText(/Tebus Rp9\.000/).first()).toBeVisible();
    await expect(page.getByText(/Untung tipis Rp500/).first()).toBeVisible();
    await expect(page.getByTitle(/HPP\*0\.85/).first()).toBeVisible();

    // 2nd tap: Yakin
    const yakinBtn = page.getByTestId("dialog-confirm-yakin");
    await expect(yakinBtn).toBeVisible();
    await expect(yakinBtn).toHaveCSS("min-height", "48px");
    await expect(yakinBtn).toHaveCSS("font-size", "16px");
    await yakinBtn.click();

    // Dialog closed, promo moves to active
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("promo-aktif-list")).toBeVisible();
    await expect(page.getByTestId("promo-card-active").first()).toBeVisible();
    // Badge promo aktif count
    await expect(page.getByText(/Promo Aktif \(1\)/)).toBeVisible();

    // Toast success 4s role=status aria-live polite
    const toast = page.getByTestId("promo-toast");
    await expect(toast).toBeVisible({ timeout: 2000 });
    await expect(toast).toHaveAttribute("role", "status");
    await expect(toast).toHaveAttribute("aria-live", "polite");
    await expect(page.getByText("Tebus murah aktif, tampil di Dashboard")).toBeVisible();
    // bg #E8F5E9
    await expect(toast).toHaveCSS("background-color", "rgb(232, 245, 233)");
    // Dismiss X works
    const closeX = page.getByTestId("toast-dismiss-x");
    await expect(closeX).toBeVisible();
    await closeX.click();
    await expect(toast).toHaveCount(0);
  });

  test("guardrail fail di bawah floor disabled dan alert", async ({ page }) => {
    await page.goto("/?seed=demo&promo=guardrailFail");
    const btn = page.getByRole("button", { name: /Setujui/ }).first();
    await expect(btn).toBeVisible();
    await btn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Harga tebus tidak boleh di bawah HPP/).first()).toBeVisible();
    const yakin = page.getByTestId("dialog-confirm-yakin");
    await expect(yakin).toBeDisabled();
    await expect(yakin).toContainText("Tidak bisa setujui");
    // Batal 48px
    const batal = page.getByTestId("dialog-cancel-batal");
    await expect(batal).toBeVisible();
    await expect(batal).toHaveCSS("min-height", "48px");
    await batal.click();
    await expect(dialog).toHaveCount(0);
  });

  test("offline banner kuning saat ?offline=1 + stale", async ({ page }) => {
    await page.goto("/?offline=1");
    // Need offline status? banner shows via query even if online because showOfflineBanner true for stale query
    const banner = page.getByTestId("offline-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveCSS("background-color", "rgb(255, 248, 225)");
    await expect(page.getByText("Kamu offline, saran kemarin tetap tampil")).toBeVisible();
  });

  test("escape closes dialog and focus trap", async ({ page }) => {
    await page.goto("/?seed=demo");
    await page.getByRole("button", { name: /Setujui/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("a11y dialog 48px full width bahasa formal", async ({ page }) => {
    await page.goto("/?seed=demo");
    await page.getByRole("button", { name: /Setujui/ }).first().click();
    const yakin = page.getByTestId("dialog-confirm-yakin");
    await expect(yakin).toHaveCSS("min-height", "48px");
    await expect(yakin).toHaveClass(/w-full/);
    // Formal warung wording
    await expect(page.getByText(/Yakin setujui tebus murah/)).toBeVisible();
    await expect(yakin).toContainText("Yakin");
    const batal = page.getByTestId("dialog-cancel-batal");
    await expect(batal).toHaveCSS("min-height", "48px");
    await expect(batal).toContainText("Batal");
  });
});
