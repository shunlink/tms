import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Use "dark" on dark backgrounds (white logo), "light" on light backgrounds (dark logo). */
  variant?: "light" | "dark";
  showSubtitle?: boolean;
  subtitle?: string;
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const LOGO_WIDTH = 712;
const LOGO_HEIGHT = 350;

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  xl: "h-16",
};

export default function BrandLogo({
  variant = "light",
  showSubtitle = false,
  subtitle = "Transport Management",
  href,
  className,
  size = "md",
}: BrandLogoProps) {
  const src = variant === "dark" ? "/brand/logo-dark.svg" : "/brand/logo-light.svg";

  const content = (
    <div className={cn("flex shrink-0 flex-col", className)}>
      {/* Native img avoids Next/Image SVG issues and keeps aspect ratio via height only */}
      <img
        src={src}
        alt="ShunLink"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn("block w-auto shrink-0 object-contain", sizeClasses[size])}
      />
      {showSubtitle && (
        <p
          className={cn(
            "text-xs mt-0.5",
            variant === "dark" ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}
