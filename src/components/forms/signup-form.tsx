"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import AuthShell, { AuthRoleBadge, authInputClass, authLabelClass } from "@/components/auth-shell";
import { AUTH_BRANDING } from "@/lib/auth-branding";
import { portalHomeForRole } from "@/lib/portal-access";
import type { SignupRole } from "@/lib/services/signup.service";
import { signupSchema } from "@/lib/validation";
import { useToast } from "@/components/toast";
import { parseApiError } from "@/lib/toast-utils";

export default function SignupForm({ role }: { role: SignupRole }) {
  const router = useRouter();
  const toast = useToast();
  const brand = AUTH_BRANDING[role];

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload = { role, name, companyName, email, phone, password };
    const parsed = signupSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check your details.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      const msg = parseApiError(data, "Signup failed. Please try again.");
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      const msg = "Account created but sign-in failed. Please log in manually.";
      setError(msg);
      toast.push({ title: msg, variant: "warning" });
      return;
    }

    toast.push({ title: "Account created successfully", variant: "success" });
    router.push(portalHomeForRole(role, "PENDING"));
    router.refresh();
  }

  return (
    <AuthShell brand={brand} wide>
      <div className="mb-6">
        <AuthRoleBadge role={role} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={authLabelClass}>Full name</label>
          <input
            type="text"
            className={authInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="As per official records"
            required
          />
        </div>

        <div>
          <label className={authLabelClass}>
            {role === "CLIENT" ? "Company name" : "Business / fleet name"}
          </label>
          <input
            type="text"
            className={authInputClass}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Registered business name"
            required
          />
        </div>

        <div>
          <label className={authLabelClass}>Work email</label>
          <input
            type="email"
            autoComplete="email"
            className={authInputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>

        <div>
          <label className={authLabelClass}>Mobile number</label>
          <input
            type="tel"
            className={authInputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            required
          />
        </div>

        <div>
          <label className={authLabelClass}>Password</label>
          <input
            type="password"
            autoComplete="new-password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            placeholder="Minimum 8 characters"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-11 text-base rounded-xl" disabled={loading}>
          {loading ? "Creating account..." : "Create account & continue to KYC"}
        </Button>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          By registering you agree to submit accurate compliance documents for verification.
        </p>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="text-blue-600 font-semibold hover:underline">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
