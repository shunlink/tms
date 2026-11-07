"use client";

import { useEffect, useId, useRef, useState } from "react";
import { readJsonBody } from "@/lib/api-client";
import type { AddressSuggestion } from "@/lib/address-suggestion";

const DEBOUNCE_MS = 300;

export default function AddressSuggestField({
  clientId,
  side,
  label,
  value,
  onChange,
  onSelect,
  required = false,
  error,
  className = "",
}: {
  clientId?: string;
  side: "consignor" | "consignee";
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!clientId || !value.trim()) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const params = new URLSearchParams({ side, q: value.trim() });
        const res = await fetch(
          `/api/clients/${clientId}/address-suggestions?${params.toString()}`,
          { signal: ac.signal }
        );
        const data = await readJsonBody(res);
        if (!res.ok || ac.signal.aborted) return;
        const list = Array.isArray((data as { suggestions?: unknown })?.suggestions)
          ? ((data as { suggestions: AddressSuggestion[] }).suggestions)
          : [];
        setSuggestions(list.slice(0, 5));
        setActiveIndex(-1);
        setOpen(list.length > 0);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [clientId, side, value]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function choose(suggestion: AddressSuggestion) {
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className={`relative md:col-span-2 ${className}`}>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? " *" : ""}
      </label>
      <textarea
        className={`w-full rounded-md border px-3 py-2 text-sm ${
          error ? "border-red-500 focus:ring-red-500" : ""
        }`}
        rows={2}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        role="combobox"
      />
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {!clientId && (
        <p className="mt-1 text-xs text-slate-400">Select a client to see address suggestions.</p>
      )}
      {loading && open && suggestions.length === 0 && (
        <p className="mt-1 text-xs text-slate-400">Searching past addresses…</p>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, index) => (
            <li
              key={`${s.label}-${index}`}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
            >
              <span className="block leading-snug">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
