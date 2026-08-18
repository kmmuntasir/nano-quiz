function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-page font-sans dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-card shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mb-1 text-center text-2xl font-bold text-brand-700 dark:text-brand-300">
          NanoQuiz
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Sign in to play
        </p>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white opacity-60"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default Login;
