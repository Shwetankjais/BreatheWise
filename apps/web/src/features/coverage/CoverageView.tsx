import React from 'react';
import { City, Capabilities } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface CoverageViewProps {
  selectedCity: City;
  capabilities: Capabilities | null;
}

export const CoverageView: React.FC<CoverageViewProps> = ({ selectedCity, capabilities }) => {
  const isSupported = capabilities?.population_coverage?.supported ?? false;
  const missing = capabilities?.population_coverage?.requirements_missing || [
    'complete population raster and extraction provenance',
    'audited municipal boundary geometry'
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">
                Geospatial Monitoring Extent & Population Reference
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Geographic proximity assessment around continuous ambient air quality stations for {selectedCity.name}.
            </p>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Raster Coverage: {isSupported ? 'Audited' : 'Unavailable (Gated)'}
          </div>
        </div>
      </div>

      {/* Honest Coverage Gating Banner */}
      <Card className="border-amber-300 bg-amber-50/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 font-bold text-sm">
              409
            </div>
            <div>
              <CardTitle className="text-base font-bold text-amber-950">
                COVERAGE_UNAVAILABLE — Population Raster Extent Unaudited
              </CardTitle>
              <CardDescription className="text-amber-900 mt-0.5">
                Zonal population counts and settlement epoch extraction are not verified.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-xs text-amber-950">
          <p className="leading-relaxed">
            In accordance with project scientific guidelines, BreatheWise does not present synthetic population headcounts or unverified raster extraction percentages. The dataset report cites national census and GHSL references, but full-extent raster files and extraction scripts have not been established locally.
          </p>

          <div className="bg-white p-3 rounded-lg border border-amber-200">
            <div className="font-bold text-slate-900 mb-1.5 uppercase text-[11px] tracking-wider">
              Prerequisites Missing from Data Setup:
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              {missing.map((req, idx) => (
                <li key={idx} className="font-medium">
                  {req}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-amber-100/60 rounded-lg text-[11px] leading-relaxed text-amber-950">
            <strong>Geographic Reference vs Exposure Boundary:</strong> Radial circles displayed on the map (e.g. 5 km buffer around CAAQMS sites) represent geographic distance to a physical sensor enclosure. They are <em>not</em> validated pollution contours, uniform dispersion boundaries, or safe-air envelopes.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
