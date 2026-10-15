import { Caveat } from "next/font/google";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${caveat.variable} min-h-screen font-sans`}>{children}</div>;
}
