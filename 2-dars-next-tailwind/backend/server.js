const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

// .env o'sha papkada bo'lsa ham topilsin (Render root'dan ishga tushirsa ham ishlaydi)
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5432;

const JWT_SECRET = process.env.JWT_SECRET || "my_super_secret_key_123456";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "my_refresh_secret_key_987654";

app.use(express.json());

// Express 5 da req.body undefined bo'lmasligi uchun
app.use((req, res, next) => {
    if (!req.body) req.body = {};
    next();
});

// CORS ruxsati (Frontend va mijozlar uchun)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});


// ======================================
// SWAGGER SOZLAMALARI
// ======================================

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "JWT API",
            version: "2.0.0",
            description: "Register, Login, Access Token, Refresh Token, Logout va User API",
        },
        servers: [
            {
                url: "/", // nisbiy URL — Swagger o'zi turgan manzilga so'rov yuboradi (lokal va Render'da ham ishlaydi)
                description: "Joriy server",
            },
            {
                url: `http://localhost:${PORT}`,
                description: "Lokal server (kompyuteringizda server ishga tushirilgan bo'lishi kerak)",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: [path.join(__dirname, "server.js")],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const swaggerUiOptions = {
    // Tokenni sahifa yangilanganda ham saqlab qoladi
    swaggerOptions: { persistAuthorization: true },
};

// Next.js va to'g'ridan-to'g'ri kirishda CSS/JS fayllarini to'g'ri yuklash
const fixAssetUrls = (html, basePath) =>
    html
        .split('href="./')
        .join(`href="${basePath}/`)
        .split('src="./')
        .join(`src="${basePath}/`);

const publicHtml = fixAssetUrls(
    swaggerUi.generateHTML(swaggerSpec, {
        ...swaggerUiOptions,
        customSiteTitle: "JWT API — Userlar",
    }),
    "/api-docs"
);

app.get("/api-docs", (req, res) => res.send(publicHtml));
app.get("/api-docs/", (req, res) => res.send(publicHtml));
app.use("/api-docs", swaggerUi.serveFiles(swaggerSpec, swaggerUiOptions));


// ======================================
// SCHEMA
// ======================================

const userSchema = new mongoose.Schema({
    id: {
        type: Number,
        default: () => Date.now(),
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true
    },
    firstName: String,
    lastName: String,
    middleName: String,
    birthDate: String,
    gender: String,
    country: String,
    region: String,
    district: String,
    address: String,
    phone: String,
    email: String,
    passport: {
        series: String,
        number: String,
        issuedBy: String,
        issuedDate: String
    },
    age: Number,
    registeredAt: String,
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user" // oddiy user — adminlik faqat boshqa admin tomonidan beriladi
    },
    password: {
        type: String,
        required: true
    }
});


// ======================================
// MODEL
// ======================================

const User = mongoose.model("User", userSchema);

// Refresh tokenlar xotirada emas, MongoDB'da saqlanadi
// (server qayta ishga tushsa ham tokenlar yo'qolmaydi)
const refreshTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    userId: Number,
    createdAt: {
        type: Date,
        default: Date.now,
        expires: "7d" // TTL: 7 kundan keyin MongoDB o'zi o'chiradi
    }
});

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);


// ======================================
// MONGODB ULANISH
// ======================================

let dbConnected = false;
let retryTimer = null;

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.log("❌ MONGO_URI env o'zgaruvchisi topilmadi!");
    console.log("   Render → Environment → MONGO_URI=qo'shing yoki repo'da backend/.env borligini tekshiring.");
}

