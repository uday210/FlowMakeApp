"use client";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-simple-maps has no bundled type declarations
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";

// Free public TopoJSON — no API key
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country name → ISO numeric code (subset of common countries)
// react-simple-maps world-atlas uses numeric ISO codes
const NAME_TO_ISO: Record<string, number> = {
  "United States": 840, "USA": 840,
  "United Kingdom": 826, "UK": 826,
  "Germany": 276, "France": 304, "Italy": 380, "Spain": 724,
  "Canada": 124, "Australia": 36, "India": 356, "China": 156,
  "Japan": 392, "South Korea": 410, "Brazil": 76, "Mexico": 484,
  "Russia": 643, "South Africa": 710, "Nigeria": 566, "Kenya": 404,
  "Egypt": 818, "Saudi Arabia": 682, "UAE": 784, "United Arab Emirates": 784,
  "Indonesia": 360, "Pakistan": 586, "Bangladesh": 50, "Philippines": 608,
  "Vietnam": 704, "Thailand": 764, "Malaysia": 458, "Singapore": 702,
  "Netherlands": 528, "Belgium": 56, "Sweden": 752, "Norway": 578,
  "Denmark": 208, "Finland": 246, "Poland": 616, "Czech Republic": 203,
  "Austria": 40, "Switzerland": 756, "Portugal": 620, "Greece": 300,
  "Turkey": 792, "Israel": 376, "Iran": 364, "Iraq": 368,
  "Argentina": 32, "Chile": 152, "Colombia": 170, "Peru": 604,
  "Venezuela": 862, "Ecuador": 218, "New Zealand": 554, "Ireland": 372,
  "Hungary": 348, "Romania": 642, "Ukraine": 804, "Slovakia": 703,
};

// ISO 3166-1 alpha-2 country code → numeric (for when we get 2-letter codes)
const ALPHA2_TO_ISO: Record<string, number> = {
  US: 840, GB: 826, DE: 276, FR: 304, IT: 380, ES: 724, CA: 124,
  AU: 36,  IN: 356, CN: 156, JP: 392, KR: 410, BR: 76,  MX: 484,
  RU: 643, ZA: 710, NG: 566, KE: 404, EG: 818, SA: 682, AE: 784,
  ID: 360, PK: 586, BD: 50,  PH: 608, VN: 704, TH: 764, MY: 458,
  SG: 702, NL: 528, BE: 56,  SE: 752, NO: 578, DK: 208, FI: 246,
  PL: 616, CZ: 203, AT: 40,  CH: 756, PT: 620, GR: 300, TR: 792,
  IL: 376, IR: 364, IQ: 368, AR: 32,  CL: 152, CO: 170, PE: 604,
  VE: 862, EC: 218, NZ: 554, IE: 372, HU: 348, RO: 642, UA: 804,
  SK: 703, HR: 191, RS: 688, BG: 100, LT: 440, LV: 428, EE: 233,
  QA: 634, KW: 414, BH: 48,  OM: 512, JO: 400, LB: 422,
  MA: 504, TN: 788, DZ: 12,  LY: 434, ET: 231, GH: 288, TZ: 834,
  UG: 800, ZM: 894, ZW: 716, MZ: 508, MG: 450,
};

function countryToIso(name: string): number | null {
  if (!name || name === "Unknown") return null;
  // Try direct name match
  if (NAME_TO_ISO[name]) return NAME_TO_ISO[name];
  // Try 2-letter code
  if (name.length === 2) return ALPHA2_TO_ISO[name.toUpperCase()] ?? null;
  return null;
}

interface Props {
  countries: { value: string; count: number }[];
}

export default function WorldMap({ countries }: Props) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  // Build lookup: numeric ISO → count
  const countMap: Record<number, number> = {};
  let maxCount = 0;
  for (const c of countries) {
    const iso = countryToIso(c.value);
    if (iso) {
      countMap[iso] = (countMap[iso] ?? 0) + c.count;
      if (countMap[iso] > maxCount) maxCount = countMap[iso];
    }
  }

  function getColor(isoNum: number): string {
    const count = countMap[isoNum];
    if (!count) return "#e2e8f0";
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    // Violet gradient: light → dark
    if (intensity > 0.75) return "#5b21b6";
    if (intensity > 0.5)  return "#7c3aed";
    if (intensity > 0.25) return "#a78bfa";
    return "#ddd6fe";
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 relative">
      <p className="text-xs font-semibold text-gray-700 mb-3">🗺️ Visitor Map</p>

      {/* Legend */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <span className="text-[9px] text-gray-400">Low</span>
        {["#ddd6fe","#a78bfa","#7c3aed","#5b21b6"].map(c => (
          <div key={c} className="w-4 h-2 rounded-sm" style={{ background: c }} />
        ))}
        <span className="text-[9px] text-gray-400">High</span>
      </div>

      <ComposableMap
        projectionConfig={{ scale: 140, center: [0, 20] }}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup zoom={1} minZoom={1} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: { id: string; rsmKey: string; properties: { name: string } }[] }) =>
              geographies.map((geo) => {
                const isoNum = parseInt(geo.id, 10);
                const count = countMap[isoNum] ?? 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColor(isoNum)}
                    stroke="#fff"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover:   { outline: "none", fill: count ? "#4c1d95" : "#cbd5e1", cursor: count ? "pointer" : "default" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={(e: React.MouseEvent) => {
                      if (!count) return;
                      setTooltip({ name: geo.properties.name, count, x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e: React.MouseEvent) => {
                      if (!count) return;
                      setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 32 }}
        >
          <span className="font-semibold">{tooltip.name}</span>
          <span className="text-gray-300 ml-1.5">{tooltip.count} visitor{tooltip.count !== 1 ? "s" : ""}</span>
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-center mt-1">Scroll to zoom · Drag to pan</p>
    </div>
  );
}
