import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

type Mode = "dolphin" | "satellite" | "hybrid";

const OSM_ATTR = "© OpenStreetMap contributors";
const ESRI_ATTR = "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and partners";

const rasterStyle = (tiles: string[], attribution: string, overlay = false) => ({
  version: 8 as const,
  sources: {
    base: {
      type: "raster" as const,
      tiles,
      tileSize: 256,
      attribution
    }
  },
  layers: [
    {
      id: "base",
      type: "raster" as const,
      source: "base",
      paint: overlay ? { "raster-opacity": 0.9 } : undefined
    }
  ]
});

const styles = {
  dolphin: rasterStyle(
    ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    OSM_ATTR
  ),
  satellite: rasterStyle(
    ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    ESRI_ATTR
  ),
  hybrid: rasterStyle(
    ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    ESRI_ATTR
  )
};

let mode: Mode = "dolphin";
let userMarker: maplibregl.Marker | null = null;
let watchId: number | null = null;
let lastPosition: GeolocationPosition | null = null;
let hasCentered = false;

const map = new Map({
  container: "map",
  style: styles.dolphin,
  center: [4.303, 51.494], // Bergen op Zoom
  zoom: 10.7,
  pitch: 0,
  bearing: 0,
  attributionControl: false
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const toast = (message: string) => {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  window.setTimeout(() => el.classList.add("hidden"), 2600);
};

function addDolphinOverlay() {
  if (!map.isStyleLoaded()) {
    map.once("styledata", addDolphinOverlay);
    return;
  }

  // Demo vaarroute/objectlaag. Later vervangen door officiële vaarwegdata.
  if (!map.getSource("dolphin-demo")) {
    map.addSource("dolphin-demo", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { kind: "route" },
            geometry: {
              type: "LineString",
              coordinates: [
                [4.265, 51.49],
                [4.33, 51.54],
                [4.39, 51.59],
                [4.43, 51.66]
              ]
            }
          }
        ]
      }
    });

    map.addLayer({
      id: "dolphin-demo-route",
      type: "line",
      source: "dolphin-demo",
      paint: {
        "line-color": "#44e4c2",
        "line-width": 5,
        "line-opacity": 0.9
      }
    });
  }
}

map.on("load", addDolphinOverlay);

function setMode(nextMode: Mode) {
  mode = nextMode;
  map.setStyle(styles[nextMode]);
  map.once("styledata", addDolphinOverlay);

  document.querySelectorAll<HTMLButtonElement>(".mode").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === nextMode);
  });
  toast(`${nextMode[0].toUpperCase() + nextMode.slice(1)} kaart actief`);
}

function updatePosition(pos: GeolocationPosition) {
  lastPosition = pos;
  const { latitude, longitude, accuracy, speed, heading } = pos.coords;

  $("accuracy").textContent = Math.round(accuracy).toString();
  $("sog").textContent =
    speed == null ? "—" : (speed * 1.943844).toFixed(1);
  $("cog").textContent =
    heading == null || Number.isNaN(heading) ? "—" : Math.round(heading).toString();

  const el = document.createElement("div");
  el.className = "boat-marker";
  el.innerHTML = `<div class="boat-arrow">▲</div><div class="boat-pulse"></div>`;

  if (!userMarker) {
    userMarker = new maplibregl.Marker({
      element: el,
      anchor: "center",
      rotationAlignment: "map"
    })
      .setLngLat([longitude, latitude])
      .addTo(map);
  } else {
    userMarker.setLngLat([longitude, latitude]);
  }

  if (heading != null && !Number.isNaN(heading)) {
    userMarker.setRotation(heading);
  }

  if (!hasCentered) {
    hasCentered = true;
    map.easeTo({ center: [longitude, latitude], zoom: 15, duration: 1200 });
  }
}

function startLocation() {
  if (!("geolocation" in navigator)) {
    toast("GPS wordt niet ondersteund in deze browser.");
    return;
  }

  if (watchId != null) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(
    updatePosition,
    err => {
      const messages: Record<number, string> = {
        1: "Geef Dolphin toegang tot je exacte locatie.",
        2: "GPS-positie tijdelijk niet beschikbaar.",
        3: "GPS-time-out. Probeer opnieuw."
      };
      toast(messages[err.code] ?? "GPS-fout");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 12000
    }
  );
}

$("locateBtn").addEventListener("click", () => {
  if (lastPosition) {
    const { longitude, latitude } = lastPosition.coords;
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15), duration: 700 });
  } else {
    startLocation();
  }
});

$("layersBtn").addEventListener("click", () => $("layerSheet").classList.remove("hidden"));
$("closeSheet").addEventListener("click", () => $("layerSheet").classList.add("hidden"));
$("layerSheet").addEventListener("click", (e) => {
  if (e.target === $("layerSheet")) $("layerSheet").classList.add("hidden");
});

document.querySelectorAll<HTMLButtonElement>(".mode").forEach(btn => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode as Mode));
});

$("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    toast("Zoeken koppelen we in Alpha 0.2 aan geocoding en vaarwegobjecten.");
    ($("searchInput") as HTMLInputElement).blur();
  }
});

startLocation();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
