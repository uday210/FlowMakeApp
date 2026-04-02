"use client";

import { useEffect, useRef, useState } from "react";

// ISO Alpha-2 → numeric (world-atlas uses numeric IDs)
const ALPHA2_TO_NUM: Record<string, number> = {
  US:840,GB:826,DE:276,FR:250,IT:380,ES:724,CA:124,AU:36,IN:356,CN:156,
  JP:392,KR:410,BR:76,MX:484,RU:643,ZA:710,NG:566,KE:404,EG:818,SA:682,
  AE:784,ID:360,PK:586,BD:50,PH:608,VN:704,TH:764,MY:458,SG:702,NL:528,
  BE:56,SE:752,NO:578,DK:208,FI:246,PL:616,CZ:203,AT:40,CH:756,PT:620,
  GR:300,TR:792,IL:376,IR:364,IQ:368,AR:32,CL:152,CO:170,PE:604,NZ:554,
  IE:372,HU:348,RO:642,UA:804,SK:703,HR:191,RS:688,BG:100,LT:440,LV:428,
  QA:634,KW:414,BH:48,OM:512,JO:400,MA:504,TN:788,DZ:12,ET:231,
  GH:288,TZ:834,UG:800,ZW:716,MZ:508,LK:144,MM:104,KH:116,NP:524,AF:4,
  PY:600,BO:68,UY:858,CR:188,PA:591,GT:320,HN:340,SV:222,NI:558,CU:192,
  DO:214,JM:388,TT:780,IS:352,LU:442,MT:470,CY:196,MD:498,BY:112,
  GE:268,AM:51,AZ:31,KZ:398,UZ:860,TM:795,TJ:762,KG:417,MN:496,
};

// Country name → numeric (fallback for name-based matching)
const NAME_TO_NUM: Record<string, number> = {
  "United States":840,"United Kingdom":826,"Germany":276,"France":250,
  "Italy":380,"Spain":724,"Canada":124,"Australia":36,"India":356,"China":156,
  "Japan":392,"South Korea":410,"Brazil":76,"Mexico":484,"Russia":643,
  "South Africa":710,"Nigeria":566,"Kenya":404,"Egypt":818,"Saudi Arabia":682,
  "United Arab Emirates":784,"Indonesia":360,"Pakistan":586,"Bangladesh":50,
  "Philippines":608,"Vietnam":704,"Thailand":764,"Malaysia":458,"Singapore":702,
  "Netherlands":528,"Belgium":56,"Sweden":752,"Norway":578,"Denmark":208,
  "Finland":246,"Poland":616,"Czech Republic":203,"Austria":40,"Switzerland":756,
  "Portugal":620,"Greece":300,"Turkey":792,"Israel":376,"Iran":364,"Iraq":368,
  "Argentina":32,"Chile":152,"Colombia":170,"Peru":604,"New Zealand":554,
  "Ireland":372,"Hungary":348,"Romania":642,"Ukraine":804,
};

function resolveCountry(value: string): number | null {
  if (!value || value === "Unknown") return null;
  if (value.length === 2) return ALPHA2_TO_NUM[value.toUpperCase()] ?? null;
  return NAME_TO_NUM[value] ?? null;
}

