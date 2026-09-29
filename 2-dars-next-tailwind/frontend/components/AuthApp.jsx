'use client'

import { useEffect, useState } from 'react'
import {
  loginUser,
  registerUser,
  getMe,
  getUsers,
  updateUserRole,
  refreshAccessToken,
  logoutUser,
  TOKEN_KEY,
  REFRESH_KEY,
  USER_KEY,
  saveTokens,
  saveUser,
  getSavedUser,
  saveUsers,
  getSavedUsers,
  getTokenInfo,
  clearAuth,
  createUser,
  updateUser,
  deleteUser,
} from '../lib/api'

const initialRegister = {
  username: '',
  fullName: '',
  firstName: '',
  lastName: '',
  middleName: '',
  birthDate: '',
  gender: '',
  country: '',
  region: '',
  district: '',
  address: '',
  phone: '',
  email: '',
  age: '',
  passport: { series: '', number: '', issuedBy: '', issuedDate: '' },
  password: '',
}

// Admin panel: yangi user yaratish formasi uchun boshlang'ich holat
const initialAdminUser = {
  username: '',
  fullName: '',
  firstName: '',
  lastName: '',
  middleName: '',
  birthDate: '',
  gender: '',
  country: '',
  region: '',
  district: '',
  address: '',
  phone: '',
  email: '',
  age: '',
  passport: { series: '', number: '', issuedBy: '', issuedDate: '' },
  password: '',
}

// Qator boshidagi avatar uchun ranglar (ism harfine qarab)
const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-rose-500 to-red-600',
  'from-orange-500 to-amber-600',
  'from-emerald-500 to-teal-600',
  'from-cyan-500 to-sky-600',
]

const avatarColor = (name = '') => {
  const code = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[code]
}

// Sana formatlash: 2000-01-01 -> 01.01.2000
const fmtDate = (v) => {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('ru-RU') // kk.mm.yyyy
}

const PASSPORT_LABEL = '🛂 Pasport maʼlumotlari'