function connectMongo() {
    mongoose
        .connect(MONGO_URI || "", {
            serverSelectionTimeoutMS: 10000,
            dbName: process.env.MONGO_DB || undefined
        })
        .then(() => {
            dbConnected = true;
            console.log("MongoDB ulandi ✅ host:", mongoose.connection.host || "(noma'lum)");
        })
        .catch((error) => {
            dbConnected = false;
            console.log("MongoDB ulanishda xato ❌");
            console.log("Xato nomi:", error.name);
            console.log("Xato:", error.message);
            if (error.message && error.message.includes("authentication")) {
                console.log("→ Parol/username xato yoki maxsus belgilar URL-encode qilinmagan.");
            }
            if (error.name === "MongooseServerSelectionError") {
                console.log("→ Atlas Network Access'da IP ruxsat berilmagan bo'lishi mumkin (0.0.0.0/0 kerak).");
            }
            console.log("→ 10 sekunddan keyin qayta uriniladi...");
            if (!retryTimer) {
                retryTimer = setInterval(() => {
                    if (dbConnected) {
                        clearInterval(retryTimer);
                        retryTimer = null;
                        return;
                    }
                    console.log("MongoDB'ga qayta ulanmoqda...");
                    mongoose.connect(MONGO_URI || "", {
                        serverSelectionTimeoutMS: 10000,
                        dbName: process.env.MONGO_DB || undefined
                    }).catch(() => {}); // xatoni interval o'zi ko'radi, jim davom etadi
                }, 10000);
            }
        });
}

connectMongo();

// Ulanish uzilib qolsa ham holatni yangilab boradi
mongoose.connection.on("disconnected", () => { dbConnected = false; });
mongoose.connection.on("connected", () => { dbConnected = true; });

// Holatni tekshirish uchun oddiy endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        ok: true,
        mongodb: dbConnected ? "ulangan ✅" : "ulanmagan ❌",
        mongoUriSet: Boolean(process.env.MONGO_URI),
        time: new Date().toISOString()
    });
});


// ======================================
// REGISTER
// ======================================

/**
 * @openapi
 * /register:
 *   post:
 *     summary: Yangi user yaratish
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - fullName
 *               - firstName
 *               - lastName
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: sardor_uz
 *               fullName:
 *                 type: string
 *                 example: Sardor Nazarov
 *               firstName:
 *                 type: string
 *                 example: Sardor
 *               lastName:
 *                 type: string
 *                 example: Nazarov
 *               middleName:
 *                 type: string
 *                 example: Baxtiyor o‘g‘li
 *               birthDate:
 *                 type: string
 *                 example: 2002-12-01
 *               gender:
 *                 type: string
 *                 example: erkak
 *               country:
 *                 type: string
 *                 example: O‘zbekiston
 *               region:
 *                 type: string
 *                 example: Toshkent viloyati
 *               district:
 *                 type: string
 *                 example: Zangiota tumani
 *               address:
 *                 type: string
 *                 example: Yangi hayot ko‘chasi, 33-uy
 *               phone:
 *                 type: string
 *                 example: "+998994045060"
 *               email:
 *                 type: string
 *                 example: sardor@example.com
 *               passport:
 *                 type: object
 *                 properties:
 *                   series:
 *                     type: string
 *                     example: AD
 *                   number:
 *                     type: string
 *                     example: 2468135
 *                   issuedBy:
 *                     type: string
 *                     example: Toshkent viloyati IIB
 *                   issuedDate:
 *                     type: string
 *                     example: 2023-01-10
 *               age:
 *                 type: integer
 *                 example: 23
 *               password:
 *                 type: string
 *                 example: test1234
 *     responses:
 *       201:
 *         description: User yaratildi ✅
 *       400:
 *         description: Majburiy maydonlar kiritilmagan
 *       409:
 *         description: Bu username allaqachon mavjud
 *       500:
 *         description: User yaratishda xato
 */
