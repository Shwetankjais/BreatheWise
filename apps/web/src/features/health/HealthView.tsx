import React from 'react';
import { Advisory, Pollutant } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface HealthViewProps {
  advisories: Advisory[];
  advisoryError: string | null;
  advisoryLoading: boolean;
  onRetryAdvisory: () => void;
  selectedPollutant: Pollutant;
  onSelectPollutant: (pollutant: Pollutant) => void;
}

interface WHOStandard {
  pollutant: Pollutant;
  name: string;
  averagingPeriod: string;
  who2021Guideline: string;
  interimTarget1: string;
  healthRelevance: string;
}

const WHO_2021_STANDARDS: WHOStandard[] = [
  {
    pollutant: 'pm25',
    name: 'PM2.5 (Fine particulate matter ≤ 2.5 µm)',
    averagingPeriod: '24-Hour mean (Annual: 5 µg/m³)',
    who2021Guideline: '15 µg/m³',
    interimTarget1: '75 µg/m³',
    healthRelevance: 'Penetrates deep into alveolar lung tissue and enters systemic circulation; associated with cardiovascular and respiratory morbidity.'
  },
  {
    pollutant: 'pm10',
    name: 'PM10 (Inhalable particulate matter ≤ 10 µm)',
    averagingPeriod: '24-Hour mean (Annual: 15 µg/m³)',
    who2021Guideline: '45 µg/m³',
    interimTarget1: '150 µg/m³',
    healthRelevance: 'Deposits in upper thoracic airways; contributes to airway inflammation, asthma exacerbation, and chronic obstructive pulmonary diseases.'
  },
  {
    pollutant: 'no2',
    name: 'Nitrogen Dioxide (NO₂)',
    averagingPeriod: '24-Hour mean (1-Hour: 200 µg/m³; Annual: 10 µg/m³)',
    who2021Guideline: '25 µg/m³',
    interimTarget1: '120 µg/m³',
    healthRelevance: 'Combustion tracer; induces bronchial hyperresponsiveness, increases susceptibility to respiratory infections, and serves as a photochemical ozone precursor.'
  },
  {
    pollutant: 'so2',
    name: 'Sulfur Dioxide (SO₂)',
    averagingPeriod: '24-Hour mean (10-Minute: 500 µg/m³)',
    who2021Guideline: '40 µg/m³',
    interimTarget1: '125 µg/m³',
    healthRelevance: 'Industrial and coal emissions; potent bronchoconstrictor causing acute irritation, cough, and bronchospasm within minutes in asthmatic individuals.'
  },
  {
    pollutant: 'o3',
    name: 'Ground-Level Ozone (O₃)',
    averagingPeriod: '8-Hour daily maximum (Peak season: 60 µg/m³)',
    who2021Guideline: '100 µg/m³',
    interimTarget1: '160 µg/m³',
    healthRelevance: 'Secondary photochemical oxidant formed from NOx and VOC precursors under sunlight; induces lung inflammation, decreases vital capacity, and increases hospital admissions.'
  },
  {
    pollutant: 'co',
    name: 'Carbon Monoxide (CO)',
    averagingPeriod: '24-Hour mean (8-Hour: 10 mg/m³; 1-Hour: 35 mg/m³)',
    who2021Guideline: '4 mg/m³ (4,000 µg/m³)',
    interimTarget1: '7 mg/m³',
    healthRelevance: 'Forms carboxyhemoglobin (COHb), reducing oxygen-carrying capacity of blood; hazardous for individuals with ischemic heart disease and developing fetuses.'
  }
];

