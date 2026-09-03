# issues - inventory-userflow-rewrite
- 2026-09-03: Gotcha Dexie v2 unique index — &[org_id+kode] fails jika masih ada sku tanpa kode; upgrade must backfill sebelum enforcement; fix pakai trans.table update sebelum index jadi valid
- 2026-09-03: Gotcha MissingAPIError fake-indexeddb — Dexie cache indexedDB saat import, jadi set globalThis.indexedDB/IDBKeyRange sebelum `await import("dexie")` dan `await import("./db")`, jangan static import di atas
- 2026-09-03: Gotcha TS7022 implicit any di createSKU while loop — n inferred any jika kode reassigned di loop; fix hapus while dead-code untuk existingKodes empty case