export default function AuthApp() {
  const [loading, setLoading] = useState(true) // sahifa ochilishda session tekshirilmoqda
  const [busy, setBusy] = useState(false) // login/register jarayoni
  const [mode, setMode] = useState('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState(initialRegister)
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [openId, setOpenId] = useState(null) // ochilgan user qatori
  const [changingRole, setChangingRole] = useState(null) // rol o'zgarayotgan user id
  // Admin CRUD: null | { mode: 'add' | 'edit', targetId, values }
  const [panelForm, setPanelForm] = useState(null)
  const [savingUser, setSavingUser] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [storage, setStorage] = useState(null)
  const [search, setSearch] = useState('')
  const [tokenInfo, setTokenInfo] = useState(null)

  // LocalStorage holatini o'qish (panel uchun)
  const readStorage = () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem(TOKEN_KEY)
    setStorage({
      token: !!token,
      refresh: !!localStorage.getItem(REFRESH_KEY),
      user: !!localStorage.getItem(USER_KEY),
    })
    setTokenInfo(getTokenInfo(token))
  }

  // Barcha userlarni olish + localStorage'ga yozib qo'yish
  const loadUsers = async () => {
    try {
      const { data } = await getUsers()
      const list = Array.isArray(data) ? data : []
      setUsers(list)
      saveUsers(list)
    } catch (err) {
      // 403 — admin emas: jim o'tkazamiz, ro'yxat ko'rinmaydi
      if (err.response?.status !== 403) {
        setError(err.response?.data?.message || 'Userlar ro‘yxatini olishda xatolik.')
      }
      setUsers([])
    }
  }

  // Sahifa ochilganda: localStorage'dan DARHOL tiklaymiz, keyin serverdan yangilaymiz
  useEffect(() => {
    const checkSession = async () => {
      if (typeof window === 'undefined') return

      let token = localStorage.getItem(TOKEN_KEY)

      // Access token yo'q, lekin refresh token bor — yangi access token olamiz
      if (!token) {
        const refreshToken = localStorage.getItem(REFRESH_KEY)
        if (refreshToken) {
          try {
            const { data } = await refreshAccessToken(refreshToken)
            if (data.accessToken) {
              token = data.accessToken
              localStorage.setItem(TOKEN_KEY, data.accessToken)
            }
          } catch (err) {
            // Faqat refresh token butkul yaroqsiz bo'lsa (401/403) tozlanadi
            const status = err?.response?.status
            if (status === 401 || status === 403) clearAuth()
          }
        }
      }

      if (!token) {
        setLoading(false)
        return
      }

      // 1) LocalStorage'da saqlangan ma'lumotlar — DARHOL ko'rsatamiz (tez)
      const savedUser = getSavedUser()
      if (savedUser) setUser(savedUser)

      const savedUsers = getSavedUsers()
      if (savedUsers.length > 0) setUsers(savedUsers)

      // 2) Serverdan toza ma'lumot olib, localStorage'ni yangilab boramiz
      let authOk = true
      let meData = null
      try {
        const { data: me } = await getMe()
        meData = me
        setUser(me)
        saveUser(me) // to'liq user ma'lumoti localStoragega yoziladi
      } catch (err) {
        // Vaqtinchalik tarmoq xatosida localStorage QOLADI — o'chmaydi!
        // Faqat 401/403 (token bekor) bo'lsa tozalanadi
        const status = err.response?.status
        if (status === 401 || status === 403) {
          authOk = false
          clearAuth()
          setUser(null)
          setUsers([])
        }
      } finally {
        setLoading(false)
        readStorage()
        // Userlar ro'yxatini FAQAT admin yuklaydi (oddiy user 403 oladi)
        if (authOk && meData?.role === 'admin') loadUsers()
      }
    }

    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeLogin = (e) => {
    setLoginForm((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  const changeRegister = (e) => {
    setRegisterForm((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  // Pasport maydonlari alohida object ichida saqlanadi
  const changePassport = (e) => {
    const { name, value } = e.target
    setRegisterForm((p) => ({
      ...p,
      passport: { ...p.passport, [name]: value },
    }))
  }

  // LOGIN: token olish -> localStoragega yozish -> profil + userlar ro'yxati
  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!loginForm.username.trim() || !loginForm.password) {
      setError('Username va passwordni kiriting.')
      return
    }

    try {
      setBusy(true)

      const { data } = await loginUser({
        username: loginForm.username.trim(),
        password: loginForm.password,
      })

      // Backend javobi: { message, accessToken, refreshToken }
      if (!data.accessToken) {
        setError('Server tokenni qaytarmadi.')
        return
      }

      saveTokens(data.accessToken, data.refreshToken)

      const { data: me } = await getMe()
      setUser(me)
      saveUser(me) // user ma'lumoti ham localStoragega TO'LIQ yoziladi
      // Faqat admin userlar ro'yxatini ko'radi
      if (me.role === 'admin') {
        await loadUsers()
      } else {
        setUsers([])
      }
      readStorage()
      setMessage(data.message || 'Login muvaffaqiyatli ✅')
    } catch (err) {
      setError(err.response?.data?.message || 'Login qilishda xatolik.')
    } finally {
      setBusy(false)
    }
  }

  // REGISTER
  const handleRegister = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (
      !registerForm.username.trim() ||
      !registerForm.fullName.trim() ||
      !registerForm.firstName.trim() ||
      !registerForm.lastName.trim() ||
      !registerForm.password
    ) {
      setError('Username, fullName, firstName, lastName va password majburiy.')
      return
    }

    try {
      setBusy(true)

      const payload = {
        ...registerForm,
        username: registerForm.username.trim(),
        age: registerForm.age ? Number(registerForm.age) : undefined,
        // Bo'sh pasport maydonlari yuborilmaydi
        passport:
          registerForm.passport &&
          (registerForm.passport.series || registerForm.passport.number)
            ? registerForm.passport
            : undefined,
      }

      const { data } = await registerUser(payload)

      setMessage(data.message || 'User yaratildi ✅ Endi login qiling.')
      setLoginForm({
        username: data.user?.username || registerForm.username,
        password: '',
      })
      setRegisterForm(initialRegister)
      setMode('login')
    } catch (err) {
      setError(err.response?.data?.message || 'Ro‘yxatdan o‘tishda xatolik.')
    } finally {
      setBusy(false)
    }
  }

  // LOGOUT: serverda refresh tokenni bekor qilamiz, keyin localstorage tozalanadi
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_KEY)
      if (refreshToken) {
        await logoutUser(refreshToken) // server tokenni bazadan o'chiradi
      }
    } catch {
      // Server javob bermasa ham local logout bo'ladi
    } finally {
      clearAuth()
      setUser(null)
      setUsers([])
      setOpenId(null)
      setSearch('')
      setLoginForm({ username: '', password: '' })
      setMessage('')
      setError('')
      readStorage()
    }
  }

  // Joriy user adminmi?
  const isAdmin = user?.role === 'admin'

  // ROL O'ZGARTIRISH (faqat admin): boshqa userga adminlik berish/olish
  const handleRoleChange = async (targetId, newRole) => {
    setMessage('')
    setError('')
    try {
      setChangingRole(targetId)
      const { data } = await updateUserRole(targetId, newRole)
      setMessage(data.message || 'Rol o‘zgartirildi ✅')
      await loadUsers() // ro'yxatni yangilab qo'yamiz
    } catch (err) {
      setError(err.response?.data?.message || 'Rolni o‘zgartirishda xatolik.')
    } finally {
      setChangingRole(null)
    }
  }

  // ===== ADMIN CRUD: user qo'shish / tahrirlash / o'chirish =====

  // "User qo'shish" tugmasi -> bo'sh forma ochiladi
  const openAddUser = () => {
    setMessage('')
    setError('')
    setPanelForm({ mode: 'add', targetId: null, values: { ...initialAdminUser } })
  }

  // "Tahrirlash" tugmasi -> user mavjud ma'lumotlari bilan forma ochiladi
  const openEditUser = (u) => {
    setMessage('')
    setError('')
    setPanelForm({
      mode: 'edit',
      targetId: u.id,
      values: {
        username: u.username || '',
        fullName: u.fullName || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        middleName: u.middleName || '',
        birthDate: u.birthDate || '',
        gender: u.gender || '',
        country: u.country || '',
        region: u.region || '',
        district: u.district || '',
        address: u.address || '',
        phone: u.phone || '',
        email: u.email || '',
        age: u.age ?? '',
        passport: {
          series: u.passport?.series || '',
          number: u.passport?.number || '',
          issuedBy: u.passport?.issuedBy || '',
          issuedDate: u.passport?.issuedDate || '',
        },
        password: '', // bo'sh = parol o'zgarmaydi
      },
    })
  }

  const closePanelForm = () => setPanelForm(null)

  const changePanelForm = (e) => {
    const { name, value } = e.target
    setPanelForm((p) => ({ ...p, values: { ...p.values, [name]: value } }))
  }

  const changePanelPassport = (e) => {
    const { name, value } = e.target
    setPanelForm((p) => ({
      ...p,
      values: { ...p.values, passport: { ...p.values.passport, [name]: value } },
    }))
  }

  // CREATE (admin): POST /users
  const handleCreateUser = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    const v = panelForm.values

    if (!v.username.trim() || !v.fullName.trim() || !v.password) {
      setError('username, fullName va password majburiy.')
      return
    }

    try {
      setSavingUser(true)
      const { data } = await createUser({
        ...v,
        username: v.username.trim(),
        age: v.age ? Number(v.age) : undefined,
        role: 'user', // yangi user oddiy user bo'lib yaratiladi (rol keyin beriladi)
      })
      setMessage(data.message || 'User yaratildi ✅')
      setPanelForm(null)
      await loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'User yaratishda xatolik.')
    } finally {
      setSavingUser(false)
    }
  }

  // UPDATE (admin): PUT /users/:id
  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    const v = panelForm.values

    if (!v.username.trim() || !v.fullName.trim()) {
      setError('username va fullName majburiy.')
      return
    }

    try {
      setSavingUser(true)
      const payload = {
        ...v,
        age: v.age ? Number(v.age) : undefined,
      }
      if (!payload.password) delete payload.password // bo'sh parol — o'zgarmaydi

      const { data } = await updateUser(panelForm.targetId, payload)
      setMessage(data.message || 'User yangilandi ✅')
      setPanelForm(null)
      await loadUsers()

      // Agar admin o'z profilini tahrirlagan bo'lsa — /me dan yangilaymiz
      if (panelForm.targetId === user.id) {
        try {
          const { data: me } = await getMe()
          setUser(me)
          saveUser(me)
        } catch {
          // jim o'tkazamiz
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Userni yangilashda xatolik.')
    } finally {
      setSavingUser(false)
    }
  }

  // DELETE (admin): DELETE /users/:id
  const handleDeleteUser = async (targetId, username) => {
    if (!window.confirm(`@${username} o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return

    setMessage('')
    setError('')
    try {
      setDeletingId(targetId)
      const { data } = await deleteUser(targetId)
      setMessage(data.message || `@${username} o'chirildi 🗑️`)
      if (openId === targetId) setOpenId(null)
      await loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Userni o‘chirishda xatolik.')
    } finally {
      setDeletingId(null)
    }
  }

  // Qidiruv (ism / username / email bo'yicha)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? users.filter((u) =>
        [u.fullName, u.username, u.email, u.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : users

  // ---- 1) Session tekshirilayotganda ----
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
          <p className="text-sm font-bold text-slate-400">Yuklanmoqda...</p>
        </div>
      </main>
    )
  }

  // ---- 2) Login qilingan: profil + barcha userlar ro'yxati ----
  if (user) {
    // Token qolgan umr (min)
    const exp = tokenInfo?.exp ? Math.floor((tokenInfo.exp * 1000 - Date.now()) / 60000) : null

    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:py-10">
        <div className="mx-auto max-w-4xl">
          {/* HEADER */}
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.25em] text-blue-400">
                Shaxsiy kabinet
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                Xush kelibsiz, {user.firstName || user.fullName}! 👋
              </h1>
            </div>

            <div className="flex gap-3">
              {isAdmin && (
                <a
                  href="/admin"
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
                >
                  👑 Admin panel
                </a>
              )}
              <a
                href="/api-docs"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-blue-400/40 hover:text-blue-300"
              >
                📄 Swagger
              </a>
              <button
                onClick={logout}
                className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-red-400/50 hover:text-red-300"
              >
                Chiqish
              </button>
            </div>
          </header>

          {message && (
            <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-200">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-200">
              {error}
            </div>
          )}

          {/* PROFIL KARTA */}
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="relative border-b border-white/10 bg-gradient-to-br from-blue-600/25 via-violet-600/15 to-transparent p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-5">
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarColor(
                    user.fullName || 'U'
                  )} text-3xl font-black text-white shadow-lg ring-1 ring-white/20`}
                >
                  {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-black sm:text-3xl">{user.fullName}</h2>
                  <p className="mt-0.5 text-slate-400">@{user.username}</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Online
                  </span>
                </div>
              </div>

              {/* Token holati */}
              <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span
                  className={`rounded-full px-3 py-1.5 ring-1 ${
                    user.role === 'admin'
                      ? 'bg-amber-500/15 text-amber-300 ring-amber-400/30'
                      : 'bg-white/5 text-slate-300 ring-white/10'
                  }`}
                >
                  {user.role === 'admin' ? '🛡️ ADMIN' : '👤 User'}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-300 ring-1 ring-white/10">
                  🔑 Access token {exp !== null ? `· ${exp} daqiqa qoldi` : ''}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-300 ring-1 ring-white/10">
                  🔄 Refresh · 7 kun
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-300 ring-1 ring-white/10">
                  💾 localStorage
                </span>
              </div>
            </div>

            {/* Profil ma'lumotlari */}
            <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
              <Info label="ID" value={user.id} />
              <Info label="Rol" value={user.role === 'admin' ? '🛡️ Admin' : '👤 Oddiy user'} />
              <Info label="Username" value={user.username} />
              <Info label="Email" value={user.email} />
              <Info label="Phone" value={user.phone} />
              <Info label="Tug‘ilgan sana" value={fmtDate(user.birthDate)} />
              <Info label="Yosh" value={user.age ? `${user.age} yosh` : null} />
              <Info label="Jins" value={user.gender} />
              <Info label="Mamlakat" value={user.country} />
              <Info label="Viloyat" value={user.region} />
              <Info label="Tuman" value={user.district} />
              <Info label="Manzil" value={user.address} />
              <Info label="Ro‘yxatdan o‘tgan" value={fmtDate(user.registeredAt)} />
              {user.passport && (
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5 sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {PASSPORT_LABEL}
                  </p>
                  <p className="mt-2 font-bold text-slate-200">
                    {user.passport.series} {user.passport.number}
                    {user.passport.issuedBy && (
                      <span className="font-normal text-slate-400">
                        {' '}
                        — {user.passport.issuedBy}
                      </span>
                    )}
                    {user.passport.issuedDate && (
                      <span className="font-normal text-slate-400">
                        , {fmtDate(user.passport.issuedDate)}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* BARCHA USERLAR — bitta qatorda bitta user */}
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">👥 Foydalanuvchilar</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {isAdmin
                    ? `Jami ${users.length} ta user — ko‘rish uchun qatorni bosing`
                    : 'Bu bo‘lim faqat adminlar uchun 🔒'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={openAddUser}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                  >
                    ＋ User qo‘shish
                  </button>
                )}
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    🔍
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ism, username yoki email..."
                    className="w-64 rounded-xl border border-white/10 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>
            </div>

            {/* ADMIN: user qo'shish / tahrirlash formasi */}
            {isAdmin && panelForm && (
              <AdminUserForm
                mode={panelForm.mode}
                values={panelForm.values}
                onChange={changePanelForm}
                onPassportChange={changePanelPassport}
                onSubmit={panelForm.mode === 'add' ? handleCreateUser : handleUpdateUser}
                onCancel={closePanelForm}
                saving={savingUser}
              />
            )}

            {!isAdmin ? (
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-10 text-center backdrop-blur-xl">
                <p className="text-3xl">🔒</p>
                <p className="mt-3 font-bold text-slate-300">
                  Userlar ro‘yxati faqat adminlar ko‘ra oladi
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Siz oddiy user — admin huquqi kerak.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-10 text-center backdrop-blur-xl">
                <p className="text-3xl">🗂️</p>
                <p className="mt-3 font-bold text-slate-300">
                  {q ? 'Hech narsa topilmadi' : 'Hozircha userlar yo‘q'}
                </p>
                {q && (
                  <p className="mt-1 text-sm text-slate-500">
                    «{search}» bo‘yicha natija yo‘q — boshqa so‘z bilan urinib ko‘ring
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <ul className="divide-y divide-white/5">
                  {filtered.map((u) => {
                    const isOpen = openId === (u.id ?? u.username)
                    const color = avatarColor(u.fullName || u.username || 'U')
                    return (
                      <li key={u.id ?? u.username}>
                        {/* ===== QATOR (bitta user) ===== */}
                        <button
                          onClick={() => setOpenId(isOpen ? null : u.id ?? u.username)}
                          className={`flex w-full items-center gap-4 px-4 py-4 text-left transition sm:px-6 ${
                            isOpen
                              ? 'bg-blue-500/[.07]'
                              : 'hover:bg-white/[.03]'
                          }`}
                        >
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-base font-black text-white shadow-md ring-1 ring-white/20`}
                          >
                            {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-100">
                              {u.fullName || u.username}
                              {u.role === 'admin' && (
                                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30">
                                  🛡️ Admin
                                </span>
                              )}
                              {u.username === user.username && (
                                <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-300 ring-1 ring-blue-400/30">
                                  Siz
                                </span>
                              )}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              @{u.username}
                              {u.email ? ` · ${u.email}` : ''}
                            </p>
                          </div>

                          {u.age != null && (
                            <span className="hidden shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300 ring-1 ring-white/10 sm:inline">
                              {u.age} yosh
                            </span>
                          )}

                          <span
                            className={`shrink-0 text-slate-500 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-blue-300' : ''
                            }`}
                          >
                            ▾
                          </span>
                        </button>

                        {/* ===== OCHILGAN PANEL ===== */}
                        {isOpen && (
                          <div className="grid gap-3 border-t border-white/5 bg-slate-950/40 px-4 py-6 sm:grid-cols-2 sm:px-6">
                            <Info label="ID" value={u.id} />
                            <Info label="Username" value={u.username} />
                            <Info label="Full name" value={u.fullName} />
                            <Info
                              label="F.I.SH"
                              value={
                                [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ') ||
                                null
                              }
                            />
                            <Info label="Email" value={u.email} />
                            <Info label="Phone" value={u.phone} />
                            <Info label="Tug‘ilgan sana" value={fmtDate(u.birthDate)} />
                            <Info label="Yosh" value={u.age ? `${u.age} yosh` : null} />
                            <Info label="Jins" value={u.gender} />
                            <Info label="Mamlakat" value={u.country} />
                            <Info label="Viloyat" value={u.region} />
                            <Info label="Tuman" value={u.district} />
                            <Info label="Manzil" value={u.address} />
                            <Info label="Ro‘yxatdan o‘tgan" value={fmtDate(u.registeredAt)} />
                            {u.passport && (
                              <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 sm:col-span-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                  {PASSPORT_LABEL}
                                </p>
                                <p className="mt-2 font-bold text-slate-200">
                                  {u.passport.series} {u.passport.number}
                                  {u.passport.issuedBy && (
                                    <span className="font-normal text-slate-400">
                                      {' '}
                                      — {u.passport.issuedBy}
                                    </span>
                                  )}
                                  {u.passport.issuedDate && (
                                    <span className="font-normal text-slate-400">
                                      , {fmtDate(u.passport.issuedDate)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                            <Info
                              label="Rol"
                              value={u.role === 'admin' ? '🛡️ Admin' : '👤 Oddiy user'}
                            />
                            {isAdmin && (
                              <div className="rounded-2xl border border-amber-400/20 bg-amber-950/20 p-4 sm:col-span-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  🛡️ Admin boshqaruvi
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleRoleChange(u.id, 'admin')}
                                    disabled={changingRole === u.id || u.role === 'admin'}
                                    className="rounded-xl bg-amber-500/90 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {changingRole === u.id ? 'Kutilmoqda...' : 'Admin qilish'}
                                  </button>
                                  <button
                                    onClick={() => handleRoleChange(u.id, 'user')}
                                    disabled={changingRole === u.id || u.role !== 'admin'}
                                    className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-black text-slate-300 transition hover:border-red-400/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Oddiy user qilish
                                  </button>
                                  <span className="mx-1 hidden w-px bg-white/10 sm:block" />
                                  <button
                                    onClick={() => openEditUser(u)}
                                    className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-black text-blue-300 transition hover:bg-blue-500/20"
                                  >
                                    ✏️ Tahrirlash
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    disabled={deletingId === u.id || u.id === user.id}
                                    className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {deletingId === u.id ? 'O‘chirilmoqda...' : '🗑️ O‘chirish'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* LocalStorage holati */}
            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                💾 LocalStorage holati — sahifa yangilansa ham saqlanadi
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StorageBox
                  label="auth_token"
                  ok={storage?.token}
                  hint={tokenInfo?.username ? `JWT · @${tokenInfo.username}` : 'accessToken (JWT)'}
                />
                <StorageBox
                  label="auth_refresh_token"
                  ok={storage?.refresh}
                  hint="refreshToken (7 kun)"
                />
                <StorageBox label="auth_user" ok={storage?.user} hint="To‘liq user ma’lumoti" />
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  // ---- 3) Login qilinmagan: Login / Register ----
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-[.3em] text-blue-400">
            NEXT.JS • TAILWIND • EXPRESS
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.03em] sm:text-5xl">
            Authentication
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Login qilgandan keyin JWT tokenlar localStoragega yoziladi va barcha
            userlar ro‘yxati chiroyli ko‘rinishda chiqadi.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Chap panel */}
          <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1">
              <button
                onClick={() => {
                  setMode('login')
                  setMessage('')
                  setError('')
                }}
                className={`rounded-xl px-4 py-3 font-bold transition ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMode('register')
                  setMessage('')
                  setError('')
                }}
                className={`rounded-xl px-4 py-3 font-bold transition ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-400/10 bg-blue-500/5 p-5">
              <p className="text-[11px] font-black uppercase tracking-wider text-blue-300">
                API
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">POST</span>
                  /api/login → JWT
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-black text-sky-300">GET</span>
                  /api/me (Bearer token)
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-black text-sky-300">GET</span>
                  /api/users → ro‘yxat (admin)
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-black text-amber-300">PATCH</span>
                  /api/users/:id/role (admin)
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">POST</span>
                  /api/refresh → yangi token
                </li>
              </ul>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                So‘rovlar Next.js rewrite orqali Express (5432) ga yuboriladi.
                accessToken va refreshToken localStorage’da saqlanadi.
              </p>
              <a
                href="/api-docs"
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 text-center text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/15"
              >
                📄 Swagger API hujjatlari
              </a>
            </div>
          </aside>

          {/* Forma */}
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            {mode === 'login' ? (
              <LoginForm
                form={loginForm}
                onChange={changeLogin}
                onSubmit={handleLogin}
                loading={busy}
              />
            ) : (
              <RegisterForm
                form={registerForm}
                onChange={changeRegister}
                onPassportChange={changePassport}
                onSubmit={handleRegister}
                loading={busy}
              />
            )}

            {message && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-200">
                {message}
              </div>
            )}
            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-200">
                {error}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function AdminUserForm({ mode, values, onChange, onPassportChange, onSubmit, onCancel, saving }) {
  const isAdd = mode === 'add'

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-3xl border border-blue-400/20 bg-slate-900/80 p-6 backdrop-blur-xl sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-blue-300">
            {isAdd ? '➕ Yangi user qo‘shish' : `✏️ @${values.username} — tahrirlash`}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {isAdd
              ? 'username, fullName va password majburiy. User oddiy user bo‘lib yaratiladi (keyin rol beriladi).'
              : 'Parol maydonini bo‘sh qoldirsangiz — parol o‘zgarmaydi.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-bold text-slate-400 transition hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input name="username" value={values.username} onChange={onChange} placeholder="Username *" icon="👤" />
        <Input name="fullName" value={values.fullName} onChange={onChange} placeholder="Full name *" icon="🪪" />
        <Input name="firstName" value={values.firstName} onChange={onChange} placeholder="First name" />
        <Input name="lastName" value={values.lastName} onChange={onChange} placeholder="Last name" />
        <Input name="middleName" value={values.middleName} onChange={onChange} placeholder="Middle name" />
        <Input name="birthDate" value={values.birthDate} onChange={onChange} placeholder="Birth date (2000-01-01)" />
        <Input name="email" value={values.email} onChange={onChange} placeholder="Email" type="email" icon="✉️" />
        <Input name="phone" value={values.phone} onChange={onChange} placeholder="Phone" type="tel" icon="📞" />
        <Input name="age" value={values.age} onChange={onChange} placeholder="Age" type="number" min="0" />
        <Input name="country" value={values.country} onChange={onChange} placeholder="Country" />
        <Input name="region" value={values.region} onChange={onChange} placeholder="Region" />
        <Input name="district" value={values.district} onChange={onChange} placeholder="District" />
        <Input name="address" value={values.address} onChange={onChange} placeholder="Address" />
        <Input
          name="password"
          value={values.password}
          onChange={onChange}
          placeholder={isAdd ? 'Password *' : 'Yangi parol (bo‘sh = o‘zgarmaydi)'}
          type="password"
          icon="🔒"
        />
        <select
          name="gender"
          value={values.gender}
          onChange={onChange}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-300 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
        >
          <option value="">Gender</option>
          <option value="erkak">Erkak</option>
          <option value="ayol">Ayol</option>
        </select>
      </div>

      {/* Pasport */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/60 p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
          🛂 Pasport maʼlumotlari (majburiy emas)
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input name="series" value={values.passport?.series || ''} onChange={onPassportChange} placeholder="Seriyasi (AA)" />
          <Input name="number" value={values.passport?.number || ''} onChange={onPassportChange} placeholder="Raqami (1234567)" />
          <Input name="issuedBy" value={values.passport?.issuedBy || ''} onChange={onPassportChange} placeholder="Kim tomonidan berilgan" />
          <Input name="issuedDate" value={values.passport?.issuedDate || ''} onChange={onPassportChange} placeholder="Berilgan sana (2023-01-10)" />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          disabled={saving}
          className="flex-1 rounded-xl bg-blue-600 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saqlanmoqda...
            </span>
          ) : isAdd ? (
            'User qo‘shish'
          ) : (
            'O‘zgarishlarni saqlash'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-slate-900/80 px-5 py-3.5 font-black text-slate-300 transition hover:border-red-400/50 hover:text-red-300"
        >
          Bekor qilish
        </button>
      </div>
    </form>
  )
}

function LoginForm({ form, onChange, onSubmit, loading }) {
  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-3xl font-black">Xush kelibsiz 👋</h2>
      <p className="mt-2 text-slate-400">
        Accountga kirish uchun ma’lumotlaringizni kiriting.
      </p>

      <div className="mt-8 grid gap-4">
        <Input
          name="username"
          value={form.username}
          onChange={onChange}
          placeholder="Username"
          icon="👤"
        />
        <Input
          name="password"
          value={form.password}
          onChange={onChange}
          placeholder="Password"
          type="password"
          icon="🔒"
        />
      </div>

      <button
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Kutilmoqda...
          </span>
        ) : (
          'Login qilish'
        )}
      </button>

      <p className="mt-5 text-sm text-slate-500">
        Test account:{' '}
        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-slate-300">ali_uz</span> /{' '}
        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-slate-300">test1234</span>
      </p>
    </form>
  )
}

function RegisterForm({ form, onChange, onPassportChange, onSubmit, loading }) {
  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-3xl font-black">Account yaratish</h2>
      <p className="mt-2 text-slate-400">
        ID va registeredAt backend tomonidan avtomatik yaratiladi.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Input name="username" value={form.username} onChange={onChange} placeholder="Username *" icon="👤" />
        <Input name="fullName" value={form.fullName} onChange={onChange} placeholder="Full name *" icon="🪪" />
        <Input name="firstName" value={form.firstName} onChange={onChange} placeholder="First name *" />
        <Input name="lastName" value={form.lastName} onChange={onChange} placeholder="Last name *" />
        <Input name="middleName" value={form.middleName} onChange={onChange} placeholder="Middle name" />
        <Input name="birthDate" value={form.birthDate} onChange={onChange} placeholder="Birth date (2000-01-01)" />
        <Input name="email" value={form.email} onChange={onChange} placeholder="Email" type="email" icon="✉️" />
        <Input name="phone" value={form.phone} onChange={onChange} placeholder="Phone" type="tel" icon="📞" />
        <Input name="age" value={form.age} onChange={onChange} placeholder="Age" type="number" min="0" />
        <Input name="country" value={form.country} onChange={onChange} placeholder="Country" />
        <Input name="region" value={form.region} onChange={onChange} placeholder="Region" />
        <Input name="district" value={form.district} onChange={onChange} placeholder="District" />
        <Input name="address" value={form.address} onChange={onChange} placeholder="Address" />
        <Input name="password" value={form.password} onChange={onChange} placeholder="Password *" type="password" icon="🔒" />

        <select
          name="gender"
          value={form.gender}
          onChange={onChange}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-300 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
        >
          <option value="">Gender</option>
          <option value="erkak">Erkak</option>
          <option value="ayol">Ayol</option>
        </select>
      </div>

      {/* PASPORT MA'LUMOTLARI (Swagger'dagi passport object) */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/60 p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
          🛂 Pasport maʼlumotlari (majburiy emas)
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            name="series"
            value={form.passport?.series || ''}
            onChange={onPassportChange}
            placeholder="Pasport seriyasi (AA)"
          />
          <Input
            name="number"
            value={form.passport?.number || ''}
            onChange={onPassportChange}
            placeholder="Pasport raqami (1234567)"
          />
          <Input
            name="issuedBy"
            value={form.passport?.issuedBy || ''}
            onChange={onPassportChange}
            placeholder="Kim tomonidan berilgan"
          />
          <Input
            name="issuedDate"
            value={form.passport?.issuedDate || ''}
            onChange={onPassportChange}
            placeholder="Berilgan sana (2023-01-10)"
          />
        </div>
      </div>

      <button
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Yuborilmoqda...
          </span>
        ) : (
          'Ro‘yxatdan o‘tish'
        )}
      </button>
    </form>
  )
}

function Input({ name, value, onChange, placeholder, type = 'text', min, icon }) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm opacity-60">
          {icon}
        </span>
      )}
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        min={min}
        className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 ${
          icon ? 'pl-11 pr-4' : 'px-4'
        }`}
      />
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 break-all text-sm font-bold text-slate-200">{value ?? '—'}</p>
    </div>
  )
}

function StorageBox({ label, ok, hint }) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        ok
          ? 'border-emerald-400/20 bg-emerald-950/30'
          : 'border-white/5 bg-slate-950/60'
      }`}
    >
      <p className="flex items-center justify-between gap-2 break-all font-mono text-sm text-slate-300">
        {label}
        <span className={`shrink-0 text-xs font-black ${ok ? 'text-emerald-300' : 'text-slate-600'}`}>
          {ok ? '✅ bor' : '—'}
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}
