'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMe,
  getUsers,
  updateUserRole,
  refreshAccessToken,
  clearAuth,
  TOKEN_KEY,
  REFRESH_KEY,
  createUser,
  updateUser,
  deleteUser,
} from '../lib/api'

// ======================================
// QORA ADMEN PANEL — KONFIG
// ======================================

const AVATAR_COLORS = [
  'from-slate-600 to-slate-800',
  'from-zinc-600 to-zinc-800',
  'from-neutral-700 to-neutral-900',
  'from-stone-600 to-stone-800',
  'from-gray-700 to-gray-900',
]

const avatarColor = (name = '') => {
  const code = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[code]
}

// 2000-01-01 -> 01.01.2000
const fmtDate = (v) => {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('ru-RU')
}

const initialForm = {
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

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'users', label: 'Userlar', icon: '👥' },
  { id: 'storage', label: 'Token holati', icon: '🔑' },
]

export default function AdminApp() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState(null) // null | { mode: 'add'|'edit', targetId, values }
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [changingRole, setChangingRole] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // { id, username }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [nav, setNav] = useState('dashboard')

  const isAdmin = user?.role === 'admin'

  // Userlar ro'yxatini yuklash
  const loadUsers = async () => {
    const { data } = await getUsers()
    const list = Array.isArray(data) ? data : []
    setUsers(list)
    return list
  }

  // Session tekshirish: admin bo'lmasa / ga qaytaramiz
  useEffect(() => {
    const check = async () => {
      if (typeof window === 'undefined') return

      let token = localStorage.getItem(TOKEN_KEY)

      if (!token) {
        const refreshToken = localStorage.getItem(REFRESH_KEY)
        if (refreshToken) {
          try {
            const { data } = await refreshAccessToken(refreshToken)
            if (data.accessToken) {
              token = data.accessToken
              localStorage.setItem(TOKEN_KEY, data.accessToken)
            }
          } catch {
            // token bekor
          }
        }
      }

      if (!token) {
        router.replace('/')
        return
      }

      try {
        const { data: me } = await getMe()
        if (me.role !== 'admin') {
          router.replace('/') // admin emas — kabinetga qaytadi
          return
        }
        setUser(me)
        await loadUsers()
      } catch (err) {
        const status = err?.response?.status
        if (status === 401 || status === 403) clearAuth()
        router.replace('/')
        return
      }

      setLoading(false)
    }

    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Statistika
  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin').length
    const withEmail = users.filter((u) => u.email).length
    const withPassport = users.filter((u) => u.passport?.number).length
    return { total: users.length, admins, users: users.length - admins, withEmail, withPassport }
  }, [users])

  // Qidiruv + filtr + sahifalash
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    let list = users
    if (q) {
      list = list.filter((u) =>
        [u.fullName, u.username, u.email, u.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    }
    if (roleFilter === 'admin') list = list.filter((u) => u.role === 'admin')
    if (roleFilter === 'user') list = list.filter((u) => u.role !== 'admin')
    return list
  }, [users, q, roleFilter])

  const PER_PAGE = 8
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * PER_PAGE, pageSafe * PER_PAGE)

  // Filtr o'zgarsa 1-sahifaga qaytish
  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  // ===== AMALLAR =====

  const flash = (ok, text) => {
    if (ok) {
      setMessage(text)
      setError('')
    } else {
      setError(text)
      setMessage('')
    }
    setTimeout(() => {
      setMessage('')
      setError('')
    }, 4000)
  }

  const handleRoleChange = async (targetId, newRole) => {
    try {
      setChangingRole(targetId)
      const { data } = await updateUserRole(targetId, newRole)
      flash(true, data.message || 'Rol o‘zgartirildi ✅')
      await loadUsers()
    } catch (err) {
      flash(false, err.response?.data?.message || 'Rolni o‘zgartirishda xatolik.')
    } finally {
      setChangingRole(null)
    }
  }

  const openAdd = () => {
    setForm({ mode: 'add', targetId: null, values: { ...initialForm } })
  }

  const openEdit = (u) => {
    setForm({
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
        password: '',
      },
    })
  }

  const closeForm = () => setForm(null)

  const changeForm = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, values: { ...p.values, [name]: value } }))
  }

  const changePassport = (e) => {
    const { name, value } = e.target
    setForm((p) => ({
      ...p,
      values: { ...p.values, passport: { ...p.values.passport, [name]: value } },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const v = form.values

    try {
      setSaving(true)

      if (form.mode === 'add') {
        if (!v.username.trim() || !v.fullName.trim() || !v.password) {
          flash(false, 'username, fullName va password majburiy.')
          return
        }
        const { data } = await createUser({
          ...v,
          username: v.username.trim(),
          age: v.age ? Number(v.age) : undefined,
          role: 'user',
        })
        flash(true, data.message || 'User yaratildi ✅')
      } else {
        if (!v.username.trim() || !v.fullName.trim()) {
          flash(false, 'username va fullName majburiy.')
          return
        }
        const payload = { ...v, age: v.age ? Number(v.age) : undefined }
        if (!payload.password) delete payload.password
        const { data } = await updateUser(form.targetId, payload)
        flash(true, data.message || 'User yangilandi ✅')

        if (form.targetId === user.id) {
          try {
            const { data: me } = await getMe()
            setUser(me)
          } catch {
            // jim o'tkazamiz
          }
        }
      }

      setForm(null)
      await loadUsers()
    } catch (err) {
      flash(false, err.response?.data?.message || 'Saqlashda xatolik.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    try {
      setDeletingId(confirmDel.id)
      const { data } = await deleteUser(confirmDel.id)
      flash(true, data.message || `@${confirmDel.username} o'chirildi 🗑️`)
      if (openId === confirmDel.id) setOpenId(null)
      setConfirmDel(null)
      await loadUsers()
    } catch (err) {
      flash(false, err.response?.data?.message || 'O‘chirishda xatolik.')
    } finally {
      setDeletingId(null)
    }
  }

  const logout = async () => {
    clearAuth()
    router.replace('/')
  }

  // ---- 1) Yuklanmoqda ----
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
          <p className="text-sm font-black uppercase tracking-[.3em] text-slate-500">
            Admin panel
          </p>
        </div>
      </main>
    )
  }

  // ---- 2) Admin panel ----
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-7xl">
        {/* ===== SIDEBAR ===== */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/5 bg-black/80 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-white/5 px-6 py-6">
              <p className="text-[10px] font-black uppercase tracking-[.35em] text-emerald-400">
                2-dars
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                👑 Admin Panel
              </h1>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setNav(item.id)
                    setSidebarOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                    nav === item.id
                      ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                  {item.id === 'users' && (
                    <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-slate-400">
                      {users.length}
                    </span>
                  )}
                </button>
              ))}

              <div className="pt-4">
                <p className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-700">
                  Havolalar
                </p>
                <a
                  href="/"
                  className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                >
                  <span>🏠</span> Shaxsiy kabinet
                </a>
                <a
                  href="/api-docs"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                >
                  <span>📄</span> Swagger
                </a>
              </div>
            </nav>

            <div className="border-t border-white/5 p-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColor(
                    user.fullName || 'A'
                  )} text-sm font-black text-white ring-1 ring-white/10`}
                >
                  {user.fullName?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">{user.fullName}</p>
                  <p className="truncate text-xs text-slate-500">@{user.username}</p>
                </div>
                <button
                  onClick={logout}
                  title="Chiqish"
                  className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-black text-slate-400 transition hover:border-red-400/40 hover:text-red-300"
                >
                  ⏻
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobil overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ===== ASOSIY QISM ===== */}
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          {/* Topbar (mobil) */}
          <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-white/10 bg-black/60 px-4 py-2.5 text-sm font-black text-slate-300"
            >
              ☰ Menu
            </button>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-400/20">
              👑 Admin
            </span>
          </div>

          {/* Xabarlar */}
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

          {/* ===== DASHBOARD ===== */}
          {nav === 'dashboard' && (
            <section>
              <header className="mb-6">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Dashboard
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Loyiha holati va umumiy statistika
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon="👥" label="Jami userlar" value={stats.total} accent="text-white" />
                <StatCard icon="🛡️" label="Adminlar" value={stats.admins} accent="text-emerald-300" />
                <StatCard icon="👤" label="Oddiy userlar" value={stats.users} accent="text-slate-300" />
                <StatCard icon="🛂" label="Pasport kiritgan" value={stats.withPassport} accent="text-amber-300" />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {/* Oxirgi qo'shilgan userlar */}
                <div className="rounded-3xl border border-white/5 bg-black/60 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-white">🆕 Oxirgi userlar</h3>
                    <button
                      onClick={() => setNav('users')}
                      className="text-xs font-black text-emerald-400 hover:text-emerald-300"
                    >
                      Barchasi →
                    </button>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {users.slice(0, 5).map((u) => (
                      <li
                        key={u.id ?? u.username}
                        className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${avatarColor(
                            u.fullName || 'U'
                          )} text-xs font-black text-white ring-1 ring-white/10`}
                        >
                          {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-200">
                            {u.fullName || u.username}
                          </p>
                          <p className="truncate text-xs text-slate-600">@{u.username}</p>
                        </div>
                        {u.role === 'admin' && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/20">
                            ADMIN
                          </span>
                        )}
                      </li>
                    ))}
                    {users.length === 0 && (
                      <li className="rounded-2xl bg-white/[.03] px-4 py-6 text-center text-sm text-slate-600">
                        Hozircha user yo‘q
                      </li>
                    )}
                  </ul>
                </div>

                {/* Tezkor amallar */}
                <div className="rounded-3xl border border-white/5 bg-black/60 p-6">
                  <h3 className="font-black text-white">⚡ Tezkor amallar</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={openAdd}
                      className="rounded-2xl bg-emerald-500/10 px-4 py-4 text-sm font-black text-emerald-300 ring-1 ring-emerald-400/20 transition hover:bg-emerald-500/20"
                    >
                      ＋ User qo‘shish
                    </button>
                    <button
                      onClick={() => setNav('users')}
                      className="rounded-2xl bg-white/5 px-4 py-4 text-sm font-black text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      👥 Userlar ro‘yxati
                    </button>
                    <a
                      href="/api-docs"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-white/5 px-4 py-4 text-sm font-black text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      📄 Swagger
                    </a>
                    <a
                      href="/"
                      className="rounded-2xl bg-white/5 px-4 py-4 text-sm font-black text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      🏠 Kabinet
                    </a>
                  </div>

                  <div className="mt-6 rounded-2xl bg-white/[.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      Maʼlumot
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Yangi qo‘shilgan user oddiy <b className="text-slate-300">user</b> rolida
                      yaratiladi. Adminlik esa user qatorini ochib «Admin qilish» tugmasi orqali
                      beriladi.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ===== USERLAR ===== */}
          {nav === 'users' && (
            <section>
              <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Userlar
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {filtered.length === users.length
                      ? `Jami ${users.length} ta user`
                      : `${filtered.length} / ${users.length} ta user topildi`}
                  </p>
                </div>
                <button
                  onClick={openAdd}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
                >
                  ＋ User qo‘shish
                </button>
              </header>

              {/* Qidiruv + filtr */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-sm">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
                    🔍
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ism, username, email yoki phone..."
                    className="w-full rounded-xl border border-white/10 bg-black/60 py-2.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
                <div className="flex gap-1 rounded-xl border border-white/10 bg-black/60 p-1">
                  {[
                    { id: 'all', label: 'Barchasi' },
                    { id: 'admin', label: '🛡️ Admin' },
                    { id: 'user', label: '👤 User' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setRoleFilter(f.id)}
                      className={`rounded-lg px-3.5 py-2 text-xs font-black transition ${
                        roleFilter === f.id
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CRUD forma (modal) */}
              {form && (
                <UserFormModal
                  mode={form.mode}
                  values={form.values}
                  onChange={changeForm}
                  onPassportChange={changePassport}
                  onSubmit={handleSubmit}
                  onClose={closeForm}
                  saving={saving}
                />
              )}

              {/* O'chirish tasdiqlash modali */}
              {confirmDel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-3xl border border-red-400/20 bg-zinc-950 p-6 shadow-2xl">
                    <p className="text-4xl">⚠️</p>
                    <h3 className="mt-3 text-xl font-black text-white">O‘chirish tasdiqlansin</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      <b className="text-slate-200">@{confirmDel.username}</b> butkul o‘chiriladi.
                      Bu amalni qaytarib bo‘lmaydi.
                    </p>
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={handleDelete}
                        disabled={deletingId === confirmDel.id}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-60"
                      >
                        {deletingId === confirmDel.id ? 'O‘chirilmoqda...' : 'Ha, o‘chirish'}
                      </button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300 transition hover:bg-white/5"
                      >
                        Bekor
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Userlar jadvali */}
              {paged.length === 0 ? (
                <div className="rounded-3xl border border-white/5 bg-black/60 p-12 text-center">
                  <p className="text-4xl">🗂️</p>
                  <p className="mt-3 font-black text-slate-300">
                    {q || roleFilter !== 'all' ? 'Hech narsa topilmadi' : 'Hozircha userlar yo‘q'}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-white/5 bg-black/60">
                  {/* Desktop jadval */}
                  <div className="hidden md:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                          <th className="px-6 py-4">User</th>
                          <th className="px-4 py-4">Contact</th>
                          <th className="px-4 py-4">Rol</th>
                          <th className="px-4 py-4">Ro‘yxatdan o‘tgan</th>
                          <th className="px-6 py-4 text-right">Amallar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {paged.map((u) => (
                          <tr
                            key={u.id ?? u.username}
                            className="transition hover:bg-white/[.02]"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColor(
                                    u.fullName || 'U'
                                  )} text-sm font-black text-white ring-1 ring-white/10`}
                                >
                                  {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="flex items-center gap-2 truncate font-bold text-slate-100">
                                    {u.fullName || u.username}
                                    {u.username === user.username && (
                                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-black text-sky-300 ring-1 ring-sky-400/20">
                                        Siz
                                      </span>
                                    )}
                                  </p>
                                  <p className="truncate text-xs text-slate-600">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="max-w-[220px] px-4 py-4">
                              <p className="truncate text-slate-400">{u.email || '—'}</p>
                              <p className="truncate text-xs text-slate-600">{u.phone || ''}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${
                                  u.role === 'admin'
                                    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20'
                                    : 'bg-white/5 text-slate-400 ring-white/10'
                                }`}
                              >
                                {u.role === 'admin' ? '🛡️ Admin' : '👤 User'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-slate-500">
                              {fmtDate(u.registeredAt) || '—'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-1.5">
                                {u.role !== 'admin' && (
                                  <button
                                    onClick={() => handleRoleChange(u.id, 'admin')}
                                    disabled={changingRole === u.id}
                                    title="Admin qilish"
                                    className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                                  >
                                    🛡️
                                  </button>
                                )}
                                {u.role === 'admin' && u.id !== user.id && (
                                  <button
                                    onClick={() => handleRoleChange(u.id, 'user')}
                                    disabled={changingRole === u.id}
                                    title="Oddiy user qilish"
                                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-black text-slate-400 transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-40"
                                  >
                                    👤
                                  </button>
                                )}
                                <button
                                  onClick={() => openEdit(u)}
                                  title="Tahrirlash"
                                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-black text-slate-300 transition hover:border-sky-400/40 hover:text-sky-300"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => setConfirmDel({ id: u.id, username: u.username })}
                                  disabled={u.id === user.id}
                                  title={u.id === user.id ? "O'zingizni o'chira olmaysiz" : "O'chirish"}
                                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-black text-slate-300 transition hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobil ro'yxat */}
                  <ul className="divide-y divide-white/5 md:hidden">
                    {paged.map((u) => {
                      const isOpen = openId === (u.id ?? u.username)
                      return (
                        <li key={u.id ?? u.username}>
                          <button
                            onClick={() => setOpenId(isOpen ? null : u.id ?? u.username)}
                            className="flex w-full items-center gap-3 px-4 py-4 text-left"
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColor(
                                u.fullName || 'U'
                              )} text-sm font-black text-white ring-1 ring-white/10`}
                            >
                              {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-slate-100">
                                {u.fullName || u.username}
                                {u.role === 'admin' && (
                                  <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                                    ADMIN
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-slate-600">@{u.username}</p>
                            </div>
                            <span
                              className={`text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            >
                              ▾
                            </span>
                          </button>

                          {isOpen && (
                            <div className="space-y-3 border-t border-white/5 bg-white/[.02] px-4 py-4">
                              <Info label="ID" value={u.id} />
                              <Info label="Email" value={u.email} />
                              <Info label="Phone" value={u.phone} />
                              <Info label="Manzil" value={[u.country, u.region, u.district].filter(Boolean).join(', ')} />
                              <Info label="Ro‘yxatdan o‘tgan" value={fmtDate(u.registeredAt)} />
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                {u.role !== 'admin' && (
                                  <button
                                    onClick={() => handleRoleChange(u.id, 'admin')}
                                    disabled={changingRole === u.id}
                                    className="rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/20 disabled:opacity-40"
                                  >
                                    🛡️ Admin qilish
                                  </button>
                                )}
                                {u.role === 'admin' && u.id !== user.id && (
                                  <button
                                    onClick={() => handleRoleChange(u.id, 'user')}
                                    disabled={changingRole === u.id}
                                    className="rounded-xl bg-white/5 px-3 py-2.5 text-xs font-black text-slate-300 ring-1 ring-white/10 disabled:opacity-40"
                                  >
                                    👤 User qilish
                                  </button>
                                )}
                                <button
                                  onClick={() => openEdit(u)}
                                  className="rounded-xl bg-white/5 px-3 py-2.5 text-xs font-black text-slate-300 ring-1 ring-white/10"
                                >
                                  ✏️ Tahrirlash
                                </button>
                                <button
                                  onClick={() => setConfirmDel({ id: u.id, username: u.username })}
                                  disabled={u.id === user.id}
                                  className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-black text-red-300 ring-1 ring-red-400/20 disabled:opacity-30"
                                >
                                  🗑️ O‘chirish
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  {/* Sahifalash */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
                      <p className="text-xs font-bold text-slate-600">
                        {pageSafe} / {totalPages} sahifa
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={pageSafe <= 1}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black text-slate-400 transition hover:text-white disabled:opacity-30"
                        >
                          ← Oldingi
                        </button>
                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={pageSafe >= totalPages}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black text-slate-400 transition hover:text-white disabled:opacity-30"
                        >
                          Keyingi →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ===== TOKEN HOLATI ===== */}
          {nav === 'storage' && (
            <section>
              <header className="mb-6">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Token holati
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  localStorage'dagi auth ma'lumotlar
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-3">
                <StorageBox
                  label="auth_token"
                  ok={!!localStorage.getItem(TOKEN_KEY)}
                  hint="accessToken (JWT · 1 soat)"
                />
                <StorageBox
                  label="auth_refresh_token"
                  ok={!!localStorage.getItem(REFRESH_KEY)}
                  hint="refreshToken (7 kun)"
                />
                <StorageBox
                  label="auth_user"
                  ok={!!localStorage.getItem('auth_user')}
                  hint="To‘liq user ma’lumoti"
                />
              </div>

              <div className="mt-6 rounded-3xl border border-white/5 bg-black/60 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Eslatma
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Access token muddati 1 soat. Muddati tugasa, frontend o‘zi{' '}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                    POST /api/refresh
                  </code>{' '}
                  bilan yangi token oladi. «Chiqish» bosilsa refresh token serverda bekor qilinadi
                  va localStorage tozalanadi.
                </p>
                <button
                  onClick={logout}
                  className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-300 transition hover:bg-red-500/20"
                >
                  ⏻ Chiqish (logout)
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

// ======================================
// KICHIK KOMPONENTLAR
// ======================================

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-black/60 p-6">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-black tabular-nums ${accent}`}>{value}</span>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-600">
        {label}
      </p>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/[.03] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-slate-200">{value ?? '—'}</p>
    </div>
  )
}

function StorageBox({ label, ok, hint }) {
  return (
    <div
      className={`rounded-3xl border p-5 ${
        ok ? 'border-emerald-400/20 bg-emerald-950/20' : 'border-white/5 bg-black/60'
      }`}
    >
      <p className="flex items-center justify-between gap-2 break-all font-mono text-sm text-slate-300">
        {label}
        <span className={`shrink-0 text-xs font-black ${ok ? 'text-emerald-300' : 'text-slate-600'}`}>
          {ok ? '✅ bor' : '—'}
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-600">{hint}</p>
    </div>
  )
}

// ===== USER QO'SHISH / TAHRIRLASH MODALI =====

function UserFormModal({ mode, values, onChange, onPassportChange, onSubmit, onClose, saving }) {
  const isAdd = mode === 'add'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-8">
      <form
        onSubmit={onSubmit}
        className="my-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5 sm:px-8">
          <div>
            <h3 className="text-xl font-black text-white">
              {isAdd ? '➕ Yangi user qo‘shish' : `✏️ @${values.username} — tahrirlash`}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {isAdd
                ? 'username, fullName va password majburiy'
                : 'Parol bo‘sh qoldirilsa — o‘zgarmaydi'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-black text-slate-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
          <Field name="username" label="Username *" value={values.username} onChange={onChange} icon="👤" />
          <Field name="fullName" label="Full name *" value={values.fullName} onChange={onChange} icon="🪪" />
          <Field name="firstName" label="First name" value={values.firstName} onChange={onChange} />
          <Field name="lastName" label="Last name" value={values.lastName} onChange={onChange} />
          <Field name="middleName" label="Middle name" value={values.middleName} onChange={onChange} />
          <Field name="birthDate" label="Birth date" value={values.birthDate} onChange={onChange} placeholder="2000-01-01" />
          <Field name="email" label="Email" value={values.email} onChange={onChange} type="email" icon="✉️" />
          <Field name="phone" label="Phone" value={values.phone} onChange={onChange} type="tel" icon="📞" />
          <Field name="age" label="Age" value={values.age} onChange={onChange} type="number" />
          <Field name="country" label="Country" value={values.country} onChange={onChange} />
          <Field name="region" label="Region" value={values.region} onChange={onChange} />
          <Field name="district" label="District" value={values.district} onChange={onChange} />
          <Field name="address" label="Address" value={values.address} onChange={onChange} />
          <Field
            name="password"
            label={isAdd ? 'Password *' : 'Yangi parol (bo‘sh = o‘zgarmaydi)'}
            value={values.password}
            onChange={onChange}
            type="password"
            icon="🔒"
          />
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-600">
              Gender
            </span>
            <select
              name="gender"
              value={values.gender}
              onChange={onChange}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-emerald-400/50"
            >
              <option value="">—</option>
              <option value="erkak">Erkak</option>
              <option value="ayol">Ayol</option>
            </select>
          </label>
        </div>

        {/* Pasport */}
        <div className="mx-6 mb-6 rounded-2xl bg-white/[.03] p-5 sm:mx-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            🛂 Pasport (majburiy emas)
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="series" label="Seriyasi" value={values.passport?.series || ''} onChange={onPassportChange} placeholder="AA" />
            <Field name="number" label="Raqami" value={values.passport?.number || ''} onChange={onPassportChange} placeholder="1234567" />
            <Field name="issuedBy" label="Kim tomonidan" value={values.passport?.issuedBy || ''} onChange={onPassportChange} />
            <Field name="issuedDate" label="Berilgan sana" value={values.passport?.issuedDate || ''} onChange={onPassportChange} placeholder="2023-01-10" />
          </div>
        </div>

        <div className="flex gap-3 border-t border-white/5 px-6 py-5 sm:px-8">
          <button
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-60"
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
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-3.5 font-black text-slate-300 transition hover:bg-white/5"
          >
            Bekor qilish
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ name, label, value, onChange, type = 'text', placeholder, icon }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-600">
        {label}
      </span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm opacity-50">
            {icon}
          </span>
        )}
        <input
          name={name}
          value={value ?? ''}
          onChange={onChange}
          type={type}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-white/10 bg-black py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-emerald-400/50 ${
            icon ? 'pl-11 pr-4' : 'px-4'
          }`}
        />
      </div>
    </label>
  )
}
