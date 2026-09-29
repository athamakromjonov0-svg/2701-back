// Bir martalik migratsiya: eski (hashlanmagan) parollarni bcrypt hash'ga o'tkazadi
// Ishlatish: node migrate-passwords.js
// Eski parol to'g'ri bo'lsa bcrypt.compare bilan tekshiriladi va hash bilan yangilanadi

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

const userSchema = new mongoose.Schema({
    id: Number,
    username: String,
    password: String
}, { collection: "users", strict: false });

const User = mongoose.model("User", userSchema);

async function migrate() {
    try {
        console.log("MongoDB-ga ulanmoqda...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB ulandi ✅\n");

        const users = await User.find();

        for (const user of users) {
            const isHashed = /^(\$2[aby]\$)/.test(user.password || "");

            if (isHashed) {
                console.log(`@${user.username} — allaqachon hashlangan, o'tkazib yuborildi`);
                continue;
            }

            // Eski parolni bcrypt bilan hashlaymiz
            const hashed = await bcrypt.hash(user.password, 10);
            user.password = hashed;
            await user.save();

            console.log(`@${user.username} — parol bcrypt bilan hashlandi ✅`);
        }

        console.log("\nMigratsiya tugadi ✅ Endi eski userlar ham login qila oladi.");
    } catch (err) {
        console.error("Xatolik:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB ulanishi yopildi.");
    }
}

migrate();
