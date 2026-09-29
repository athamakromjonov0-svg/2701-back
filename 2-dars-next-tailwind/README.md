# 2-dars — Next.js + Tailwind + Express

Siz yuborgan `2-dars` backend frontendga ulandi.

## Tuzilishi

```text
2-dars-next-tailwind/
├── backend/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── next.config.mjs
│   └── package.json
└── package.json
```

## Backend

Terminal 1:

```bash
cd backend
npm install
npm start
```

Backend `http://localhost:5432` da ishlaydi.

## Frontend

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Frontend `http://localhost:3000` da ishlaydi.

## API ulanishi

Frontend:
- `POST /api/login`
- `POST /api/register`

Next.js rewrite bu so‘rovlarni Express backendga yuboradi:

```text
/api/login    -> http://localhost:5432/login
/api/register -> http://localhost:5432/register
```

Shuning uchun browser tarafida CORS muammosi bo‘lmaydi.

## Test login

```text
Username: ali_uz
Password: test1234
```

## Admin tizimi

- Yangi register qilingan user doim oddiy `user` bo'ladi.
- Adminlik berish uchun bir marta terminalda:

```bash
cd backend
node promote-admin.js ali_uz
```

- Admin login qilsa, "Foydalanuvchilar" ro'yxati ochiladi va har bir user qatorini ochib "Admin qilish" / "Oddiy user qilish" tugmalari bilan rol boshqariladi (`PATCH /users/:id/role`).
- Admin o'ziga o'zi rol o'zgartira olmaydi (backend himoyalangan).
- Rol o'zgarsa tokenlarga ham aks etadi: login va `/refresh` da rol doim DB'dan yangilanadi.

## Admin panel (/admin)

Adminlar uchun alohida qora admin panel mavjud: `http://localhost:3000/admin`

- Kabinet header'ida **👑 Admin panel** tugmasi orqali ochiladi (faqat adminlarda ko'rinadi).
- **Dashboard** — statistika kartalari (jami userlar, adminlar, oddiy userlar, pasport kiritganlar), oxirgi userlar va tezkor amallar.
- **Userlar** — jadval ko'rinishida: qidiruv (ism/username/email/phone), rol bo'yicha filtr, sahifalash.
- **CRUD** — user qo'shish (POST /users), tahrirlash (PUT /users/:id), o'chirish (DELETE /users/:id, tasdiqlash modali bilan).
- **Rol boshqaruvi** — jadvalda bir klik bilan admin/user qilish (`PATCH /users/:id/role`).
- **Token holati** — localStorage'dagi auth kalitlari holati.
- Admin bo'lmagan user `/admin` ga kirsа — avtomatik kabinetga qaytariladi.