app.post("/register", async (req, res) => {
    try {
        const {
            username,
            fullName,
            firstName,
            lastName,
            middleName,
            birthDate,
            gender,
            country,
            region,
            district,
            address,
            phone,
            email,
            passport,
            age,
            password
        } = req.body;

        // 1) Majburiy maydonlar tekshiriladi (400)
        if (!username || !fullName || !firstName || !lastName || !password) {
            return res.status(400).json({
                message: "username, fullName, firstName, lastName va password majburiy"
            });
        }

        // 2) Duplikat username — aniq 409 xato
        const existing = await User.findOne({ username: username.trim() });
        if (existing) {
            return res.status(409).json({
                message: "Bu username allaqachon mavjud"
            });
        }

        // 3) Parol bcrypt bilan hashlanadi (ochiq saqlanmaydi)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4) Faqat ruxsat etilgan maydonlar DB'ga yoziladi (whitelist)
        const user = await User.create({
            id: Date.now(),
            username: String(username).trim(),
            fullName,
            firstName,
            lastName,
            // role register orqali berilmaydi — yangi user doim "user"
            role: "user",
            middleName,
            birthDate,
            gender,
            country,
            region,
            district,
            address,
            phone,
            email,
            passport,
            age: age !== undefined && age !== null && age !== "" ? Number(age) : undefined,
            registeredAt: new Date().toISOString().split("T")[0], // avtomatik
            password: hashedPassword
        });

        res.status(201).json({
            message: "User yaratildi ✅",
            user: {
                ...user.toObject(),
                password: undefined // parol javobda qaytmaydi
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "User yaratishda xato",
            error: error.message
        });
    }
});


// ======================================
// LOGIN
// ======================================

/**
 * @openapi
 * /login:
 *   post:
 *     summary: Login va JWT token olish
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: ali_uz
 *               password:
 *                 type: string
 *                 example: test1234
 *     responses:
 *       200:
 *         description: Login muvaffaqiyatli ✅
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                   description: Shu tokenni Swagger'dagi "Authorize" tugmasiga qo'ying
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Username yoki passwordni kiriting
 *       401:
 *         description: Username yoki password noto‘g‘ri
 */
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username yoki passwordni kiriting"
            });
        }

        // MongoDB'dan user qidiramiz
        const user = await User.findOne({
            username: username
        });

        if (!user) {
            return res.status(401).json({
                message: "Username yoki password noto‘g‘ri"
            });
        }

        // Password bcrypt hash bilan tekshiriladi
        const passwordOk = await bcrypt.compare(password, user.password);

        if (!passwordOk) {
            return res.status(401).json({
                message: "Username yoki password noto‘g‘ri"
            });
        }

        // Access token yaratamiz
        // role ham token ichiga yoziladi — adminMiddleware buni tekshiradi
        // (eski tokenlarda role bo'lmasa, middleware DB'dan qaraydi)
        const accessToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        // Refresh token yaratamiz
        // jti — noyob ID: bir sekundda ikki marta login qilinsa ham tokenlar farq qiladi
        const refreshToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
                jti: `${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
            },
            JWT_REFRESH_SECRET,
            {
                expiresIn: "7d"
            }
        );

        // Refresh token MongoDB'ga yoziladi (server restart bo'lsa ham ishlaydi)
        await RefreshToken.create({
            token: refreshToken,
            userId: user.id
        });

        res.status(200).json({
            message: "Login muvaffaqiyatli ✅",
            accessToken,
            refreshToken
        });
    } catch (error) {
        res.status(500).json({
            message: "Login xatosi",
            error: error.message
        });
    }
});


// ======================================
// REFRESH TOKEN
// ======================================

/**
 * @openapi
 * /refresh:
 *   post:
 *     summary: Access tokenni yangilash
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token yangilandi
 *       401:
 *         description: Refresh token mavjud emas
 *       403:
 *         description: Refresh token noto'g'ri
 */
app.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({
            message: "Refresh token mavjud emas"
        });
    }

    // Token bazada bor-yo'qligi tekshiriladi (logout qilingan token ishlamaydi)
    const stored = await RefreshToken.findOne({ token: refreshToken });

    if (!stored) {
        return res.status(403).json({
            message: "Refresh token noto‘g‘ri"
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // Rol DB'dan olinadi — foydalanuvchi admin bo'lsa/token eskirgan bo'lsa ham
        // yangi access token doim to'g'ri rol bilan chiqadi
        const dbUser = await User.findOne({ id: decoded.id }).select("role");

        const newAccessToken = jwt.sign(
            {
                id: decoded.id,
                username: decoded.username,
                role: dbUser?.role || "user"
            },
            JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        return res.status(200).json({
            message: "Access token yangilandi",
            accessToken: newAccessToken
        });
    } catch (error) {
        // Muddati tugagan token bazadan ham o'chiriladi
        await RefreshToken.deleteOne({ token: refreshToken });

        return res.status(403).json({
            message: "Refresh token noto‘g‘ri yoki muddati tugagan"
        });
    }
});


// ======================================
// LOGOUT
// ======================================

/**
 * @openapi
 * /logout:
 *   post:
 *     summary: Logout — refresh tokenni bekor qilish
 *     description: Frontend "Chiqish" bosilganda shu endpointga refreshToken'ni yuboradi, server uni bazadan o'chiradi.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout muvaffaqiyatli
 *       401:
 *         description: Refresh token mavjud emas
 */
app.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({
            message: "Refresh token mavjud emas"
        });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    res.status(200).json({
        message: "Logout muvaffaqiyatli ✅"
    });
});


// ======================================
// JWT MIDDLEWARE
// ======================================

// Adminlik tekshiruvi: authMiddleware'dan KEYIN ishlatiladi
function adminMiddleware(req, res, next) {
    // Token ichidagi role yangi tokenlarda bor; eski tokenlarda bo'lmasa DB'dan tekshiramiz
    const check = async () => {
        if (req.user.role === "admin") return next();

        const dbUser = await User.findOne({ id: req.user.id }).select("role");
        if (dbUser && dbUser.role === "admin") {
            req.user.role = "admin";
            return next();
        }

        return res.status(403).json({
            message: "Faqat adminlar uchun! Sizda ruxsat yo‘q"
        });
    };

    check().catch(() =>
        res.status(500).json({ message: "Adminlikni tekshirishda xato" })
    );
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Authorization token mavjud emas"
        });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            message: "Authorization formati noto‘g‘ri (Bearer token bo'lishi kerak)"
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Token noto‘g‘ri yoki muddati tugagan"
        });
    }
}


// ======================================
// ME
// ======================================

/**
 * @openapi
 * /me:
 *   get:
 *     summary: Login qilgan user ma'lumotlarini olish
 *     description: Yuqoridagi "Authorize" tugmasini bosing va login'dan olingan accessToken'ni qo'ying.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User ma'lumotlari
 *       401:
 *         description: Token noto‘g‘ri yoki muddati tugagan
 *       404:
 *         description: User topilmadi
 */
app.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({
            id: req.user.id
        }).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User topilmadi"
            });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({
            message: "Xatolik",
            error: error.message
        });
    }
});


// ======================================
// ALL USERS (JWT bilan himoyalangan)
// ======================================

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Barcha userlarni olish — FAQAT ADMIN uchun
 *     description: Authorize tugmasi orqali admin accessToken kiritish shart. Oddiy user 403 oladi.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Barcha userlar ro'yxati (parolsiz, 100% to'liq ma'lumot)
 *       401:
 *         description: Token noto‘g‘ri yoki muddati tugagan
 *       403:
 *         description: Faqat adminlar ko'ra oladi
 *       500:
 *         description: Userlarni olishda xato
 */
app.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User
            .find()
            .select("-password");

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({
            message: "Userlarni olishda xato",
            error: error.message
        });
    }
});


// ======================================
// UPDATE ROLE (faqat ADMIN) — boshqa userlarga adminlik berish/olish
// ======================================

/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     summary: User rolini o'zgartirish — FAQAT ADMIN uchun
 *     description: Admin boshqa userga adminlik beradi yoki oladi. O'ziga o'zi adminlikni olib qo'ymasligi himoyalangan.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: Userning numeric id si (masalan 1)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: admin
 *     responses:
 *       200:
 *         description: Rol o'zgartirildi
 *       400:
 *         description: role noto'g'ri yoki o'zini o'zi o'zgartirmoqchi
 *       401:
 *         description: Token noto‘g‘ri
 *       403:
 *         description: Faqat adminlar uchun
 *       404:
 *         description: User topilmadi
 */
app.patch("/users/:id/role", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { role } = req.body;
        const targetId = Number(req.params.id);

        if (!role || !["user", "admin"].includes(role)) {
            return res.status(400).json({
                message: "role faqat 'user' yoki 'admin' bo'lishi mumkin"
            });
        }

        if (Number(req.user.id) === targetId) {
            return res.status(400).json({
                message: "O'zingizga o'zingiz rol o'zgartira olmaysiz"
            });
        }

        const target = await User.findOne({ id: targetId });

        if (!target) {
            return res.status(404).json({
                message: "User topilmadi"
            });
        }

        target.role = role;
        await target.save();

        res.status(200).json({
            message: `@${target.username} endi ${role === "admin" ? "ADMIN 🛡️" : "oddiy user"} bo'ldi`,
            user: { ...target.toObject(), password: undefined }
        });
    } catch (error) {
        res.status(500).json({
            message: "Rolni o'zgartirishda xato",
            error: error.message
        });
    }
});


