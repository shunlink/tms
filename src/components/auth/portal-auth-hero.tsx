import BrandLogo from "@/components/brand-logo";
import type { PortalHeroConfig } from "@/lib/portal-login-config";
import { cn } from "@/lib/utils";

type PortalAuthHeroProps = {
  config: PortalHeroConfig;
  className?: string;
};

export default function PortalAuthHero({ config, className }: PortalAuthHeroProps) {
  const imagePosition = config.backgroundPosition ?? "right center";
  const isControlRoom = config.variant === "employee";

  return (
    <div
      className={cn(
        "relative hidden lg:flex min-h-screen overflow-hidden text-white",
        className
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-no-repeat scale-[1.02]"
        style={{
          backgroundImage: `url(${config.backgroundImage})`,
          backgroundPosition: imagePosition,
        }}
        aria-hidden
      />

      {/* Keep copy on a dark left band; truck / scene stays on the right like the reference */}
      <div
        className="absolute inset-0"
        style={{
          background: isControlRoom
            ? "linear-gradient(90deg, rgba(8,12,22,0.96) 0%, rgba(8,12,22,0.92) 42%, rgba(8,12,22,0.55) 58%, rgba(8,12,22,0.15) 72%, transparent 88%)"
            : "linear-gradient(90deg, rgba(8,12,22,0.97) 0%, rgba(8,12,22,0.94) 38%, rgba(8,12,22,0.72) 50%, rgba(8,12,22,0.25) 68%, transparent 82%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#080c16]/85 via-transparent to-[#080c16]/35"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen w-full max-w-[52%] flex-col justify-between px-10 py-10 xl:px-14 xl:py-12">
        <div className="max-w-[30rem]">
          <BrandLogo variant="dark" href="/login" size="lg" className="mb-8 xl:mb-10" />
          {config.eyebrow && (
            <div className="flex items-center gap-3 mb-4 xl:mb-5">
              <span className="h-1 w-10 shrink-0 rounded-full bg-[#FFB800]" />
              <p className="text-[11px] font-semibold tracking-[0.22em] text-white/95">{config.eyebrow}</p>
            </div>
          )}
          <h1 className="font-heading text-[2rem] xl:text-[2.65rem] font-bold leading-[1.15] tracking-tight mb-4">
            {config.headline}
          </h1>
          <p className="text-[15px] xl:text-base text-white/88 leading-relaxed">{config.description}</p>
        </div>

        <ul className="my-8 xl:my-10 space-y-4 xl:space-y-5 max-w-[28rem]">
          {config.features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title} className="flex gap-3.5 items-start">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFB800]/12 border border-[#FFB800]/35">
                  <Icon className="h-[18px] w-[18px] text-[#FFB800]" strokeWidth={2} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-semibold text-[15px] leading-snug">{feature.title}</p>
                  <p className="text-sm text-white/78 mt-0.5 leading-relaxed">{feature.description}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="font-script text-[1.65rem] xl:text-[1.85rem] text-white max-w-[22rem] leading-snug pb-1">
          <span className="relative inline-block">
            {config.tagline}
            <span
              className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-[#FFB800]"
              aria-hidden
            />
          </span>
        </p>
      </div>
    </div>
  );
}
