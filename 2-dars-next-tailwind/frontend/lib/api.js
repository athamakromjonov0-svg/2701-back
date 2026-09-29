import axios from 'axios'

// Next.js rewrite: /api/* -> http://localhost:5432/*
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ======================================
// LOCALSTORAGE KALITLARI
// ======================================

export const TOKEN_KEY = 'auth_token' // accessToken (JWT, 1 soat)
export const REFRESH_KEY = 'auth_refresh_token' // refreshToken (7 kun)
export const USER_KEY = 'auth_user' // login qilgan user — TO'LIQ ma'lumot
export const USERS_KEY = 'auth_users' // barcha userlar ro'yxati (cache)

// ======================================
// LOCALSTORAGE HELPERLAR
// ======================================

// Tokenlarni yozish (login qilganda / refresh bo'lganda)
export const saveTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

// User ma'lumotini TO'LIQ yozish
export const saveUser = (user) => {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// Saqlangan userni o'qish (sahifa ochilganda darhol ko'rsatish uchun)
export const getSavedUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Userlar ro'yxatini cache'ga yozish
export const saveUsers = (users) => {
  if (Array.isArray(users)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }
}

// Cache'dagi userlar ro'yxatini o'qish
export const getSavedUsers = () => {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const list = raw ? JSON.parse(raw) : null
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// FAQAT logout yoki server token bekor deb aniq qaytarganda chaqiriladi
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(USERS_KEY)
}

// JWT payload'ni xavfsiz o'qish (UI'da amal qilish muddatini ko'rsatish uchun)
export const getTokenInfo = (token) => {
  if (!token || typeof window === 'undefined') return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return {
      exp: payload.exp || null, // Unix sekund
      username: payload.username || null,
      role: payload.role || null, // token ichidagi rol (admin/user)
    }
  } catch {
    return null
  }
}

// ======================================
// AXIOS INTERCEPTORLAR
// ======================================

// Har bir so'rovga saqlangan JWT accessToken'ni avtomatik qo'shish
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// 401 (token muddati tugagan) bo'lsa — refreshToken bilan yangilab, so'rovni qayta yuborish
let refreshingPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // Tarmoq xatosi (server javob bermadi) — bu AUTH xato EMAS,
    // tokenlar localStorage'da QOLADI, faqat xatoni qaytaramiz
    if (!error.response) {
      return Promise.reject(error)
    }

    // /refresh o'zi 401 berayotgan bo'lsa yoki 401 bo'lmasa — qaytarmaymiz
    if (original?.url === '/refresh' || error.response.status !== 401) {
      return Promise.reject(error)
    }

    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null

    if (!refreshToken) {
      return Promise.reject(error)
    }

    // Bir vaqtda bir nechta so'rov 401 olganda — refresh faqat 1 marta ketadi
    if (!refreshingPromise) {
      refreshingPromise = axios
        .post('/api/refresh', { refreshToken })
        .then(({ data }) => {
          if (data.accessToken) {
            localStorage.setItem(TOKEN_KEY, data.accessToken)
          }
          return data.accessToken
        })
        .finally(() => {
          refreshingPromise = null
        })
    }

    try {
      const newToken = await refreshingPromise
      if (!newToken) return Promise.reject(error)
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch (refreshErr) {
      // VAQTINCHALIK tarmoq xatosida localStorage QOLADI.
      // Faqat server refresh tokenni ANIQ rad qilsa (401/403) tozalanadi.
      const status = refreshErr?.response?.status
      if (status === 401 || status === 403) {
        clearAuth()
      }
      return Promise.reject(error)
    }
  }
)

// ======================================
// API SO'ROVLARI
// ======================================

// POST /login -> { message, accessToken, refreshToken }
export const loginUser = (data) => api.post('/login', data)

// POST /register -> { message, user }
export const registerUser = (data) => api.post('/register', data)

// POST /refresh -> { message, accessToken }
export const refreshAccessToken = (refreshToken) =>
  axios.post('/api/refresh', { refreshToken })

// POST /logout -> refreshToken serverda bekor qilinadi
export const logoutUser = (refreshToken) =>
  api.post('/logout', { refreshToken })

// GET /me -> user object (Bearer token kerak)
export const getMe = () => api.get('/me')

// GET /users -> barcha userlar ro'yxati (massiv) — FAQAT admin uchun
export const getUsers = () => api.get('/users')

// PATCH /users/:id/role -> { message, user } — FAQAT admin uchun
export const updateUserRole = (id, role) =>
  api.patch(`/users/${id}/role`, { role })

// GET /users/:id -> user object — FAQAT admin uchun
export const getUserById = (id) => api.get(`/users/${id}`)

// POST /users -> { message, user } — admin yangi user yaratadi
export const createUser = (data) => api.post('/users', data)

// PUT /users/:id -> { message, user } — admin userni tahrirlaydi
export const updateUser = (id, data) => api.put(`/users/${id}`, data)

// DELETE /users/:id -> { message } — admin userni o'chiradi
export const deleteUser = (id) => api.delete(`/users/${id}`)

export default api