// ======================================
// GET /users/:id (faqat ADMIN) — bitta userni olish
// ======================================

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Bitta userni olish — FAQAT ADMIN uchun
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: Userning numeric id si (masalan 1)
 *     responses:
 *       200:
 *         description: User ma'lumotlari (parolsiz)
 *       401:
 *         description: Token noto‘g‘ri
 *       403:
 *         description: Faqat adminlar uchun
 *       404:
 *         description: User topilmadi
 */
app.get("/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: Number(req.params.id) }).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User topilmadi" });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({
            message: "Userni olishda xato",
            error: error.message
        });
    }
});


// ======================================
// POST /users (faqat ADMIN) — admin yangi user yaratadi
// (register'dan farqi: admin rolni ham belgilay oladi)
// ======================================

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Yangi user yaratish — FAQAT ADMIN uchun
 *     description: Admin yangi user yaratadi va xohlasa rolini darhol belgilay oladi.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - fullName
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: yangi_user
 *               fullName:
 *                 type: string
 *                 example: Yangi User
 *               password:
 *                 type: string
 *                 example: test1234
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: user
 *               email:
 *                 type: string
 *                 example: yangi@example.com
 *     responses:
 *       201:
 *         description: User yaratildi
 *       400:
 *         description: Majburiy maydonlar kiritilmagan
 *       401:
 *         description: Token noto‘g‘ri
 *       403:
 *         description: Faqat adminlar uchun
 *       409:
 *         description: Bu username allaqachon mavjud
 */
