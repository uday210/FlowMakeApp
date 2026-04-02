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

// Equirectangular projection
function lonLatToXY(lon: number, lat: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

function projectRing(ring: number[][], w: number, h: number): string {
  return ring.map(([lon, lat], i) => {
    const [x, y] = lonLatToXY(lon, lat, w, h);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + "Z";
}

interface GeoFeature {
  id: string;
  properties: { name: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

interface Props {
  countries: { value: string; count: number }[];
}

export default function WorldMap({ countries }: Props) {
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
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-400">Low</span>
          {["#ddd6fe","#a78bfa","#7c3aed","#5b21b6"].map(c => (
            <div key={c} className="w-5 h-2.5 rounded-sm" style={{ background: c }} />
          ))}
          <span className="text-[9px] text-gray-400">High</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-[#f0f4ff]">
        {features.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-xs text-gray-400">Loading map…</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
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
