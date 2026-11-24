import React, { useState, useEffect } from 'react';
import { PlaceView, RuleView, StationView, Pollutant, Identity } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Dialog } from '../../components/ui/Dialog';
import { apiClient } from '../../lib/api/client';

interface SavedPlacesViewProps {
  stations: StationView[];
  places: PlaceView[];
  alertRules: RuleView[];
  identity: Identity | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  onRefreshPlacesAndRules: () => void;
  onAuthenticate: (token: string) => Promise<boolean>;
  onSignOut: () => void;
  onSelectStationById: (stationId: string) => void;
}

export const SavedPlacesView: React.FC<SavedPlacesViewProps> = ({
  stations,
  places,
  alertRules,
  identity,
  isAuthenticated,
  isDemoMode,
  onRefreshPlacesAndRules,
  onAuthenticate,
  onSignOut,
  onSelectStationById
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);

  // New Place Form State
  const [newPlaceLabel, setNewPlaceLabel] = useState('');
  const [newPlaceStationId, setNewPlaceStationId] = useState(stations[0]?.id || '');
  const [isSubmittingPlace, setIsSubmittingPlace] = useState(false);

  // New Alert Rule Form State
  const [newRuleStationId, setNewRuleStationId] = useState(stations[0]?.id || '');
  const [newRulePollutant, setNewRulePollutant] = useState<Pollutant>('pm25');
  const [newRuleThreshold, setNewRuleThreshold] = useState('250');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  // Keep selected station ID aligned when stations load asynchronously
  useEffect(() => {
    if (!newPlaceStationId && stations.length > 0) {
      setNewPlaceStationId(stations[0].id);
    }
  }, [stations, newPlaceStationId]);

  useEffect(() => {
    if (!newRuleStationId && stations.length > 0) {
      setNewRuleStationId(stations[0].id);
    }
  }, [stations, newRuleStationId]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setAuthError(null);
    setIsAuthenticating(true);
    const success = await onAuthenticate(tokenInput.trim());
    setIsAuthenticating(false);
    if (!success) {
      setAuthError('Authentication failed. Bearer token is invalid, expired, or rejected by server.');
    } else {
      setTokenInput('');
    }
  };

  const handleCreatePlace = async () => {
    if (!newPlaceLabel.trim()) return;
    const station = stations.find(s => s.id === newPlaceStationId) || stations[0];
    if (!station) return;

    setIsSubmittingPlace(true);
    const res = await apiClient.createSavedPlace({
      label: newPlaceLabel.trim(),
      latitude: station.latitude,
      longitude: station.longitude
    });
    setIsSubmittingPlace(false);

    if (res.ok) {
      setNewPlaceLabel('');
      setIsAddPlaceOpen(false);
      onRefreshPlacesAndRules();
    } else {
      alert(`Failed to save place: ${res.error.message}`);
    }
  };

  const handleDeletePlace = async (id: string) => {
    const res = await apiClient.deleteSavedPlace(id);
    if (res.ok) {
      onRefreshPlacesAndRules();
    } else {
      alert(`Failed to delete place: ${res.error.message}`);
    }
  };

  const handleCreateRule = async () => {
    const station = stations.find(s => s.id === newRuleStationId) || stations[0];
    if (!station) return;

    const trimmed = newRuleThreshold.trim();
    if (trimmed === '') {
      setRuleError('Threshold value is required.');
      return;
    }

    const parsedThreshold = Number(trimmed);
    if (isNaN(parsedThreshold) || !isFinite(parsedThreshold) || parsedThreshold < 0) {
      setRuleError('Threshold must be a valid non-negative number (0 or higher).');
      return;
    }

    setRuleError(null);
    setIsSubmittingRule(true);
    const res = await apiClient.createAlertRule({
      station_id: station.id,
      pollutant: newRulePollutant,
      threshold: parsedThreshold,
      averaging_period_minutes: 60,
      cooldown_minutes: 60,
      enabled: true,
      channel: 'in_app'
    });
    setIsSubmittingRule(false);

    if (res.ok) {
      setIsAddRuleOpen(false);
      setNewRuleThreshold('250');
      setRuleError(null);
      onRefreshPlacesAndRules();
    } else {
      setRuleError(res.error.message);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const res = await apiClient.deleteAlertRule(id);
    if (res.ok) {
      onRefreshPlacesAndRules();
    } else {
      alert(`Failed to delete rule: ${res.error.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Session Authentication Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isAuthenticated ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <h2 className="text-lg font-bold text-slate-900">
                User Account & Bearer Session Management
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Strict per-user database ownership for saved places and alert rules.
            </p>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-800">
                  User: <span className="font-mono text-teal-700">{identity?.user_id.slice(0, 8)}...</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold">Active Session (7-Day Validity)</div>
              </div>
              {!isDemoMode && (
                <Button variant="outline" size="sm" onClick={onSignOut}>
                  Sign Out
                </Button>
              )}
            </div>
          ) : (
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              Session Authentication Required
            </div>
          )}
        </div>

        {/* Authentication Input Form when Signed Out */}
        {!isAuthenticated && !isDemoMode && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 leading-relaxed border border-slate-200">
              <span className="font-bold">Administrator Session Provisioning: </span>
              In accordance with project security contracts, sessions require trusted administrator provisioning. Run{' '}
              <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[11px]">
                python3 scripts/provision_session.py --output session.txt
              </code>{' '}
              on your host, and paste the generated session token below to authenticate.
            </div>

            <form onSubmit={handleSignIn} className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <input
                type="password"
                placeholder="Paste provisioned bearer session token..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                className="flex-1 text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <Button type="submit" variant="primary" size="sm" isLoading={isAuthenticating}>
                Authenticate Session
              </Button>
            </form>

            {authError && (
              <div className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {authError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Places Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900">Saved Monitored Places ({places.length})</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Personal monitored locations persisted with verified coordinates.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddPlaceOpen(true)}
            disabled={!isAuthenticated}
          >
            + Add Pinned Location
          </Button>
        </div>

        {!isAuthenticated ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            Sign in with an active bearer session to view or create saved places.
          </div>
        ) : places.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            No saved places yet. Click '+ Add Pinned Location' to save a residence or office.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {places.map(place => (
              <Card key={place.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600 text-base">📍</span>
                      <CardTitle className="text-sm font-bold text-slate-900">{place.label}</CardTitle>
                    </div>
                    <button
                      onClick={() => handleDeletePlace(place.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      title="Delete place"
                    >
                      ✕
                    </button>
                  </div>
                  <CardDescription className="text-[11px] mt-1 font-mono">
                    Lat: {place.latitude.toFixed(4)}°, Lon: {place.longitude.toFixed(4)}°
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-[10px] text-slate-400">
                    Monitored Location • Direct Telemetry
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Alert Rules Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900">Threshold Alert Rules ({alertRules.length})</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated in-app notifications when a station's hourly observed concentration exceeds your threshold.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddRuleOpen(true)}
            disabled={!isAuthenticated}
          >
            + Create Alert Rule
          </Button>
        </div>

        {!isAuthenticated ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            Sign in with an active bearer session to manage alert rules.
          </div>
        ) : alertRules.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            No alert rules configured. Create one to trigger in-app alerts during severe episodes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alertRules.map(rule => {
              const station = stations.find(s => s.id === rule.station_id);
              return (
                <Card key={rule.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {rule.pollutant.toUpperCase()} &gt; {rule.threshold} µg/m³
                        </span>
                        <CardTitle className="text-sm font-bold text-slate-900 mt-2">
                          {station ? station.name : rule.station_id}
                        </CardTitle>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        title="Delete rule"
                      >
                        ✕
                      </button>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Averaging: {rule.averaging_period_minutes}m • Cooldown: {rule.cooldown_minutes}m
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 mt-2 pt-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {rule.enabled ? 'Active In-App Monitor' : 'Disabled'}
                    </span>
                    {station && (
                      <button
                        onClick={() => onSelectStationById(station.id)}
                        className="text-teal-600 hover:underline font-medium text-[11px]"
                      >
                        View Station →
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Saved Place */}
      <Dialog
        isOpen={isAddPlaceOpen}
        onClose={() => setIsAddPlaceOpen(false)}
        title="Add Pinned Monitored Location"
        description="Persist a location label and geographic coordinates to your account"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddPlaceOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreatePlace} isLoading={isSubmittingPlace}>
              Save Location
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Place Name / Label</label>
            <input
              type="text"
              value={newPlaceLabel}
              onChange={e => setNewPlaceLabel(e.target.value)}
              placeholder="e.g. My Residence, North Campus"
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <Select
            label="Associate Geographic Coordinates via Station"
            options={stations.map(s => ({ value: s.id, label: s.name }))}
            value={newPlaceStationId || stations[0]?.id || ''}
            onChange={e => setNewPlaceStationId(e.target.value)}
          />
        </div>
      </Dialog>

      {/* Modal: Add Alert Rule */}
      <Dialog
        isOpen={isAddRuleOpen}
        onClose={() => setIsAddRuleOpen(false)}
        title="Configure Observed Concentration Alert Rule"
        description="Trigger in-app notification when hourly observation strictly exceeds threshold"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddRuleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateRule} isLoading={isSubmittingRule}>
              Save Alert Rule
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {ruleError && (
            <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 text-red-800 text-xs font-medium">
              {ruleError}
            </div>
          )}

          <Select
            label="Monitoring Station"
            options={stations.map(s => ({ value: s.id, label: s.name }))}
            value={newRuleStationId || stations[0]?.id || ''}
            onChange={e => setNewRuleStationId(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Pollutant"
              options={[
                { value: 'pm25', label: 'PM2.5' },
                { value: 'pm10', label: 'PM10' },
                { value: 'no2', label: 'NO2' }
              ]}
              value={newRulePollutant}
              onChange={e => setNewRulePollutant(e.target.value as any)}
            />

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Threshold (µg/m³)</label>
              <input
                type="number"
                value={newRuleThreshold}
                onChange={e => setNewRuleThreshold(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
            <strong>Validated Implementation Scope: </strong>
            Backend accepts only <code className="font-mono">in_app</code> channel with 60-minute observation averaging. Email and forecast alerts remain unavailable per capability contracts.
          </div>
        </div>
      </Dialog>
    </div>
  );
};