app.post("/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            username, fullName, firstName, lastName, middleName, birthDate, gender,
            country, region, district, address, phone, email, passport, age,
            password, role
        } = req.body;

        if (!username || !fullName || !password) {
            return res.status(400).json({
                message: "username, fullName va password majburiy"
            });
        }

        const existing = await User.findOne({ username: String(username).trim() });
        if (existing) {
            return res.status(409).json({ message: "Bu username allaqachon mavjud" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            id: Date.now(),
            username: String(username).trim(),
            fullName,
            firstName,
            lastName,
            middleName,
            birthDate,
            gender,
            country,
            region,
            district,
            address,
            phone,
            email,
            passport,
            age: age !== undefined && age !== null && age !== "" ? Number(age) : undefined,
            role: role === "admin" ? "admin" : "user", // admin belgilay oladi
            registeredAt: new Date().toISOString().split("T")[0],
            password: hashedPassword
        });

        res.status(201).json({
            message: "User yaratildi ✅",
            user: { ...user.toObject(), password: undefined }
        });
    } catch (error) {
        res.status(500).json({
            message: "User yaratishda xato",
            error: error.message
        });
    }
});


// ======================================
// PUT /users/:id (faqat ADMIN) — userni to'liq tahrirlash
// (parol berilsa hashlanadi; role ham o'zgartiriladi)
// ======================================

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Userni to'liq tahrirlash — FAQAT ADMIN uchun
 *     description: Admin boshqa user ma'lumotlarini yangilaydi. Parol berilsa bcrypt bilan hashlanadi. O'z rolini o'zi o'zgartirmasligi himoyalangan.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Ali Valiyev (yangilangan)
 *               email:
 *                 type: string
 *                 example: yangi@example.com
 *               password:
 *                 type: string
 *                 example: yangi_parol_123
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       200:
 *         description: User yangilandi
 *       400:
 *         description: Noto'g'ri so'rov (o'zini o'zi o'zgartirish va h.k.)
 *       401:
 *         description: Token noto‘g‘ri
 *       403:
 *         description: Faqat adminlar uchun
 *       404:
 *         description: User topilmadi
 *       409:
 *         description: Yangi username allaqachon mavjud
 */
