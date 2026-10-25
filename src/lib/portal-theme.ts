export type PortalAccent = "client" | "vendor" | "driver";

export const PORTAL_THEME: Record<
  PortalAccent,
  {
    pageBg: string;
    headerGlow: string;
    navActive: string;
    navActiveBorder: string;
    statIcon: string;
    titleAccent: string;
    chip: string;
  }
> = {
  client: {
    pageBg: "bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(174_58%_92%/0.55),transparent_55%)]",
    headerGlow: "from-teal-500/20 to-transparent",
    navActive: "text-white bg-white/10",
    navActiveBorder: "border-teal-400",
    statIcon: "bg-teal-500/10 text-teal-700",
    titleAccent: "border-teal-500",
    chip: "bg-teal-600 hover:bg-teal-700 text-white",
  },
  vendor: {
    pageBg: "bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(49_90%_92%/0.5),transparent_55%)]",
    headerGlow: "from-accent/25 to-transparent",
    navActive: "text-white bg-white/10",
    navActiveBorder: "border-accent",
    statIcon: "bg-accent/15 text-accent",
    titleAccent: "border-accent",
    chip: "bg-accent hover:bg-accent/90 text-accent-foreground",
  },
  driver: {
    pageBg: "bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(49_90%_92%/0.45),transparent_55%)]",
    headerGlow: "from-[#F5D33C]/20 to-transparent",
    navActive: "text-gray-950 bg-[#F5D33C]",
    navActiveBorder: "border-[#F5D33C]",
    statIcon: "bg-[#F5D33C]/15 text-[#5C4A00]",
    titleAccent: "border-[#F5D33C]",
    chip: "bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950",
  },
};

export function portalUserInitial(emailOrName: string): string {
  const s = emailOrName.trim();
  if (!s) return "?";
  if (s.includes("@")) return s[0].toUpperCase();
  return s.slice(0, 1).toUpperCase();
}
