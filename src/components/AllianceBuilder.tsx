"use client";

import React, { useEffect, useMemo, useState } from "react";

interface Candidate {
  team_number: string;
  synergy_score: number;
  rationale?: string;
  elo_rating?: number;
}

interface PartnerResponse {
  success: boolean;
  mode?: "second_partner" | "third_partner";
  team_number?: string;
  candidates?: Candidate[];
  best_partners?: Candidate[];
  suggested_partners?: Candidate[];
}

interface TeamProfileData {
  classification: {
    role: string;
    role_emoji?: string;
    confidence: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommended_partner_roles: string[];
  summary_text: string;
  suggested_strategy: string;
}

interface TeamRating {
  elo_rating: number;
  auton_rating: number;
  driver_rating: number;
  endgame_rating: number;
  consistency_index: number;
  matches_played: number;
  total_wins: number;
  win_rate_pct: string;
  last_updated: string;
}

interface ScoutProfileResponse {
  success: boolean;
  team_number: string;
  profile: TeamProfileData;
  detailed_metrics: TeamRating;
}

interface AllianceBuilderProps {
  initialTeamNumber?: string;
  eventId?: number;
  onTeamNumberChange?: (teamNumber: string) => void;
}

export default function AllianceBuilder({
  initialTeamNumber = "",
  eventId,
  onTeamNumberChange,
}: AllianceBuilderProps) {
  const MAX_RECOMMENDATIONS = 3;

  const [myTeam, setMyTeam] = useState(initialTeamNumber.toUpperCase());
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PartnerResponse | null>(null);
  const [profilesByTeam, setProfilesByTeam] = useState<Record<string, ScoutProfileResponse | null>>({});

  useEffect(() => {
    setMyTeam(initialTeamNumber.toUpperCase());
  }, [initialTeamNumber]);

  const candidates = useMemo(() => {
    if (!result) return [];
    return (result.candidates || result.best_partners || result.suggested_partners || []).slice(0, MAX_RECOMMENDATIONS);
  }, [result]);

  async function fetchCandidateProfiles(candidateList: Candidate[]) {
    if (candidateList.length === 0) {
      setProfilesByTeam({});
      return;
    }

    setLoadingProfiles(true);
    try {
      const profileEntries = await Promise.all(
        candidateList.map(async (candidate) => {
          try {
            const response = await fetch(`/api/scout-profile?number=${candidate.team_number}`);
            if (!response.ok) {
              return [candidate.team_number, null] as const;
            }
            const data = (await response.json()) as ScoutProfileResponse;
            return [candidate.team_number, data] as const;
          } catch {
            return [candidate.team_number, null] as const;
          }
        })
      );

      setProfilesByTeam(Object.fromEntries(profileEntries));
    } finally {
      setLoadingProfiles(false);
    }
  }

  async function handleSearch() {
    const team = myTeam.trim().toUpperCase();

    if (!team) {
      setError("Enter your team number.");
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(team)) {
      setError("Team number must be alphanumeric.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setProfilesByTeam({});

      const params = new URLSearchParams({ team });
      if (eventId) {
        params.set("event_id", String(eventId));
      }
      const response = await fetch(`/api/alliance-builder?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load partner suggestions.");
      }

      const parsed = data as PartnerResponse;
      setResult(parsed);

      const rankedCandidates =
        (parsed.candidates || parsed.best_partners || parsed.suggested_partners || []).slice(0, MAX_RECOMMENDATIONS);
      await fetchCandidateProfiles(rankedCandidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load partner suggestions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Alliance Scout</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Enter your team to find the best alliance teammate fits ranked by synergy, with full scouting reports for each candidate.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Your Team</label>
            <input
              type="text"
              value={myTeam}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setMyTeam(value);
                onTeamNumberChange?.(value);
              }}
              placeholder="1234A"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Searching" : "Find Best Teammates"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Alliance Teammate Fits</h3>

        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {loading
              ? "Calculating synergy suggestions..."
              : "No suggestions yet. Search above to generate teammate recommendations."}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {candidates.map((candidate, idx) => {
              const scout = profilesByTeam[candidate.team_number];
              const metrics = scout?.detailed_metrics;
              const profile = scout?.profile;

              return (
                <article
                  key={`${candidate.team_number}-${idx}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40 text-xs font-bold text-red-700 dark:text-red-300">
                            {idx + 1}
                          </span>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">Team {candidate.team_number}</p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {candidate.rationale || "Strong complementary profile for alliance consistency."}
                        </p>
                      </div>
                      <div className="text-right min-w-20">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Synergy</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{candidate.synergy_score}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-900/30 space-y-4">
                    {loadingProfiles && !profile && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Loading scouting report...</p>
                    )}

                    {!loadingProfiles && !profile && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Scouting report unavailable for this candidate.</p>
                    )}

                    {profile && metrics && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{profile.classification.role_emoji ?? "🤖"}</span>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.classification.role}</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Confidence {(profile.classification.confidence * 100).toFixed(0)}%
                          </p>
                        </div>

                        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{profile.summary_text}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="rounded bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">ELO</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{metrics.elo_rating}</p>
                          </div>
                          <div className="rounded bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">Win Rate</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {metrics.win_rate_pct === "N/A" ? "N/A" : `${metrics.win_rate_pct}%`}
                            </p>
                          </div>
                          <div className="rounded bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">Matches</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{metrics.matches_played}</p>
                          </div>
                          <div className="rounded bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">Consistency</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{metrics.consistency_index.toFixed(0)}</p>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Strengths</p>
                            <ul className="mt-1 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                              {profile.strengths.map((strength) => (
                                <li key={strength}>• {strength}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Weaknesses</p>
                            <ul className="mt-1 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                              {profile.weaknesses.map((weakness) => (
                                <li key={weakness}>• {weakness}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">Recommended Partner Roles</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {profile.recommended_partner_roles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3">
                          <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 mb-1">Strategy Notes</p>
                          <p className="text-sm text-yellow-800 dark:text-yellow-100 whitespace-pre-line">{profile.suggested_strategy}</p>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
