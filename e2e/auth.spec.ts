import { test, expect } from "@playwright/test";

/**
 * TASK-07: LoginPage PIN + nama toko + guard + lockout 5x 30s + 48px
 * Minimal 4 case: setup baru → dashboard, login benar → dashboard,
 * salah 5x → lockout 30s terlihat, tombol min-height 48px computed
 */

test.describe("Auth LoginPage PIN + nama toko + guard", () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storages before each test
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("setup PIN baru + nama toko → dashboard terlihat", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    const loginPage = page.getByTestId("login-page");
    await expect(loginPage).toBeVisible({ timeout: 10_000 });

    // Setup mode: nama toko editable + pin + confirm
    const namaInput = page.getByTestId("input-nama-toko");
    await expect(namaInput).toBeVisible();
    await expect(namaInput).toBeEditable();

    const pinInput = page.getByTestId("input-pin");
    await expect(pinInput).toBeVisible();
    // type password
    await expect(pinInput).toHaveAttribute("type", "password");

    const pinConfirm = page.getByTestId("input-pin-confirm");
    await expect(pinConfirm).toBeVisible();

    await namaInput.fill("Toko Berkah");
    await pinInput.fill("1234");
    await pinConfirm.fill("1234");

    const btn = page.getByTestId("btn-masuk");
    await expect(btn).toBeVisible();
    await btn.click();

    // Should navigate to dashboard (AppShell)
    await expect(page.getByRole("heading", { name: "Inventaris Tebus Murah" })).toBeVisible({ timeout: 10_000 });
    // header should show nama toko (if header-title is visible, check it contains Toko Berkah)
    const headerTitle = page.getByTestId("header-title");
    await expect(headerTitle).toBeVisible();
    await expect(headerTitle).toContainText("Toko Berkah");

    // Dashboard visible (Stok Mepet)
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();

    // Verify localStorage profil_toko_v1
    const profil = await page.evaluate(() => localStorage.getItem("profil_toko_v1"));
    expect(profil).not.toBeNull();
    expect(profil!).toContain("Toko Berkah");

    // Verify session flag
    const session = await page.evaluate(() => sessionStorage.getItem("auth-logged-in-v1"));
    expect(session).toBe("1");

    // Verify PIN not plaintext in storage
    const pinRaw = await page.evaluate(() => localStorage.getItem("pinStore-v1"));
    expect(pinRaw).not.toBeNull();
    expect(pinRaw!).not.toContain("1234");
  });

  test("login benar → dashboard (sudah ada PIN, nama toko readonly)", async ({ page }) => {
    // Pre-seed PIN + nama toko via evaluate (simulate existing user)
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      // Use pinStore.setPin via window.__PIN_STORE__ if available, else fallback
      const w = window as unknown as { __PIN_STORE__?: { setPin: (p: string) => Promise<void> } };
      if (w.__PIN_STORE__) {
        await w.__PIN_STORE__.setPin("9999");
      }
      localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Sari", updated_at: new Date().toISOString() }));
    });
    // Need to ensure pinStore is loaded — wait a tick and reload to ensure isPinSet picks it up
    await page.reload();
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });

    const namaInput = page.getByTestId("input-nama-toko");
    await expect(namaInput).toBeVisible();
    // readonly
    await expect(namaInput).toHaveAttribute("readonly", "");
    await expect(namaInput).toHaveValue("Toko Sari");

    const pinInput = page.getByTestId("input-pin");
    await pinInput.fill("9999");

    const btn = page.getByTestId("btn-masuk");
    await btn.click();

    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("header-title")).toContainText("Toko Sari");
  });

  test("PIN salah 5x → lockout 30 detik terlihat + hitung mundur", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      const w = window as unknown as { __PIN_STORE__?: { setPin: (p: string) => Promise<void> } };
      if (w.__PIN_STORE__) {
        await w.__PIN_STORE__.setPin("1234");
      }
      localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Uji", updated_at: new Date().toISOString() }));
    });
    await page.reload();
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });

    const pinInput = page.getByTestId("input-pin");
    const btn = page.getByTestId("btn-masuk");

    // 4 times wrong → error "PIN salah"
    for (let i = 1; i <= 4; i++) {
      await pinInput.fill("0000");
      await btn.click();
      const err = page.getByTestId("login-error");
      await expect(err).toBeVisible();
      await expect(err).toContainText("PIN salah");
      await expect(err).toContainText(`${i} dari 5`);
      // lockout should not yet be visible
      await expect(page.getByTestId("lockout-message")).toHaveCount(0);
    }

    // 5th time → lockout
    await pinInput.fill("0000");
    await btn.click();

    const err5 = page.getByTestId("login-error");
    await expect(err5).toBeVisible();
    await expect(err5).toContainText("Terlalu banyak percobaan salah");
    await expect(err5).toContainText("30 detik");

    const lockout = page.getByTestId("lockout-message");
    await expect(lockout).toBeVisible();
    await expect(lockout).toContainText("terkunci");
    await expect(lockout).toContainText("detik");

    // button disabled during lockout
    await expect(btn).toBeDisabled();

    // hitung mundur: after ~1.5s should still show and seconds decreased or same
    await page.waitForTimeout(1500);
    await expect(lockout).toBeVisible();
    const textAfter = await lockout.innerText();
    // should still contain detik
    expect(textAfter).toMatch(/detik/);

    // correct PIN during lockout should not succeed (button disabled)
    // we don't click, just verify still on login page
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("tombol Masuk min-height 48px dan input 48px", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });

    const btn = page.getByTestId("btn-masuk");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS("min-height", "48px");
    // also font-size 16px
    await expect(btn).toHaveCSS("font-size", "16px");

    const namaInput = page.getByTestId("input-nama-toko");
    await expect(namaInput).toHaveCSS("min-height", "48px");
    await expect(namaInput).toHaveCSS("font-size", "16px");

    const pinInput = page.getByTestId("input-pin");
    await expect(pinInput).toHaveCSS("min-height", "48px");
    await expect(pinInput).toHaveCSS("font-size", "16px");

    // Setup mode also has confirm input 48px
    const pinConfirm = page.getByTestId("input-pin-confirm");
    await expect(pinConfirm).toHaveCSS("min-height", "48px");
  });

  test("guard: belum login → LoginPage, sudah login → dashboard on reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });

    // Do setup login
    await page.getByTestId("input-nama-toko").fill("Toko Guard");
    await page.getByTestId("input-pin").fill("4321");
    await page.getByTestId("input-pin-confirm").fill("4321");
    await page.getByTestId("btn-masuk").click();
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible({ timeout: 10_000 });

    // Reload should stay logged in (sessionStorage persists across reload)
    await page.reload();
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("login-page")).toHaveCount(0);

    // Clear session → should go back to login
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });
  });
});
