import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
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
            window.location.href = '/'
            return Promise.reject(error)
        }

        if (error.response?.status === 403) {
            const message = error.response.data?.error || 'Access denied'
            return Promise.reject(new Error(message))
        }

        const message =
            error.response?.data?.error ||
            error.message ||
            'Something went wrong. Please try again.'
        return Promise.reject(new Error(message))
    }
)

export default api
