import { notFound } from "next/navigation";
import EventDashboard from "@/components/EventDashboard";

interface DivisionDashboardPageProps {
  params: Promise<{ eventId: string; divisionId: string }>;
}

export default async function DivisionDashboardPage({ params }: DivisionDashboardPageProps) {
  const { eventId: eventIdStr, divisionId } = await params;
  if (!/^\d+$/.test(eventIdStr) || (divisionId !== "all" && !/^\d+$/.test(divisionId))) notFound();
  const eventId = Number(eventIdStr);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EventDashboard eventId={eventId} divisionId={divisionId === "all" ? undefined : divisionId} />
      </div>
    </main>
  );
}
