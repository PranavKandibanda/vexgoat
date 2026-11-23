import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DivisionSelector from "@/components/DivisionSelector";
import { fetchEventDivisions } from "@/lib/robotEvents";
import { fetchRobotEventsJson, VexApiError } from "@/lib/robotEventsClient";

interface EventDetail { id: number; name?: string; divisions?: { id: number; name: string }[] }

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const eventId = Number(rawId);
  let event: EventDetail;
  let divisions: Awaited<ReturnType<typeof fetchEventDivisions>>;
  try {
    const response = await fetchRobotEventsJson<{ data?: EventDetail } & EventDetail>(`/events/${eventId}`);
    event = response.data ?? response;
    divisions = await fetchEventDivisions(eventId);
  } catch (error) {
    if (error instanceof VexApiError && error.status === 404) notFound();
    console.error("Event page failed:", error);
    return <ErrorDisplay message="Event data is temporarily unavailable." />;
  }
  if (divisions.length === 0) redirect(`/events/${eventId}/division/all`);
  if (divisions.length === 1) redirect(`/events/${eventId}/division/${divisions[0].id}`);
  return <DivisionSelector eventId={eventId} eventName={event.name ?? `Event ${eventId}`} initialDivisions={divisions} />;
}

function ErrorDisplay({ message }: { message: string }) {
  return <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
    <div className="max-w-lg bg-white dark:bg-gray-800 p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event unavailable</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message}</p>
      <Link href="/" className="mt-6 inline-block text-red-600 underline">Back to VEXGOAT</Link>
    </div>
  </main>;
}
