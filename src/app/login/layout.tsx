import { Caveat } from "next/font/google";
import { getSessionUser } from "@/lib/auth";
import { redirectIfAuthenticated } from "@/lib/auth-redirect";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
});

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  await redirectIfAuthenticated(user);

  return <div className={`${caveat.variable} min-h-screen font-sans`}>{children}</div>;
}