export const HealthView: React.FC<HealthViewProps> = ({
  advisories,
  advisoryError,
  advisoryLoading,
  onRetryAdvisory,
  selectedPollutant,
  onSelectPollutant
}) => {
  const currentAdvisory = advisories.find(a => a.pollutant === selectedPollutant);
  const activeStandard = WHO_2021_STANDARDS.find(s => s.pollutant === selectedPollutant);

  return (
    <div className="space-y-6">
      {/* Top Advisory Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#E5DFD3] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FBF4E8] text-[#8C5D14] border border-[#E8D4B0] mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C88A2E]" />
              <span>WHO 2021 Global Air Quality Guidelines Reference</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#1C1E24]">
              Criteria Pollutants Health & Environmental Education
            </h2>
            <p className="text-xs sm:text-sm text-[#555C68] mt-1 max-w-2xl leading-relaxed">
              Educational context from the World Health Organization’s 2021 Global Air Quality Guidelines and the cited advisory record below.
            </p>
          </div>

          {/* Pollutant Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-[#F5F1EA] p-1.5 rounded-xl border border-[#E5DFD3] overflow-x-auto">
            {(['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'] as Pollutant[]).map(p => (
              <button
                key={p}
                onClick={() => onSelectPollutant(p)}
                className={`min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  selectedPollutant === p
                    ? 'bg-white text-[#1C1E24] shadow-xs border border-[#D8CFBC]'
                    : 'text-[#555C68] hover:text-[#1C1E24] hover:bg-white/50'
                }`}
              >
                {p === 'pm25' ? 'PM2.5' : p === 'pm10' ? 'PM10' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Clinical Disclaimer Box */}
        <div className="mt-5 p-4 bg-[#FBF4E8] rounded-xl border border-[#E8D4B0] text-xs text-[#78350F] flex items-start gap-3 leading-relaxed">
          <svg className="w-5 h-5 text-[#C88A2E] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong className="font-bold text-[#8C5D14]">Medical & Non-Clinical Disclaimer: </strong>
            This content is provided strictly for population-level environmental education. It does not provide medical diagnoses, individual health-risk scores, clinical triage, or a prescription of a guaranteed "safe activity window." WHO benchmarks are statistical public-health recommendations. Consult licensed medical professionals for diagnosis and treatment plans.
          </div>
        </div>
      </div>

      {/* Criteria Pollutant Standards Card */}
      {activeStandard && (
        <Card className="border-[#E5DFD3]">
          <CardHeader className="bg-[#FAF8F5] border-b border-[#E5DFD3]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0D9488] uppercase bg-[#F0FDFA] px-2.5 py-1 rounded border border-[#99F6E4]">
                Criteria Benchmark: {activeStandard.name}
              </span>
              <span className="text-xs text-[#7D8592] font-mono">
                Averaging Window: {activeStandard.averagingPeriod}
              </span>
            </div>
            <CardTitle className="text-base font-bold text-[#1C1E24] mt-2">
              WHO 2021 Air Quality Guideline Level: <span className="text-[#0D9488]">{activeStandard.who2021Guideline}</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#555C68]">
              Interim Target-1 (IT-1): {activeStandard.interimTarget1} · Interim targets guide staged pollution mitigation towards the final guideline.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 text-xs text-[#2D3139] space-y-3 leading-relaxed">
            <div>
              <strong className="text-[#1C1E24]">Biological & Physiological Relevance: </strong>
              <span>{activeStandard.healthRelevance}</span>
            </div>
            <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E5DFD3] text-[#555C68]">
              <strong className="text-[#1C1E24]">Why Averaging Periods Matter: </strong>
              Air pollution toxicology demonstrates that damage depends on the integration of exposure duration and concentration. A short-term 1-hour peak concentration cannot be directly compared to a 24-hour daily or annual average benchmark.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advisory Content Card (from Live API) */}
      {currentAdvisory ? (
        <Card className="border-[#E5DFD3]">
          <CardHeader className="pb-3 bg-[#FAF8F5] border-b border-[#E5DFD3]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0D9488] uppercase bg-[#F0FDFA] px-2.5 py-0.5 rounded border border-[#99F6E4]">
                Pollutant: {currentAdvisory.pollutant.toUpperCase()}
              </span>
              <span className="text-xs text-[#7D8592] font-mono">
                Version: {currentAdvisory.content_version}
              </span>
            </div>
            <CardTitle className="text-base font-bold text-[#1C1E24] mt-2">
              {currentAdvisory.title}
            </CardTitle>
            <CardDescription className="text-xs text-[#555C68]">
              Source:{' '}
              <a
                href={currentAdvisory.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0D9488] underline hover:text-[#0F766E]"
              >
                {currentAdvisory.source_title}
              </a>{' '}
              • Scope: {currentAdvisory.scope}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4 text-xs text-[#2D3139]">
            <div className="p-3.5 bg-[#FAF8F5] rounded-lg border border-[#E5DFD3] text-[#2D3139] leading-relaxed">
              <div className="font-bold text-[#1C1E24] mb-1">Educational Summary</div>
              <p>{currentAdvisory.summary}</p>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] rounded-lg border border-[#E5DFD3] text-[#2D3139] leading-relaxed">
              <div className="font-bold text-[#1C1E24] mb-1">Content Review & Scientific Scope</div>
              <p className="font-mono text-[#555C68]">{currentAdvisory.review_scope}</p>
              <div className="text-[11px] text-[#7D8592] mt-1">Reviewed At: {currentAdvisory.reviewed_at}</div>
            </div>

            {currentAdvisory.limitations && currentAdvisory.limitations.length > 0 && (
              <div className="p-3.5 bg-[#FBF4E8] rounded-lg border border-[#E8D4B0] text-[#78350F]">
                <div className="font-bold mb-1.5 uppercase text-[11px] tracking-wider text-[#8C5D14]">
                  Documented Content Limitations:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[#555C68]">
                  {currentAdvisory.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div role={advisoryError ? 'alert' : 'status'} className="p-8 text-center text-[#555C68] text-sm bg-white rounded-xl border border-[#E5DFD3]">
          <p>{advisoryLoading ? `Loading ${selectedPollutant.toUpperCase()} educational advisory…` : `The ${selectedPollutant.toUpperCase()} advisory is unavailable. ${advisoryError || ''}`}</p>
          {!advisoryLoading && <button type="button" onClick={onRetryAdvisory} className="mt-3 rounded-full border border-[#8b47aa] px-4 py-2 font-bold text-[#78439b] hover:bg-[#f6eafa]">Retry advisory</button>}
        </div>
      )}

      {/* Full 6-Pollutants Reference Table */}
      <Card className="border-[#E5DFD3]">
        <CardHeader className="bg-[#FAF8F5] border-b border-[#E5DFD3]">
          <CardTitle className="text-sm font-bold text-[#1C1E24]">
            WHO 2021 Global Air Quality Guidelines Reference Summary (All 6 Criteria Pollutants)
          </CardTitle>
          <CardDescription className="text-xs text-[#555C68]">
            Comparison matrix of health-based guidelines across criteria air contaminants.{' '}
            <a href="https://www.who.int/publications/i/item/9789240034228" target="_blank" rel="noopener noreferrer" className="underline text-[#78439b]">Read the WHO source</a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5F1EA] text-[#1C1E24] border-b border-[#E5DFD3]">
                <th className="p-3 font-bold">Criteria Pollutant</th>
                <th className="p-3 font-bold">Averaging Period</th>
                <th className="p-3 font-bold">WHO 2021 Guideline</th>
                <th className="p-3 font-bold">Interim Target-1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE1] text-[#2D3139]">
              {WHO_2021_STANDARDS.map(std => (
                <tr
                  key={std.pollutant}
                  onClick={() => onSelectPollutant(std.pollutant)}
                  className={`hover:bg-[#FAF8F5] cursor-pointer transition-colors ${
                    selectedPollutant === std.pollutant ? 'bg-[#F0FDFA]' : ''
                  }`}
                >
                  <td className="p-3 font-semibold text-[#1C1E24]">
                    {std.name}
                    {selectedPollutant === std.pollutant && (
                      <span className="ml-2 text-[10px] text-[#0D9488] font-bold">● Active</span>
                    )}
                  </td>
                  <td className="p-3 text-[#555C68]">{std.averagingPeriod}</td>
                  <td className="p-3 font-bold text-[#0D9488]">{std.who2021Guideline}</td>
                  <td className="p-3 text-[#C88A2E] font-medium">{std.interimTarget1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
