require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');

async function makeAdmin() {
    try {
        // الاتصال بـ MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // اطلب email أو username
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('أدخل Email أو Username للمستخدم: ', async (identifier) => {
            try {
                // ابحث عن المستخدم
                const user = await User.findOne({
                    $or: [
                        { email: identifier },
                        { username: identifier }
                    ]
                });

                if (!user) {
                    console.log('❌ المستخدم غير موجود!');
                    process.exit(1);
                }

                // اجعله admin
                user.isAdmin = true;
                await user.save();

                console.log('✅ تم! المستخدم الآن Admin:');
                console.log(`   Username: ${user.username}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   isAdmin: ${user.isAdmin}`);

                process.exit(0);
            } catch (error) {
                console.error('❌ خطأ:', error.message);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('❌ خطأ في الاتصال:', error.message);
        process.exit(1);
    }
}

makeAdmin();
