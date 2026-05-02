import axios from 'axios'

export class EventConcludedError extends Error {
    constructor(message = 'This quiz event has ended.') {
        super(message)
        this.name = 'EventConcludedError'
    }
}

export class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            window.location.href = '/'
            return Promise.reject(new ApiError('Session expired. Please log in again.', 401))
        }

        if (error.response?.status === 403) {
            const message = error.response.data?.error || 'Access denied'
            const lowerMessage = message.toLowerCase()
            if (
                lowerMessage.includes('event') &&
                (lowerMessage.includes('concluded') || lowerMessage.includes('ended') || lowerMessage.includes('expired'))
            ) {
                return Promise.reject(new EventConcludedError(message))
            }
            return Promise.reject(new ApiError(message, 403))
        }

        const isNetworkError = !error.response && error.message === 'Network Error'
        const message = isNetworkError
            ? 'Unable to connect. Please check your internet connection.'
            : error.response?.data?.error ||
              error.message ||
              'Something went wrong. Please try again.'

        return Promise.reject(new ApiError(message, error.response?.status ?? 0))
    },
)

export default api
