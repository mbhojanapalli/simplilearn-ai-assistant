import { cn } from "@/lib/utils";

/** The Simplilearn gradient logo badge with the product wordmark. */
export function BrandMark({
  size = "md",
  showText = true,
  className,
}: {
  size?: "sm" | "md";
  showText?: boolean;
  className?: string;
}) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          box,
          "grid place-items-center rounded-xl text-white shadow-soft",
        )}
        style={{
          background: "linear-gradient(135deg, #2f66f6 0%, #0ea5a3 100%)",
        }}
        aria-hidden
      >
        <span className="text-[17px] font-bold leading-none">S</span>
      </div>
      {showText && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-ink">
            Simplilearn
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
            AI Assistant
          </div>
        </div>
      )}
    </div>
  );
}
