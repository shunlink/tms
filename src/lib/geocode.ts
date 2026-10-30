import { readJsonBody } from "@/lib/api-client";

import { mapsProvider as coreMapsProvider } from "@/lib/maps/config";

export function mapsProvider() {
  const p = coreMapsProvider();
  if (p === "google") return "google";
  if (p === "here") return "here";
  return process.env.MAPS_PROVIDER === "google" ? "google" : "nominatim";
}

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  raw?: unknown;
};

function pickAddress(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  return (
    data.formatted ??
    data.display_name ??
    data.formatted_address ??
    data.results?.[0]?.formatted_address ??
    null
  );
}

async function nominatimReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "TMS-Aggregator/0.1 (transport management system)",
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) return null;
  const data = await readJsonBody(res);
  const label = pickAddress(data);
  if (!label) return null;
  return { label, lat, lng, raw: data };
}

async function hereReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const key = process.env.HERE_API_KEY?.trim();
  if (!key) return null;
  const url =
    `https://revgeocode.search.hereapi.com/v1/revgeocode?` +
    `at=${lat},${lng}&lang=en&apiKey=${encodeURIComponent(key)}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) return null;
  const data = (await readJsonBody(res)) as {
    items?: { title?: string; address?: { label?: string } }[];
  };
  const item = data.items?.[0];
  const label = item?.address?.label ?? item?.title ?? null;
  if (!label) return null;
  return { label, lat, lng, raw: data };
}

async function hereForward(query: string): Promise<GeocodeResult | null> {
  const key = process.env.HERE_API_KEY?.trim();
  if (!key) return null;
  const url =
    `https://geocode.search.hereapi.com/v1/geocode?` +
    `q=${encodeURIComponent(query)}&apiKey=${encodeURIComponent(key)}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) return null;
  const data = (await readJsonBody(res)) as {
    items?: { title?: string; address?: { label?: string }; position?: { lat: number; lng: number } }[];
  };
  const item = data.items?.[0];
  if (!item?.position) return null;
  const label = item.address?.label ?? item.title ?? query;
  return {
    label,
    lat: item.position.lat,
    lng: item.position.lng,
    raw: data,
  };
}

async function googleReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) return null;
  const data = (await readJsonBody(res)) as {
    results?: { formatted_address?: string }[];
  };
  const label = data.results?.[0]?.formatted_address ?? null;
  if (!label) return null;
  return { label, lat, lng, raw: data };
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const provider = mapsProvider();
  try {
    if (provider === "google") return await googleReverse(lat, lng);
    if (provider === "here") return await hereReverse(lat, lng);
    return await nominatimReverse(lat, lng);
  } catch {
    return null;
  }
}

export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const provider = mapsProvider();
  try {
    if (provider === "google") {
      const key = process.env.GOOGLE_MAPS_API_KEY;
      if (!key) return null;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}`;
      const res = await fetch(url, { next: { revalidate: 60 * 60 } });
      if (!res.ok) return null;
      const data = (await readJsonBody(res)) as {
        results?: {
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
        }[];
      };
      const r = data.results?.[0];
      if (!r) return null;
      return {
        label: r.formatted_address,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        raw: data,
      };
    }

    if (provider === "here") {
      return await hereForward(query);
    }

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TMS-Aggregator/0.1 (transport management system)",
        Accept: "application/json",
      },
      next: { revalidate: 60 * 60 },
    });
    if (!res.ok) return null;
    const data = (await readJsonBody(res)) as {
      display_name: string;
      lat: string;
      lon: string;
    }[];
    const r = data?.[0];
    if (!r) return null;
    return {
      label: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      raw: data,
    };
  } catch {
    return null;
  }
}

// Convenience: attach a human-readable address to a tracking ping when the maps
// provider is reachable, so operators/clients see "near Nagpur" not raw coords.
export async function pingAddress(lat: number, lng: number): Promise<string | null> {
  const r = await reverseGeocode(lat, lng);
  return r?.label ?? null;
}
