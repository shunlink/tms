"use client";

import { useEffect, useRef, useState } from "react";
import type { TripMapDisplay } from "@/lib/services/trip-map-display.service";
import {
  DROP_MARKER_ICON,
  MARKER_ICON_SIZE,
  PICKUP_MARKER_ICON,
  TRUCK_ICON_SIZE,
  TRUCK_MARKER_ICON,
} from "@/components/maps/here-map-icons";

const HERE_JS_VERSION = "3.1";

type HereGlobal = {
  service: {
    Platform: new (opts: { apikey: string }) => {
      createDefaultLayers: () => Record<string, Record<string, unknown>>;
    };
  };
  Map: new (
    element: HTMLElement,
    layer: unknown,
    opts: { center: { lat: number; lng: number }; zoom: number; pixelRatio: number }
  ) => {
    addObject: (obj: unknown) => void;
    removeObjects: (objs: unknown[]) => void;
    getViewModel: () => { setLookAtData: (data: { bounds: unknown }) => void };
    getViewPort: () => { resize: () => void };
  };
  mapevents: {
    MapEvents: new (map: unknown) => unknown;
    Behavior: new (events: unknown) => unknown;
  };
  ui: { UI: { createDefault: (map: unknown, layers: unknown) => unknown } };
  geo: {
    LineString: { fromFlexiblePolyline: (poly: string) => unknown };
    MultiLineString: new (lines: unknown[]) => unknown;
  };
  map: {
    Polyline: new (geometry: unknown, opts?: { style?: Record<string, unknown> }) => unknown;
    Marker: new (point: { lat: number; lng: number }, opts?: { icon?: unknown }) => unknown;
    Icon: new (
      url: string,
      opts?: { size?: { w: number; h: number }; anchor?: { x: number; y: number } }
    ) => unknown;
    Group: new (opts: { objects: unknown[] }) => {
      getBoundingBox: () => unknown;
    };
  };
};

function getHere(): HereGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { H?: HereGlobal }).H ?? null;
}

function loadHereScripts(): Promise<void> {
  const H = getHere();
  if (H?.Map) return Promise.resolve();

  const urls = [
    `https://js.api.here.com/v3/${HERE_JS_VERSION}/mapsjs-core.js`,
    `https://js.api.here.com/v3/${HERE_JS_VERSION}/mapsjs-service.js`,
    `https://js.api.here.com/v3/${HERE_JS_VERSION}/mapsjs-mapevents.js`,
    `https://js.api.here.com/v3/${HERE_JS_VERSION}/mapsjs-ui.js`,
  ];

  return urls.reduce<Promise<void>>(
    (chain, src) =>
      chain.then(
        () =>
          new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }
            const el = document.createElement("script");
            el.src = src;
            el.async = false;
            el.onload = () => resolve();
            el.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.body.appendChild(el);
          })
      ),
    Promise.resolve()
  );
}

function polylinesFromLeg(polylines: string[]): unknown[] {
  const H = getHere();
  if (!H) return [];
  return polylines.map((p) => H.geo.LineString.fromFlexiblePolyline(p));
}

function polylinesToLine(mapDisplay: TripMapDisplay, key: "plannedRoute" | "remaining"): unknown[] {
  return polylinesFromLeg(mapDisplay[key]?.polylines ?? []);
}

function markerWithIcon(
  H: HereGlobal,
  point: { lat: number; lng: number },
  iconUrl: string,
  size: { w: number; h: number }
) {
  const icon = new H.map.Icon(iconUrl, {
    size,
    anchor: { x: size.w / 2, y: size.h / 2 },
  });
  return new H.map.Marker(point, { icon });
}

