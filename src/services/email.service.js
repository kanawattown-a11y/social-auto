// Temporarily disabled for deployment
// const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        // Skip email setup if not configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            logger.warn('Email service disabled - SMTP credentials not configured');
            this.transporter = null;
            return;
        }

        try {
            const nodemailer = require('nodemailer');
            this.transporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        } catch (error) {
            logger.error(`Email service initialization failed: ${error.message}`);
            this.transporter = null;
        }
    }

    async sendEmail({ to, subject, html }) {
        if (!this.transporter) {
            logger.warn('Email not sent - service not configured');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const info = await this.transporter.sendMail({
                from: `"Social Auto" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html,
            });

            logger.info(`Email sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`Email send error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async sendVerificationEmail(email, token, userName) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #667eea; }
                    .header h1 { color: #667eea; margin: 0; }
                    .content { padding: 30px 0; text-align: center; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Social Auto</h1>
                    </div>
                    <div class="content">
                        <h2>مرحباً ${userName}!</h2>
                        <p>شكراً لتسجيلك في Social Auto. يرجى تأكيد بريدك الإلكتروني بالنقر على الزر أدناه:</p>
                        <a href="${verificationUrl}" class="button">تأكيد البريد الإلكتروني</a>
                        <p style="color: #666; font-size: 14px;">أو انسخ هذا الرابط في متصفحك:</p>
                        <p style="color: #667eea; word-break: break-all;">${verificationUrl}</p>
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">هذا الرابط صالح لمدة 24 ساعة فقط.</p>
                    </div>
                    <div class="footer">
                        <p>إذا لم تقم بإنشاء هذا الحساب، يرجى تجاهل هذا البريد.</p>
                        <p>© 2025 Social Auto. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: 'تأكيد البريد الإلكتروني - Social Auto',
            html,
        });
    }

    async sendPasswordResetEmail(email, token, userName) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #667eea; }
                    .header h1 { color: #667eea; margin: 0; }
                    .content { padding: 30px 0; text-align: center; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
                    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Social Auto</h1>
                    </div>
                    <div class="content">
                        <h2>مرحباً ${userName}</h2>
                        <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
                        <div class="warning">
                            <strong>⚠️ تنبيه أمني:</strong> إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد وحسابك آمن.
                        </div>
                        <p>لإعادة تعيين كلمة المرور، انقر على الزر أدناه:</p>
                        <a href="${resetUrl}" class="button">إعادة تعيين كلمة المرور</a>
                        <p style="color: #666; font-size: 14px;">أو انسخ هذا الرابط في متصفحك:</p>
                        <p style="color: #667eea; word-break: break-all;">${resetUrl}</p>
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
                    </div>
                    <div class="footer">
                        <p>لأسباب أمنية، لن نطلب منك أبداً كلمة المرور عبر البريد الإلكتروني.</p>
                        <p>© 2025 Social Auto. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: 'إعادة تعيين كلمة المرور - Social Auto',
            html,
        });
    }

    async sendWelcomeEmail(email, userName) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #667eea; }
                    .header h1 { color: #667eea; margin: 0; }
                    .content { padding: 30px 0; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
                    .feature { padding: 10px 0; }
                    .feature-icon { color: #667eea; margin-left: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 مرحباً بك في Social Auto!</h1>
                    </div>
                    <div class="content">
                        <h2>أهلاً ${userName}!</h2>
                        <p>نحن سعداء جداً بانضمامك إلى منصة Social Auto. الآن يمكنك البدء في أتمتة حملاتك التسويقية عبر جميع المنصات!</p>
                        
                        <h3>ما يمكنك فعله الآن:</h3>
                        <div class="feature">✅ ربط حسابات WhatsApp، Telegram، Instagram، وFacebook</div>
                        <div class="feature">✅ إنشاء حملات تسويقية ذكية</div>
                        <div class="feature">✅ إعداد ردود تلقائية للرسائل</div>
                        <div class="feature">✅ تتبع الإحصائيات والتحليلات</div>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">ابدأ الآن</a>
                        </div>
                        
                        <p style="margin-top: 30px;">إذا كان لديك أي أسئلة، لا تتردد في التواصل معنا!</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Social Auto. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: 'مرحباً بك في Social Auto! 🎉',
            html,
        });
    }
}

module.exports = new EmailService();
