const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const logger = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter.middleware');

// Route files
const authRoutes = require('./routes/auth.routes');
const facebookRoutes = require('./routes/facebook.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const telegramRoutes = require('./routes/telegram.routes');
const instagramRoutes = require('./routes/instagram.routes');
const campaignRoutes = require('./routes/campaign.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const scheduledPostRoutes = require('./routes/scheduledPost.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');
const draftRoutes = require('./routes/draft.routes');
const calendarRoutes = require('./routes/calendar.routes');
const aiRoutes = require('./routes/ai.routes');
const templateRoutes = require('./routes/template.routes');
const activityLogRoutes = require('./routes/activityLog.routes');

// Services-AMER
const whatsappService = require('./services/whatsapp.service');
const telegramService = require('./services/telegram.service');
const cronService = require('./services/cron.service');

// Connect to Database
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB at:', process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Restore WhatsApp and Telegram sessions
    setTimeout(() => {
      whatsappService.restoreConnectedAccounts();
      telegramService.restoreBots();
    }, 2000); // Wait 2 seconds for server to fully initialize
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
    // process.exit(1); // Don't exit, keep trying
  }
};

connectDB();

const app = express();

// Trust proxy - Required for Render and other reverse proxies (MUST be before rate limiters!)
app.set('trust proxy', 1);

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Body parser
app.use(apiLimiter); // Apply rate limiting to all routes

// Mount routers
app.get('/', (req, res) => {
  res.send('Social Auto API is running...');
});
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/scheduled-posts', scheduledPostRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/activity-logs', activityLogRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*', // In production, restrict this to your frontend URL
    methods: ['GET', 'POST'],
  },
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('a user connected with socket id:', socket.id);

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Initialize services
whatsappService.setSocketIo(io);
cronService.init();

// Initialize post scheduler (runs every minute)
const scheduledPostService = require('./services/scheduledPost.service');
setInterval(() => {
  scheduledPostService.processScheduledPosts().catch(err => {
    logger.error('Scheduler error:', err);
  });
}, 60000); // Run every 60 seconds
console.log('📅 Post scheduler initialized - checking every minute');

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});