export default function HereTripMap({
  apiKey,
  mapDisplay,
  className = "w-full h-72",
}: {
  apiKey: string;
  mapDisplay: TripMapDisplay;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const routeGroupRef = useRef<unknown[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHereScripts()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "HERE Maps failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !apiKey) return;
    const H = getHere();
    if (!H) return;

    const center = mapDisplay.current ??
      mapDisplay.origin ?? { lat: 20.5937, lng: 78.9629 };

    if (!mapRef.current) {
      const platform = new H.service.Platform({ apikey: apiKey });
      const layers = platform.createDefaultLayers() as {
        vector: { normal: { map: unknown } };
      };
      const map = new H.Map(containerRef.current, layers.vector.normal.map, {
        center,
        zoom: 8,
        pixelRatio: window.devicePixelRatio || 1,
      });
      new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
      H.ui.UI.createDefault(map, layers);
      mapRef.current = map;

      const onResize = () => {
        map.getViewPort().resize();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, [ready, apiKey, mapDisplay.current, mapDisplay.origin]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const H = getHere();
    if (!H) return;
    const map = mapRef.current as {
      removeObjects: (o: unknown[]) => void;
      addObject: (o: unknown) => void;
      getViewModel: () => { setLookAtData: (d: { bounds: unknown }) => void };
    };

    if (routeGroupRef.current.length) {
      map.removeObjects(routeGroupRef.current);
      routeGroupRef.current = [];
    }

    const objects: unknown[] = [];

    const plannedLines = polylinesToLine(mapDisplay, "plannedRoute");
    if (plannedLines.length) {
      const multi = new H.geo.MultiLineString(plannedLines);
      objects.push(
        new H.map.Polyline(multi, {
          style: { lineWidth: 5, strokeColor: "rgba(37, 99, 235, 0.85)" },
        })
      );
    }

    const approachLines =
      mapDisplay.remaining?.onMainRoute === false
        ? polylinesFromLeg(mapDisplay.approachRoute?.polylines ?? [])
        : [];
    if (approachLines.length) {
      const multi = new H.geo.MultiLineString(approachLines);
      objects.push(
        new H.map.Polyline(multi, {
          style: {
            lineWidth: 4,
            strokeColor: "rgba(16, 185, 129, 0.9)",
          },
        })
      );
    }

    const remainingLines =
      mapDisplay.remaining?.onMainRoute === true
        ? polylinesToLine(mapDisplay, "remaining")
        : [];
    if (remainingLines.length) {
      const multi = new H.geo.MultiLineString(remainingLines);
      objects.push(
        new H.map.Polyline(multi, {
          style: {
            lineWidth: 4,
            strokeColor: "rgba(16, 185, 129, 0.9)",
            lineDash: [8, 4],
          },
        })
      );
    }

    if (mapDisplay.origin) {
      objects.push(
        markerWithIcon(H, mapDisplay.origin, PICKUP_MARKER_ICON, MARKER_ICON_SIZE)
      );
    }
    if (mapDisplay.destination) {
      objects.push(
        markerWithIcon(H, mapDisplay.destination, DROP_MARKER_ICON, MARKER_ICON_SIZE)
      );
    }
    if (mapDisplay.current) {
      objects.push(
        markerWithIcon(H, mapDisplay.current, TRUCK_MARKER_ICON, TRUCK_ICON_SIZE)
      );
    }

    if (objects.length === 0) return;

    const group = new H.map.Group({ objects });
    map.addObject(group);
    routeGroupRef.current = [group];

    const bounds = group.getBoundingBox();
    if (bounds) {
      map.getViewModel().setLookAtData({ bounds });
    }
  }, [ready, mapDisplay]);

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  return (
    <>
      <link
        rel="stylesheet"
        type="text/css"
        href={`https://js.api.here.com/v3/${HERE_JS_VERSION}/mapsjs-ui.css`}
      />
      <div ref={containerRef} className={`overflow-hidden rounded-lg border bg-slate-100 ${className}`} />
      {!ready && <p className="text-xs text-slate-500 mt-1">Loading map…</p>}
    </>
  );
}
