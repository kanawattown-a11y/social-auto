require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/user.model');

async function createAdmin() {
    try {
        // الاتصال بـ MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // بيانات Admin الافتراضي
        const adminData = {
            username: 'admin',
            email: 'admin@social-auto.ly',
            password: await bcrypt.hash('Admin@123', 10),
            isEmailVerified: true,
            isAdmin: true,
            subscription: {
                plan: 'premium',
                status: 'active',
                startDate: new Date(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // سنة
                limits: {
                    campaigns: 9999,
                    scheduledPosts: 9999,
                    messages: 9999,
                }
            }
        };

        // تحقق إذا موجود
        const existing = await User.findOne({ email: adminData.email });
        if (existing) {
            existing.isAdmin = true;
            await existing.save();
            console.log('✅ Admin موجود مسبقاً، تم تحديثه:');
            console.log(`   Username: ${existing.username}`);
            console.log(`   Email: ${existing.email}`);
            console.log(`   Password: (لم يتم التغيير)`);
        } else {
            // إنشاء admin جديد
            const admin = await User.create(adminData);
            console.log('✅ تم إنشاء Admin جديد:');
            console.log(`   Username: ${admin.username}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   Password: Admin@123`);
            console.log('\n⚠️  يرجى تغيير كلمة المرور بعد تسجيل الدخول!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    }
}

createAdmin();
