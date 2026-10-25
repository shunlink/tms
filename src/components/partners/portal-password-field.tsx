"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import {
  generatePortalPassword,
  PORTAL_PASSWORD_HINT,
} from "@/lib/portal-password";
import { useToast } from "@/components/toast";

export default function PortalPasswordField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [visible, setVisible] = useState(false);

  function generate() {
    const pwd = generatePortalPassword();
    onChange(pwd);
    setVisible(true);
  }

  async function copy() {
    if (!value) {
      toast.push({ title: "Generate a password first", variant: "warning" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.push({ title: "Password copied", variant: "success" });
    } catch {
      toast.push({ title: "Could not copy to clipboard", variant: "error" });
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Password *</label>
      <div className="flex gap-2">
        <input
          type={visible ? "text" : "password"}
          className="flex-1 min-w-0 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          disabled={disabled}
          placeholder="Generate or enter manually"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 px-3"
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Hide password" : "Show password"}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 px-3"
          disabled={disabled || !value}
          onClick={() => void copy()}
          title="Copy password"
          aria-label="Copy password"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 bg-slate-900 text-white hover:bg-slate-800 border-slate-900"
        disabled={disabled}
        onClick={generate}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Generate password
      </Button>
      <p className="text-xs text-slate-500">{PORTAL_PASSWORD_HINT}</p>
    </div>
  );
}
