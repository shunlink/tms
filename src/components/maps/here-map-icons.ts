function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Pickup / loading point */
export const PICKUP_MARKER_ICON = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18" fill="#059669" stroke="#fff" stroke-width="2"/>
  <path fill="#fff" d="M12 14h16v3H12zm0 5h11v11H12zm14 0h2v11h-2z"/>
  <path fill="#fff" d="M16 22h4v6h-4z"/>
</svg>`);

/** Drop / delivery point */
export const DROP_MARKER_ICON = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18" fill="#dc2626" stroke="#fff" stroke-width="2"/>
  <path fill="#fff" d="M20 10l8 8h-5v10h-6V18h-5l8-8z"/>
</svg>`);

/** Current vehicle position */
export const TRUCK_MARKER_ICON = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="20" fill="#0ea5e9" stroke="#fff" stroke-width="2"/>
  <path fill="#fff" d="M11 18h14l3 4h5v9H11V18zm2 2v7h9v-7h-9zm11 0v7h5l-2-3h-3zm-9 11a2 2 0 110-4 2 2 0 010 4zm14 0a2 2 0 110-4 2 2 0 010 4z"/>
</svg>`);

export const MARKER_ICON_SIZE = { w: 40, h: 40 };
export const TRUCK_ICON_SIZE = { w: 44, h: 44 };
