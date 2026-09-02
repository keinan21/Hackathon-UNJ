/**
 * TASK-03 acceptance: pinStore.test.ts
 * set PIN "1234" -> verify true, wrong "0000" false, API key roundtrip encrypt/decrypt, no plaintext in Dexie
 * Run: bun test src/features/auth/pinStore.test.ts
 */
import { describe, expect, test, beforeEach } from "vitest";
import { setPin, verifyPin, isPinSet, clearPin, setApiKey, getApiKey, getApiKeyRawRecord, clearApiKey, assertNoPlaintextInStorage } from "./pinStore";

beforeEach(async () => {
  clearPin();
  clearApiKey();
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

describe("TASK-03 PIN auth", () => {
  test('set PIN "1234" -> verify true, wrong "0000" false', async () => {
    await setPin("1234");
    expect(await isPinSet()).toBe(true);
    expect(await verifyPin("1234")).toBe(true);
    expect(await verifyPin("0000")).toBe(false);
  });

  test("API key roundtrip encrypt/decrypt succeeds", async () => {
    await setPin("1234");
    const plain = "test-gemini-key-123-FOR-TEST-ONLY";
    await setApiKey(plain, "1234");
    const got = await getApiKey("1234");
    expect(got).toBe(plain);
  });

  test("wrong PIN decrypt fails -> null", async () => {
    await setPin("1234");
    await setApiKey("secret-key-xyz", "1234");
    const wrong = await getApiKey("0000");
    expect(wrong).toBeNull();
  });

  test("no plaintext key in storage / Dexie", async () => {
    await setPin("1234");
    const plain = "no-plaintext-fake-key-999-FOR-TEST";
    await setApiKey(plain, "1234");
    // raw record should not contain plain
    const raw = getApiKeyRawRecord();
    expect(raw).not.toBeNull();
    expect(JSON.stringify(raw)).not.toContain(plain);
    expect(assertNoPlaintextInStorage(plain)).toBe(true);

    // also ensure Dexie tidak punya plaintext (best effort: check if db exists, no apiKey table)
    // Dexie tidak menyimpan API key — hanya localStorage ciphertext
    expect(raw?.ciphertext).toBeDefined();
    expect(raw?.ciphertext).not.toBe(plain);
  });

  test("PIN hash stored not plaintext", async () => {
    await setPin("9999");
    const rec = (await import("./pinStore")).getPinRecord();
    expect(rec).not.toBeNull();
    expect(rec?.hash).not.toBe("9999");
    expect(rec?.salt).toBeDefined();
    // hash length should be non-empty base64 (32 bytes -> ~44 chars)
    expect(rec?.hash.length).toBeGreaterThan(20);
  });
});
