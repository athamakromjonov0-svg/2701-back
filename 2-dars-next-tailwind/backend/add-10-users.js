// 10 ta test userini qo'shish (bir martalik utility)
// Ishlatish: node add-10-users.js

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

// server.js'dagi schema bilan bir xil
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
        default: "user"
    },
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model("User", userSchema);

// Barcha parollar: test1234
const users = [
    { id: 11, username: "dilnoza_k", fullName: "Dilnoza Karimova", firstName: "Dilnoza", lastName: "Karimova", middleName: "Alisher qizi", birthDate: "2001-03-15", gender: "ayol", country: "O'zbekiston", region: "Toshkent shahri", district: "Yunusobod", address: "Amir Temur ko'chasi, 5-uy", phone: "+998901112233", email: "dilnoza@example.com", passport: { series: "AB", number: "1112233", issuedBy: "Toshkent shahar IIB", issuedDate: "2019-06-20" }, age: 24 },
    { id: 12, username: "javohir_t", fullName: "Javohir Toshmatov", firstName: "Javohir", lastName: "Toshmatov", middleName: "O'tkir o'g'li", birthDate: "1999-07-22", gender: "erkak", country: "O'zbekiston", region: "Samarqand", district: "Registon tumani", address: "Mustaqillik ko'chasi, 18-uy", phone: "+998902223344", email: "javohir@example.com", passport: { series: "AC", number: "2223344", issuedBy: "Samarqand viloyati IIB", issuedDate: "2018-02-11" }, age: 26 },
    { id: 13, username: "aziza_r", fullName: "Aziza Rasulova", firstName: "Aziza", lastName: "Rasulova", middleName: "Farrux qizi", birthDate: "2003-11-05", gender: "ayol", country: "O'zbekiston", region: "Buxoro", district: "Ark tumani", address: "Navoiy ko'chasi, 7-uy", phone: "+998903334455", email: "aziza@example.com", passport: { series: "AD", number: "3334455", issuedBy: "Buxoro viloyati IIB", issuedDate: "2021-09-14" }, age: 22 },
    { id: 14, username: "sardor_y", fullName: "Sardor Yusupov", firstName: "Sardor", lastName: "Yusupov", middleName: "Bekzod o'g'li", birthDate: "1998-01-30", gender: "erkak", country: "O'zbekiston", region: "Farg'ona", district: "Qo'qon tumani", address: "Chorsu ko'chasi, 21-uy", phone: "+998904445566", email: "sardor@example.com", passport: { series: "AE", number: "4445566", issuedBy: "Farg'ona viloyati IIB", issuedDate: "2017-04-25" }, age: 27 },
    { id: 15, username: "nilufar_s", fullName: "Nilufar Saidova", firstName: "Nilufar", lastName: "Saidova", middleName: "Rustam qizi", birthDate: "2002-05-12", gender: "ayol", country: "O'zbekiston", region: "Andijon", district: "Bog'ishamol tumani", address: "Bobur ko'chasi, 3-uy", phone: "+998905556677", email: "nilufar@example.com", passport: { series: "AF", number: "5556677", issuedBy: "Andijon viloyati IIB", issuedDate: "2020-08-30" }, age: 23 },
    { id: 16, username: "bektosh_n", fullName: "Bektosh Nazarov", firstName: "Bektosh", lastName: "Nazarov", middleName: "Sohib o'g'li", birthDate: "2000-09-09", gender: "erkak", country: "O'zbekiston", region: "Namangan", district: "Chust tumani", address: "Do'stlik ko'chasi, 44-uy", phone: "+998906667788", email: "bektosh@example.com", passport: { series: "AG", number: "6667788", issuedBy: "Namangan viloyati IIB", issuedDate: "2019-01-17" }, age: 25 },
    { id: 17, username: "kamola_u", fullName: "Kamola Umarova", firstName: "Kamola", lastName: "Umarova", middleName: "Jasur qizi", birthDate: "2004-02-28", gender: "ayol", country: "O'zbekiston", region: "Xorazm", district: "Urganch tumani", address: "Xorazm ko'chasi, 9-uy", phone: "+998907778899", email: "kamola@example.com", passport: { series: "AH", number: "7778899", issuedBy: "Xorazm viloyati IIB", issuedDate: "2022-03-05" }, age: 21 },
    { id: 18, username: "otabek_m", fullName: "Otabek Mirzayev", firstName: "Otabek", lastName: "Mirzayev", middleName: "Anvar o'g'li", birthDate: "1997-12-01", gender: "erkak", country: "O'zbekiston", region: "Qashqadaryo", district: "Shahrisabz tumani", address: "Temur ko'chasi, 15-uy", phone: "+998908889900", email: "otabek@example.com", passport: { series: "AJ", number: "8889900", issuedBy: "Qashqadaryo viloyati IIB", issuedDate: "2016-10-08" }, age: 28 },
    { id: 19, username: "zilola_x", fullName: "Zilola Xolmatova", firstName: "Zilola", lastName: "Xolmatova", middleName: "Doston qizi", birthDate: "2001-08-18", gender: "ayol", country: "O'zbekiston", region: "Surxondaryo", district: "Termiz tumani", address: "Amudaryo ko'chasi, 27-uy", phone: "+998909990011", email: "zilola@example.com", passport: { series: "AK", number: "9990011", issuedBy: "Surxondaryo viloyati IIB", issuedDate: "2020-05-19" }, age: 24 },
    { id: 20, username: "shohruh_z", fullName: "Shohruh Zokirov", firstName: "Shohruh", lastName: "Zokirov", middleName: "Ilhom o'g'li", birthDate: "1996-04-04", gender: "erkak", country: "O'zbekiston", region: "Navoiy", district: "Zarafshon tumani", address: "Konchilar ko'chasi, 31-uy", phone: "+998910001122", email: "shohruh@example.com", passport: { series: "AL", number: "1001122", issuedBy: "Navoiy viloyati IIB", issuedDate: "2015-11-23" }, age: 29 }
];

async function addUsers() {
    try {
        console.log("MongoDB-ga ulanmoqda...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB ulandi ✅");

        let created = 0;
        let skipped = 0;

        for (const u of users) {
            const existing = await User.findOne({ username: u.username });

            if (existing) {
                console.log(`⏭️  @${u.username} allaqachon mavjud — o'tkazib yuborildi`);
                skipped++;
                continue;
            }

            await User.create({
                ...u,
                role: "user",
                registeredAt: new Date().toISOString().split("T")[0],
                password: await bcrypt.hash("test1234", 10)
            });

            console.log(`✅ @${u.username} yaratildi (parol: test1234)`);
            created++;
        }

        console.log(`\nTayyor! ${created} ta user yaratildi, ${skipped} ta allaqachon bor edi.`);

        const total = await User.countDocuments();
        console.log(`Bazada jami ${total} ta user bor.`);
    } catch (err) {
        console.error("Xatolik:", err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB ulanishi yopildi.");
    }
}

addUsers();