app.put("/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const target = await User.findOne({ id: targetId });

        if (!target) {
            return res.status(404).json({ message: "User topilmadi" });
        }

        const {
            username, fullName, firstName, lastName, middleName, birthDate, gender,
            country, region, district, address, phone, email, passport, age,
            password, role
        } = req.body;

        // O'z rolini o'zi o'zgartirmoqchi bo'lsa — bloklaymiz
        if (Number(req.user.id) === targetId && role !== undefined && role !== target.role) {
            return res.status(400).json({
                message: "O'zingizga o'zingiz rol o'zgartira olmaysiz"
            });
        }

        // Username o'zgarsa — duplikat tekshiriladi
        if (username !== undefined && String(username).trim() !== target.username) {
            const existing = await User.findOne({ username: String(username).trim() });
            if (existing) {
                return res.status(409).json({ message: "Bu username allaqachon mavjud" });
            }
            target.username = String(username).trim();
        }

        // Maydonlar berilgan bo'lsa yangilanadi (whitelist)
        if (fullName !== undefined) target.fullName = fullName;
        if (firstName !== undefined) target.firstName = firstName;
        if (lastName !== undefined) target.lastName = lastName;
        if (middleName !== undefined) target.middleName = middleName;
        if (birthDate !== undefined) target.birthDate = birthDate;
        if (gender !== undefined) target.gender = gender;
        if (country !== undefined) target.country = country;
        if (region !== undefined) target.region = region;
        if (district !== undefined) target.district = district;
        if (address !== undefined) target.address = address;
        if (phone !== undefined) target.phone = phone;
        if (email !== undefined) target.email = email;
        if (passport !== undefined) target.passport = passport;
        if (age !== undefined && age !== null && age !== "") target.age = Number(age);

        // Parol berilsa hashlanadi
        if (password) {
            target.password = await bcrypt.hash(password, 10);
        }

        // Rol o'zgarsa (o'zidan boshqa user uchun)
        if (role !== undefined && Number(req.user.id) !== targetId) {
            if (!["user", "admin"].includes(role)) {
                return res.status(400).json({
                    message: "role faqat 'user' yoki 'admin' bo'lishi mumkin"
                });
            }
            target.role = role;
        }

        await target.save();

        res.status(200).json({
            message: "User yangilandi ✅",
            user: { ...target.toObject(), password: undefined }
        });
    } catch (error) {
        res.status(500).json({
            message: "Userni yangilashda xato",
            error: error.message
        });
    }
});


// ======================================
// DELETE /users/:id (faqat ADMIN) — userni o'chirish
// (o'zini o'zi o'chira olmaydi)
// ======================================

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Userni o'chirish — FAQAT ADMIN uchun
 *     description: Admin boshqa user'ni o'chiradi. O'zini o'zi o'chirish himoyalangan.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: User o'chirildi
 *       400:
 *         description: O'zini o'zi o'chira olmaydi
 *       401:
 *         description: Token noto‘g‘ri
 *       403:
 *         description: Faqat adminlar uchun
 *       404:
 *         description: User topilmadi
 */
app.delete("/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const targetId = Number(req.params.id);

        if (Number(req.user.id) === targetId) {
            return res.status(400).json({
                message: "O'zingizni o'zingiz o'chira olmaysiz"
            });
        }

        const deleted = await User.findOneAndDelete({ id: targetId });

        if (!deleted) {
            return res.status(404).json({ message: "User topilmadi" });
        }

        // O'chirilgan userning refresh tokenlarini ham bekor qilamiz
        await RefreshToken.deleteMany({ userId: targetId });

        res.status(200).json({
            message: `@${deleted.username} o'chirildi 🗑️`
        });
    } catch (error) {
        res.status(500).json({
            message: "Userni o'chirishda xato",
            error: error.message
        });
    }
});


// Bosh sahifa Swagger ga yo'naltiradi
app.get("/", (req, res) => {
    res.redirect("/api-docs");
});


// ======================================
// SERVER
// ======================================

app.listen(PORT, () => {
    console.log(`Project running: http://localhost:${PORT}`);
    console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});
