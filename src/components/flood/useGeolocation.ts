"use client";

import { useCallback, useState } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; lon: number; lat: number; accuracyM: number }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * The viewer's position, requested only when they ask for it.
 *
 * Never requested on load: a permission prompt the moment a flood map opens is
 * both hostile and likely to be dismissed, and the map is useful without it.
 * The position stays in the browser — it is never sent to the API or to
 * analytics.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }

    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: "ready",
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracyM: pos.coords.accuracy,
        }),
      (err) =>
        setState({
          status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        }),
      // A rough fix fast beats an exact one slowly when water is rising.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  return { state, locate };
}
