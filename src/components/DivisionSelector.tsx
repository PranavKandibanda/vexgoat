"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

interface Division {
  id: string;
  name: string;
  code?: string;
}

interface DivisionSelectorProps {
  eventId: number;
  eventName: string;
  initialDivisions?: Division[];
}

export default function DivisionSelector({ eventId, eventName, initialDivisions }: DivisionSelectorProps) {
  const [divisions, setDivisions] = useState<Division[]>(initialDivisions ?? []);
  const [loading, setLoading] = useState(!initialDivisions);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (initialDivisions) {
      setDivisions(initialDivisions);
      setLoading(false);
      return;
    }

    const fetchDivisions = async () => {
      try {
        const res = await fetch(`/api/event-divisions?event_id=${eventId}`);
        if (!res.ok) throw new Error("Failed to fetch divisions");
        const data = await res.json();
        setDivisions(data.divisions || []);

        // If only one division, auto-navigate
        if (data.divisions?.length === 1) {
          router.push(`/events/${eventId}/division/${data.divisions[0].id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading divisions");
      } finally {
        setLoading(false);
      }
    };

    fetchDivisions();
  }, [eventId, router, initialDivisions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-300 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading divisions...</p>
        </div>
      </main>
    );
  }

  if (error || divisions.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-lg rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {error ? "Error loading divisions" : "No divisions found"}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {error || "This event may not expose division data from the API. You can still open the full event dashboard."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => router.push(`/events/${eventId}/division/all`)}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open Full Dashboard
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{eventName}</h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Select a division</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {/* Division Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {divisions.map((div) => (
            <button
              key={div.id}
              onClick={() => router.push(`/events/${eventId}/division/${div.id}`)}
              className="group rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-left shadow-sm transition-all hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {div.name}
                  </h2>
                  {div.code && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{div.code}</p>
                  )}
                </div>
                <div className="text-2xl text-gray-400 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  →
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
