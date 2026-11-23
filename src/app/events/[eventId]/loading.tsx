export default function EventLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-red-600 dark:border-gray-700 dark:border-t-red-400" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Loading Event</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          We are fetching divisions and event data. Large events may take a few seconds.
        </p>
      </div>
    </main>
  );
}
