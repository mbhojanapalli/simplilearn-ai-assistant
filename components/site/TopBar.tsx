import { BrandMark } from "@/components/site/BrandMark";

/** Shared top navigation bar. Right-hand area is provided per page via children. */
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Plain anchor (not next/link) so clicking the brand always loads a
            fresh homepage — i.e. starts a new chat — even when already on "/". */}
        <a href="/" className="transition-opacity hover:opacity-80" aria-label="Simplilearn AI Assistant — home">
          <BrandMark />
        </a>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
