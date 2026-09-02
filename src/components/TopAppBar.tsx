export function TopAppBar() {
  return (
    <header className="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-primary-pressed bg-primary px-margin-mobile text-on-primary">
      <button
        type="button"
        aria-label="Menu inventaris"
        className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full p-2 text-on-primary transition-colors hover:bg-primary-pressed"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }} aria-hidden="true">
          inventory_2
        </span>
      </button>
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile tracking-tight text-on-primary">Tebus Murah</h1>
      <button
        type="button"
        aria-label="Notifikasi"
        className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full p-2 text-on-primary transition-colors hover:bg-primary-pressed"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }} aria-hidden="true">
          notifications
        </span>
      </button>
    </header>
  );
}
