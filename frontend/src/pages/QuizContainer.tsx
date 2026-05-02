export default function QuizContainer() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-primary mb-4">Ready?</h1>
                <p className="text-secondary mb-6">You are about to start the quiz</p>
                <button className="px-6 py-3 bg-primary text-white rounded-lg">
                    Start Quiz
                </button>
            </div>
        </div>
    )
}
