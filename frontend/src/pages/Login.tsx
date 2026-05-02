export default function Login() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-primary mb-4">NanoQuiz</h1>
                <p className="text-secondary mb-8">Sign in to start the quiz</p>
                <button className="px-6 py-3 bg-primary text-white rounded-lg">
                    Sign in with Google
                </button>
            </div>
        </div>
    )
}
