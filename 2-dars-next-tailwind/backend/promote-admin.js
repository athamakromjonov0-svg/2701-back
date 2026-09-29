// Bir userga adminlik berish (bir martalik utility)
// Ishlatish: node promote-admin.js ali_uz

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
require("dotenv").config();

const userSchema = new mongoose.Schema(
    { id: Number, username: String, role: String },
    { collection: "users", strict: false }
);

const User = mongoose.model("User", userSchema);

const username = process.argv[2];

async function promote() {
    try {
        if (!username) {
            console.log("Foydalanish: node promote-admin.js <username>");
            return;
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB ulandi ✅");

        const user = await User.findOne({ username });

        if (!user) {
            console.log(`@${username} topilmadi ❌`);
            return;
        }

        user.role = "admin";
        await user.save();

        console.log(`@${username} endi ADMIN 🛡️`);
    } catch (err) {
        console.error("Xatolik:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB ulanishi yopildi.");
    }
}

promote();
