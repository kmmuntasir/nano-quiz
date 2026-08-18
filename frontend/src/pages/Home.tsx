import TopBar from '../components/TopBar';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 items-center justify-center p-page">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-card text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your quiz list will appear here
          </p>
        </div>
      </main>
    </div>
  );
}
