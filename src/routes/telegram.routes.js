const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegram.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// All routes are protected
router.use(protect);

router.post('/add-bot', telegramController.addBot);
router.get('/bots', telegramController.getBots);
router.post('/send-message', telegramController.sendMessage);
router.post('/send-photo', upload.single('photo'), telegramController.sendPhoto);
router.post('/send-video', upload.single('video'), telegramController.sendVideo);
router.get('/chat', telegramController.getChat);
router.get('/chat', telegramController.getChat);
router.get('/updates', telegramController.getUpdates);
router.delete('/bot/:accountId', telegramController.removeBot);

module.exports = router;
