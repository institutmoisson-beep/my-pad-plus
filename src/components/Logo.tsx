import logo from "@/assets/imo-msn-logo.png";
import { cn } from "@/lib/utils";

export function Logo({
  size = 40,
  withWordmark = false,
  className,
  tone = "dark",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt="Logo Imo MSN"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
      />
      {withWordmark && (
        <span
          className={cn(
            "text-xl font-extrabold tracking-tight",
            tone === "light" ? "text-primary-foreground" : "text-primary",
          )}
        >
          Imo<span className="text-success"> MSN</span>
        </span>
      )}
    </div>
  );
}