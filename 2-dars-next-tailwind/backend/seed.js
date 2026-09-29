const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

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
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model("User", userSchema);

async function seedDatabase() {
    try {
        console.log("MongoDB-ga ulanmoqda...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB ulandi ✅");

        // Mavjud userni tekshirish
        const existing = await User.findOne({ username: "ali_uz" });
        if (existing) {
            console.log("\n Foydalanuvchi allaqachon mavjud:");
            console.log(existing);
        } else {
            const newUser = await User.create({
                id: 1,
                username: "ali_uz",
                fullName: "Ali Valiyev",
                firstName: "Ali",
                lastName: "Valiyev",
                middleName: "Karim o'g'li",
                birthDate: "2000-01-01",
                gender: "erkak",
                country: "O'zbekiston",
                region: "Toshkent",
                district: "Chilonzor",
                address: "Muqimiy ko'chasi, 12-uy",
                phone: "+998901234567",
                email: "ali@example.com",
                passport: {
                    series: "AA",
                    number: "1234567",
                    issuedBy: "Toshkent shahar IIB",
                    issuedDate: "2018-05-10"
                },
                age: 24,
                registeredAt: new Date().toISOString().split("T")[0],
                password: await bcrypt.hash("test1234", 10) // hash bilan saqlanadi
            });

            console.log("\n Yangi database user yaratildi va chiqarildi ✅:");
            console.log(newUser);
        }

        const allUsers = await User.find().select("-password");
        console.log("\n Bazadagi barcha userlar ro'yxati:");
        console.log(JSON.stringify(allUsers, null, 2));

    } catch (err) {
        console.error("Xatolik:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("\n MongoDB ulanishi yopildi.");
    }
}

seedDatabase();
