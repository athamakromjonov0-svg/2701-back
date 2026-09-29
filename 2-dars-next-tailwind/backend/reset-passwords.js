// Barcha userlar parolini "test1234" ga o'rnatadi (bcrypt hash bilan)
// Ishlatish: node reset-passwords.js

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

const userSchema = new mongoose.Schema(
    {
        id: Number,
        username: String,
        password: String
    },
    { collection: "users", strict: false }
);

const User = mongoose.model("User", userSchema);

const NEW_PASSWORD = "test1234";

async function resetPasswords() {
    try {
        console.log("MongoDB-ga ulanmoqda...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB ulandi ✅\n");

        const users = await User.find();
        console.log(`Jami ${users.length} ta user topildi.\n`);

        const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

        for (const user of users) {
            user.password = hashed;
            await user.save();
            console.log(`@${user.username} — parol "test1234" qilib o'rnatildi ✅`);
        }

        console.log(`\nTugadi ✅ Hamma userlar endi "test1234" paroli bilan login qila oladi.`);
    } catch (err) {
        console.error("Xatolik:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB ulanishi yopildi.");
    }
}

resetPasswords();
