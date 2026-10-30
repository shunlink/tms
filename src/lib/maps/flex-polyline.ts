/**
 * Decode HERE flexible polyline strings to lat/lng points.
 * @see https://github.com/heremaps/flexible-polyline
 */

class Decoder {
  private readonly encoded: string;
  private index = 0;

  constructor(encoded: string) {
    this.encoded = encoded;
  }

  hasData(): boolean {
    return this.index < this.encoded.length;
  }

  decodeUnsigned(): number {
    let result = 0;
    let shift = 0;
    while (this.index < this.encoded.length) {
      const b = this.encoded.charCodeAt(this.index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (b < 0x20) break;
    }
    return result >>> 0;
  }

  decodeSigned(): number {
    const unsigned = this.decodeUnsigned();
    return unsigned & 1 ? ~(unsigned >> 1) : unsigned >> 1;
  }
}

export function decodeFlexiblePolyline(encoded: string): { lat: number; lng: number }[] {
  if (!encoded) return [];

  const decoder = new Decoder(encoded);
  const header = decoder.decodeUnsigned();
  const factor = 10 ** (header & 15);
  const thirdDim = (header >> 4) & 7;

  let lat = 0;
  let lng = 0;
  const out: { lat: number; lng: number }[] = [];

  while (decoder.hasData()) {
    lat += decoder.decodeSigned();
    lng += decoder.decodeSigned();
    if (thirdDim !== 0) {
      decoder.decodeSigned();
    }
    out.push({ lat: lat / factor, lng: lng / factor });
  }

  return out;
}

export function mergeFlexiblePolylines(polylines: string[]): { lat: number; lng: number }[] {
  const merged: { lat: number; lng: number }[] = [];
  for (const poly of polylines) {
    const pts = decodeFlexiblePolyline(poly);
    if (pts.length === 0) continue;
    if (merged.length === 0) {
      merged.push(...pts);
      continue;
    }
    const last = merged[merged.length - 1];
    const first = pts[0];
    if (last.lat === first.lat && last.lng === first.lng) {
      merged.push(...pts.slice(1));
    } else {
      merged.push(...pts);
    }
  }
  return merged;
}
