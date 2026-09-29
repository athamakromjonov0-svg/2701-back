module.exports = {
  openapi: "3.0.0",
  info: {
    title: "User Auth API",
    version: "1.0.0",
    description: "MongoDB bilan ishlaydigan Register, Login, Me va Users API"
  },
  servers: [
    {
      url: "http://localhost:5432",
      description: "Local Backend Server"
    }
  ],
  components: {
    securitySchemes: {  
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT tokenni shu yerga kiriting (Bearer so'zisiz)"
      }
    }
  },
  paths: {
    "/register": {
      post: {
        summary: "Yangi user ro'yxatdan o'tkazish (Register)",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "fullName", "password"],
                properties: {
                  id: { type: "number", example: 1 },
                  username: { type: "string", example: "ali_uz" },
                  fullName: { type: "string", example: "Ali Valiyev" },
                  firstName: { type: "string", example: "Ali" },
                  lastName: { type: "string", example: "Valiyev" },
                  middleName: { type: "string", example: "Karim o'g'li" },
                  birthDate: { type: "string", example: "2000-01-01" },
                  gender: { type: "string", example: "erkak" },
                  country: { type: "string", example: "O'zbekiston" },
                  region: { type: "string", example: "Toshkent" },
                  district: { type: "string", example: "Chilonzor" },
                  address: { type: "string", example: "Muqimiy ko'chasi, 12-uy" },
                  phone: { type: "string", example: "+998901234567" },
                  email: { type: "string", example: "ali@example.com" },
                  passport: {
                    type: "object",
                    properties: {
                      series: { type: "string", example: "AA" },
                      number: { type: "string", example: "1234567" },
                      issuedBy: { type: "string", example: "Toshkent shahar IIB" },
                      issuedDate: { type: "string", example: "2018-05-10" }
                    }
                  },
                  age: { type: "number", example: 24 },
                  registeredAt: { type: "string", example: "2026-09-22" },
                  password: { type: "string", example: "test1234" }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "User muvaffaqiyatli yaratildi"
          },
          500: {
            description: "User yaratishda xato"
          }
        }
      }
    },
    "/login": {
      post: {
        summary: "Tizimga kirish (Login)",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "ali_uz" },
                  password: { type: "string", example: "test1234" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Login muvaffaqiyatli va JWT token qaytadi"
          },
          400: {
            description: "Username yoki password kiritilmagan"
          },
          401: {
            description: "Username yoki password noto'g'ri"
          },
          500: {
            description: "Login xatosi"
          }
        }
      }
    },
    "/me": {
      get: {
        summary: "Joriy user ma'lumotlarini olish (JWT token bilan)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Foydalanuvchi ma'lumotlari"
          },
          401: {
            description: "Token noto'g'ri yoki muddati tugagan"
          },
          404: {
            description: "User topilmadi"
          },
          500: {
            description: "Server xatosi"
          }
        }
      }
    },
    "/users": {
      get: {
        summary: "Barcha foydalanuvchilar ro'yxatini olish",
        tags: ["Users"],
        responses: {
          200: {
            description: "Userlar ro'yxati (parolsiz)"
          },
          500: {
            description: "Userlarni olishda xato"
          }
        }
      }
    }
  }
};