// City name → [lon, lat]  (subset of major world cities)
const CITY_COORDS: Record<string, [number, number]> = {
  // North America
  "New York": [-74.006, 40.712], "Los Angeles": [-118.244, 34.052],
  "Chicago": [-87.629, 41.878], "Houston": [-95.370, 29.760],
  "Phoenix": [-112.074, 33.449], "Philadelphia": [-75.165, 39.952],
  "San Antonio": [-98.494, 29.424], "San Diego": [-117.161, 32.715],
  "Dallas": [-96.797, 32.776], "San Jose": [-121.886, 37.338],
  "Austin": [-97.743, 30.267], "Jacksonville": [-81.655, 30.332],
  "Seattle": [-122.333, 47.606], "Denver": [-104.990, 39.739],
  "Boston": [-71.058, 42.360], "Portland": [-122.676, 45.523],
  "Miami": [-80.192, 25.774], "Atlanta": [-84.388, 33.749],
  "Minneapolis": [-93.265, 44.977], "Las Vegas": [-115.139, 36.175],
  "Toronto": [-79.383, 43.653], "Montreal": [-73.568, 45.501],
  "Vancouver": [-123.121, 49.282], "Calgary": [-114.066, 51.045],
  "Mexico City": [-99.133, 19.433], "Guadalajara": [-103.349, 20.666],
  // Europe
  "London": [-0.128, 51.507], "Paris": [2.349, 48.864],
  "Berlin": [13.405, 52.520], "Madrid": [-3.703, 40.417],
  "Rome": [12.496, 41.903], "Vienna": [16.373, 48.208],
  "Amsterdam": [4.895, 52.370], "Brussels": [4.352, 50.846],
  "Stockholm": [18.068, 59.329], "Oslo": [10.757, 59.913],
  "Copenhagen": [12.568, 55.676], "Helsinki": [24.938, 60.170],
  "Warsaw": [21.012, 52.230], "Prague": [14.421, 50.088],
  "Budapest": [19.040, 47.498], "Bucharest": [26.097, 44.439],
  "Athens": [23.728, 37.984], "Lisbon": [-9.139, 38.717],
  "Barcelona": [2.154, 41.390], "Munich": [11.576, 48.137],
  "Hamburg": [9.993, 53.551], "Frankfurt": [8.682, 50.110],
  "Zurich": [8.541, 47.376], "Geneva": [6.143, 46.204],
  "Dublin": [-6.260, 53.350], "Edinburgh": [-3.188, 55.953],
  "Manchester": [-2.238, 53.483], "Milan": [9.190, 45.464],
  "Kiev": [30.523, 50.450], "Kyiv": [30.523, 50.450],
  "Minsk": [27.566, 53.904], "Vilnius": [25.280, 54.687],
  "Riga": [24.106, 56.946], "Tallinn": [24.745, 59.437],
  "Sofia": [23.320, 42.698], "Zagreb": [15.978, 45.815],
  "Belgrade": [20.457, 44.802], "Bratislava": [17.107, 48.148],
  // Asia
  "Tokyo": [139.692, 35.689], "Osaka": [135.502, 34.694],
  "Beijing": [116.407, 39.904], "Shanghai": [121.474, 31.230],
  "Shenzhen": [114.058, 22.543], "Guangzhou": [113.264, 23.129],
  "Mumbai": [72.878, 19.076], "Delhi": [77.209, 28.614],
  "Bangalore": [77.594, 12.972], "Hyderabad": [78.474, 17.385],
  "Chennai": [80.270, 13.083], "Kolkata": [88.363, 22.573],
  "Pune": [73.857, 18.520], "Ahmedabad": [72.587, 23.022],
  "Seoul": [126.978, 37.566], "Busan": [129.042, 35.101],
  "Jakarta": [106.845, -6.208], "Surabaya": [112.752, -7.249],
  "Manila": [120.984, 14.599], "Singapore": [103.820, 1.352],
  "Kuala Lumpur": [101.687, 3.140], "Bangkok": [100.501, 13.754],
  "Ho Chi Minh City": [106.660, 10.823], "Hanoi": [105.851, 21.028],
  "Taipei": [121.565, 25.033], "Hong Kong": [114.183, 22.307],
  "Dubai": [55.296, 25.205], "Abu Dhabi": [54.366, 24.454],
  "Riyadh": [46.738, 24.686], "Jeddah": [39.192, 21.485],
  "Istanbul": [28.978, 41.013], "Ankara": [32.866, 39.920],
  "Tehran": [51.423, 35.694], "Baghdad": [44.361, 33.341],
  "Karachi": [67.010, 24.861], "Lahore": [74.329, 31.558],
  "Dhaka": [90.407, 23.810], "Colombo": [79.862, 6.932],
  "Kathmandu": [85.314, 27.717], "Tashkent": [69.240, 41.299],
  "Almaty": [76.951, 43.238], "Bishkek": [74.582, 42.871],
  "Ulaanbaatar": [106.921, 47.886], "Yangon": [96.160, 16.866],
  "Phnom Penh": [104.916, 11.562],
  // Oceania
  "Sydney": [151.209, -33.868], "Melbourne": [144.963, -37.814],
  "Brisbane": [153.023, -27.470], "Perth": [115.861, -31.951],
  "Adelaide": [138.601, -34.929], "Auckland": [174.763, -36.848],
  // Africa
  "Cairo": [31.233, 30.044], "Lagos": [3.397, 6.455],
  "Kinshasa": [15.322, -4.322], "Johannesburg": [28.047, -26.204],
  "Cape Town": [18.424, -33.925], "Nairobi": [36.817, -1.292],
  "Addis Ababa": [38.762, 9.025], "Dar es Salaam": [39.273, -6.800],
  "Khartoum": [32.560, 15.552], "Accra": [-0.187, 5.603],
  "Casablanca": [-7.589, 33.573], "Tunis": [10.181, 36.818],
  "Algiers": [3.042, 36.752],
  // South America
  "São Paulo": [-46.633, -23.548], "Rio de Janeiro": [-43.173, -22.906],
  "Buenos Aires": [-58.382, -34.604], "Lima": [-77.043, -12.046],
  "Bogotá": [-74.073, 4.711], "Santiago": [-70.649, -33.459],
  "Caracas": [-66.879, 10.480], "Quito": [-78.467, -0.180],
  "Montevideo": [-56.165, -34.901], "Asunción": [-57.636, -25.286],
};

