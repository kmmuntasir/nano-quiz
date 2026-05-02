export default function CompletionScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-primary mb-4">Quiz Complete!</h1>
                <p className="text-secondary mb-6">Your score: --/10</p>
                <a
                    href="/leaderboard"
                    className="px-6 py-3 bg-primary text-white rounded-lg inline-block"
                >
                    View Leaderboard
                </a>
            </div>
        </div>
    )
}
