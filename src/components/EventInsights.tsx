"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EventSearchItem {
  id: number;
  name: string;
  start: string;
  end: string;
  location: string;
  team_count: number | null;
  status: string;
}

interface EventInsightsProps {
  onEventSelect?: (event: EventSearchItem) => void;
  season?: number;
}

export default function EventInsights({ onEventSelect, season = 204 }: EventInsightsProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventSearchItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setEventsLoading(true);
    fetch(`/api/events-search?season=${season}`, { signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load events");
      setEvents(result.events ?? []);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Failed to load events"); })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    return () => controller.abort();
  }, [season]);

  const searchEvents = useCallback(async () => {
    if (/^\d+$/.test(query.trim())) {
      router.push(`/events/${query.trim()}`);
      return;
    }
    try {
      setEventsLoading(true);
      setError(null);
      const response = await fetch(`/api/events-search?q=${encodeURIComponent(query.trim())}&season=${season}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to search events.");
      }
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search events.");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [query, season, router]);

  function loadEvent(event: EventSearchItem) {
    onEventSelect?.(event);
    router.push(`/events/${event.id}`);
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Event Search</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Search by event name, ID, or location and then inspect event-specific stats.</p>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchEvents()}
            placeholder="Search events"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={searchEvents}
            disabled={eventsLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {eventsLoading ? "Searching" : "Search"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-auto">
          {events.length === 0 ? (
            <p className="p-3 text-sm text-gray-500 dark:text-gray-400">{eventsLoading ? "Loading events…" : query ? "No matching events." : "No upcoming events are published."}</p>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                onClick={() => loadEvent(event)}
                className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{event.name}</p>
                    <p className="mt-1 text-xs font-medium uppercase text-red-600">{event.status}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ID {event.id} · {event.location || "Location unavailable"} · {event.team_count === null ? "Team count pending" : `${event.team_count} teams`}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    Open Dashboard
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

    </div>
  );
}