// Equirectangular projection
function lonLatToXY(lon: number, lat: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

// Split ring at antimeridian crossings to avoid horizontal lines across the map
function projectRing(ring: number[][], w: number, h: number): string {
  if (ring.length === 0) return "";
  const subpaths: string[][] = [[]];
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const [x, y] = lonLatToXY(lon, lat, w, h);
    const current = subpaths[subpaths.length - 1];
    if (i > 0) {
      const prevLon = ring[i - 1][0];
      // Antimeridian crossing: longitude jumps by more than 180°
      if (Math.abs(lon - prevLon) > 180) {
        subpaths.push([]);
      }
    }
    subpaths[subpaths.length - 1].push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return subpaths
    .filter(s => s.length > 1)
    .map(pts => "M" + pts[0] + " L" + pts.slice(1).join(" L") + "Z")
    .join(" ");
}

interface GeoFeature {
  id: string;
  properties: { name: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

// Crop to lat 78°N → 58°S to remove Arctic noise and trim Antarctica
// Equirectangular: y = ((90 - lat) / 180) * H
const CROP_TOP    = Math.round(((90 - 78) / 180) * 480);  // ~32px
const CROP_BOTTOM = Math.round(((90 - (-58)) / 180) * 480); // ~395px
const CROP_H      = CROP_BOTTOM - CROP_TOP;

interface Props {
  countries: { value: string; count: number }[];
  cities?: { value: string; count: number }[];
}

export default function WorldMap({ countries, cities = [] }: Props) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 960, H = 480;

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json())
      .then(topo => {
        // Convert TopoJSON → GeoJSON manually (no topojson lib needed)
        const obj = topo.objects.countries;
        const arcs: number[][][] = topo.arcs;
        const scale = topo.transform?.scale ?? [1, 1];
        const translate = topo.transform?.translate ?? [0, 0];

        // Decode delta-encoded arcs
        const decodedArcs = arcs.map((arc: number[][]) => {
          let x = 0, y = 0;
          return arc.map(([dx, dy]: number[]) => {
            x += dx; y += dy;
            return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
          });
        });

        const geoms: GeoFeature[] = obj.geometries.map((geom: { id: string; properties: { name: string }; type: string; arcs: unknown }) => {
          const coordsFromArcs = (arcIdxs: number[]): number[][] => {
            const pts: number[][] = [];
            for (const idx of arcIdxs) {
              const arc = idx < 0 ? [...decodedArcs[~idx]].reverse() : decodedArcs[idx];
              pts.push(...arc);
            }
            return pts;
          };

          let coordinates: number[][][] | number[][][][] = [];
          if (geom.type === "Polygon") {
            coordinates = (geom.arcs as number[][]).map(coordsFromArcs) as number[][][];
          } else if (geom.type === "MultiPolygon") {
            coordinates = (geom.arcs as number[][][]).map(poly =>
              poly.map(coordsFromArcs)
            ) as number[][][][];
          }

          return { id: geom.id, properties: geom.properties ?? { name: "" }, geometry: { type: geom.type, coordinates } };
        });

        setFeatures(geoms);
      })
      .catch(() => {}); // non-critical — map just won't show
  }, []);

  // Build count map: numeric ISO → count
  const countMap: Record<number, number> = {};
  let maxCount = 0;
  for (const c of countries) {
    const num = resolveCountry(c.value);
    if (num) {
      countMap[num] = (countMap[num] ?? 0) + c.count;
      if (countMap[num] > maxCount) maxCount = countMap[num];
    }
  }

  // Build city dots data
  const cityDots = cities
    .map(c => ({ name: c.value, count: c.count, coords: CITY_COORDS[c.value] }))
    .filter(c => c.coords != null) as { name: string; count: number; coords: [number, number] }[];
  const maxCityCount = cityDots.reduce((m, c) => Math.max(m, c.count), 1);

  function getColor(id: string): string {
    const num = parseInt(id, 10);
    const count = countMap[num];
    if (!count) return "#e2e8f0";
    const t = Math.min(count / Math.max(maxCount, 1), 1);
    if (t > 0.75) return "#5b21b6";
    if (t > 0.5)  return "#7c3aed";
    if (t > 0.25) return "#a78bfa";
    return "#ddd6fe";
  }

  function getCount(id: string): number {
    return countMap[parseInt(id, 10)] ?? 0;
  }

  function renderPaths(feat: GeoFeature): string {
    if (feat.geometry.type === "Polygon") {
      return (feat.geometry.coordinates as number[][][]).map(ring => projectRing(ring, W, H)).join(" ");
    }
    return (feat.geometry.coordinates as number[][][][]).map(poly =>
      poly.map(ring => projectRing(ring, W, H)).join(" ")
    ).join(" ");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">🗺️ Visitor Map</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-400">Countries</span>
            {["#ddd6fe","#a78bfa","#7c3aed","#5b21b6"].map(c => (
              <div key={c} className="w-4 h-2 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-white" />
            <span className="text-[9px] text-gray-400">Cities</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-[#f0f4ff]">
        {features.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-xs text-gray-400">Loading map…</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 ${CROP_TOP} ${W} ${CROP_H}`}
            className="w-full h-auto"
            style={{ display: "block" }}
          >
            {features.map(feat => {
              const count = getCount(feat.id);
              return (
                <path
                  key={feat.id}
                  d={renderPaths(feat)}
                  fill={getColor(feat.id)}
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{ cursor: count ? "pointer" : "default", transition: "fill 0.15s" }}
                  onMouseEnter={(e) => {
                    if (!count) return;
                    setTooltip({ name: feat.properties.name, count, x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    if (!count) return;
                    setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
            {/* City dots */}
            {cityDots.map((city, i) => {
              const [x, y] = lonLatToXY(city.coords[0], city.coords[1], W, H);
              const r = Math.max(3, Math.min(9, 3 + (city.count / maxCityCount) * 6));
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={r}
                  fill="#f59e0b"
                  fillOpacity={0.85}
                  stroke="#fff"
                  strokeWidth={1}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => setTooltip({ name: city.name, count: city.count, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </svg>
        )}
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          <span className="font-semibold">{tooltip.name}</span>
          <span className="text-gray-300 ml-1.5">{tooltip.count} visitor{tooltip.count !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
