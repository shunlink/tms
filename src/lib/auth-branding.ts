import type { SignupRole } from "./services/signup.service";

export type AuthBrandConfig = {
  role: SignupRole | "LOGIN";
  title: string;
  headline: string;
  description: string;
  accent: string;
  steps: { title: string; desc: string }[];
};

export const AUTH_BRANDING: Record<SignupRole | "LOGIN", AuthBrandConfig> = {
  LOGIN: {
    role: "LOGIN",
    title: "Welcome back",
    headline: "Your logistics command centre",
    description:
      "Sign in to manage indents, track shipments, submit quotes, and keep compliance up to date.",
    accent: "from-[#1B2A4A] via-[#243656] to-[#1B2A4A]",
    steps: [
      { title: "Sign in", desc: "Use your registered email" },
      { title: "Complete KYC", desc: "If your account is new" },
      { title: "Go live", desc: "Full portal access after approval" },
    ],
  },
  CLIENT: {
    role: "CLIENT",
    title: "Signup",
    headline: "Ship smarter with ShunLink",
    description:
      "Register your company, raise vehicle requirements, track consignments, and manage invoices — all in one portal.",
    accent: "from-[#0F766E] via-[#1B2A4A] to-[#134E4A]",
    steps: [
      { title: "Create account", desc: "Company email & contact" },
      { title: "Upload KYC", desc: "GST, PAN & bank proof" },
      { title: "Raise requirements", desc: "Get indents & track trips" },
    ],
  },
  VENDOR: {
    role: "VENDOR",
    title: "Signup",
    headline: "Win loads. Run trips. Get paid.",
    description:
      "Join our vendor network, quote on open indents, assign your fleet, and upload delivery proof from your portal.",
    accent: "from-[#B45309] via-[#1B2A4A] to-[#92400E]",
    steps: [
      { title: "Create account", desc: "Fleet owner or broker" },
      { title: "Fleet compliance", desc: "GST, PAN & vehicle docs" },
      { title: "Quote & execute", desc: "Open indents to trips" },
    ],
  },
};
