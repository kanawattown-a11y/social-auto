require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/user.model');

async function resetPassword() {
    try {
        // الاتصال بـ MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'amer@gmail.com';
        const newPassword = 'Admin@123';

        // البحث عن المستخدم
        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ المستخدم غير موجود!');
            process.exit(1);
        }

        // تحديث كلمة المرور (الموديل سيقوم بالتشفير)
        user.password = newPassword;
        user.emailVerified = true; // تأكيد البريد
        user.isAdmin = true; // admin
        user.role = 'admin'; // admin role
        await user.save();

        console.log('✅ تم تحديث كلمة المرور بنجاح!');
        console.log('');
        console.log('📧 Email:', email);
        console.log('🔑 Password:', newPassword);
        console.log('👤 Username:', user.username);
        console.log('🔐 Admin:', user.isAdmin);
        console.log('📝 Role:', user.role);
        console.log('');
        console.log('🎉 يمكنك الآن تسجيل الدخول!');

        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    }
}

resetPassword();
