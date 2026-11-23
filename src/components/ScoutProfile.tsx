"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TeamProfileData {
  classification: {
    role: string;
    emoji: string;
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

interface PartnerCandidate {
  team_number: string;
  synergy_score: number;
  elo_rating?: number;
  role?: string;
}

interface ScoutProfileResponse {
  profile: TeamProfileData;
  detailed_metrics: TeamRating;
}

interface ScoutProfileProps {
  teamNumber: string;
  onClose?: () => void;
}

export default function ScoutProfile({ teamNumber, onClose }: ScoutProfileProps) {
  const [profile, setProfile] = useState<ScoutProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestedPartners, setSuggestedPartners] = useState<PartnerCandidate[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/scout-profile?number=${teamNumber}`);
        if (!response.ok) {
          throw new Error("Team not found in scouting database");
        }
        const data = await response.json();
        setProfile(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [teamNumber]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        setLoadingPartners(true);
        const response = await fetch(`/api/alliance-builder?team=${teamNumber}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestedPartners(
            data.candidates || data.best_partners || data.suggested_partners || []
          );
        }
      } catch (err) {
        console.error("Failed to fetch partner suggestions:", err);
      } finally {
        setLoadingPartners(false);
      }
    };

    fetchPartners();
  }, [teamNumber]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-bold text-red-900 mb-2">Error Loading Profile</h3>
        <p className="text-red-700">{error || "Profile not found"}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const { profile: teamProfile, detailed_metrics } = profile;
  const metrics = detailed_metrics as TeamRating;

  // Prepare chart data
  const ratingData = [
    {
      name: "Autonomous",
      rating: metrics.auton_rating,
    },
    {
      name: "Driver",
      rating: metrics.driver_rating,
    },
    {
      name: "Endgame",
      rating: metrics.endgame_rating,
    },
  ];

  return (
    <div className="space-y-6 bg-white rounded-lg shadow-lg p-6">
      {/* Header with Role */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Team {teamNumber}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-4xl">{teamProfile.classification.emoji}</span>
              <div>
                <p className="text-lg font-semibold text-blue-600">
                  {teamProfile.classification.role}
                </p>
                <p className="text-sm text-gray-500">
                  Confidence: {(teamProfile.classification.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-gray-800 leading-relaxed">{teamProfile.summary_text}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-medium">ELO Rating</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.elo_rating}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-medium">Win Rate</p>
          <p className="text-2xl font-bold text-green-600">{metrics.win_rate_pct}%</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-medium">Matches Played</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.matches_played}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-medium">Consistency</p>
          <p className="text-2xl font-bold text-purple-600">
            {metrics.consistency_index.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Component Ratings Chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Ratings</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ratingData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 2000]} />
            <Tooltip
              formatter={(value: number | undefined) => Number(value ?? 0).toFixed(0)}
              labelStyle={{ color: "#000" }}
            />
            <Bar dataKey="rating" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Strengths and Weaknesses */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-green-700 mb-3">💪 Strengths</h3>
          <ul className="space-y-2">
            {teamProfile.strengths.map((strength: string, idx: number) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-gray-700 bg-green-50 p-3 rounded"
              >
                <span className="text-green-600 font-bold">✓</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-3">⚠️ Weaknesses</h3>
          <ul className="space-y-2">
            {teamProfile.weaknesses.map((weakness: string, idx: number) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-gray-700 bg-red-50 p-3 rounded"
              >
                <span className="text-red-600 font-bold">!</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommended Partner Roles */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">🤝 Ideal Alliance Partners</h3>
        <div className="flex flex-wrap gap-2">
          {teamProfile.recommended_partner_roles.map((role: string, idx: number) => (
            <span
              key={idx}
              className="bg-purple-100 text-purple-900 px-4 py-2 rounded-full text-sm font-medium"
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Suggested Strategy */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">📋 Strategy Notes</h3>
        <p className="text-yellow-800 leading-relaxed">{teamProfile.suggested_strategy}</p>
      </div>

      {/* Best Partners */}
      {suggestedPartners.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            🏆 Best Alliance Partners
          </h3>
          <div className="space-y-2">
            {suggestedPartners.slice(0, 5).map((partner, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-100"
              >
                <div>
                  <p className="font-semibold text-gray-900">Team {partner.team_number}</p>
                  <p className="text-sm text-gray-600">
                    Synergy: {partner.synergy_score}/100
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    ELO: {partner.elo_rating}
                  </p>
                  <p className="text-xs text-gray-500">{partner.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingPartners && (
        <div className="text-center text-gray-500 text-sm">
          Loading partner suggestions...
        </div>
      )}

      {/* Last Updated */}
      <p className="text-xs text-gray-400 text-center pt-4">
        Last updated: {new Date(metrics.last_updated).toLocaleDateString()}
      </p>
    </div>
  );
}
