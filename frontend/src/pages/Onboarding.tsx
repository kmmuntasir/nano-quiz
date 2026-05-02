export default function Onboarding() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-primary mb-4">Welcome!</h1>
                <p className="text-secondary mb-6">Enter your Employee ID to continue</p>
                <form className="flex flex-col items-center gap-4">
                    <input
                        type="text"
                        placeholder="Employee ID"
                        className="px-4 py-2 border rounded-lg"
                    />
                    <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    )
}
