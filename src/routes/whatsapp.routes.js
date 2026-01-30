const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');

// Configure multer for media uploads
const upload = multer({ dest: 'uploads/' });

// Account management routes
router.post('/accounts', protect, whatsappController.addAccount);
router.get('/accounts', protect, whatsappController.getAccounts);
router.delete('/accounts/:id', protect, whatsappController.removeAccount);
router.get('/accounts/:id/status', protect, whatsappController.getStatus);
router.post('/accounts/:id/initialize', protect, whatsappController.initializeAccount);
router.post('/accounts/:id/disconnect', protect, whatsappController.disconnectAccount);

// Messaging routes
router.post('/send-message', protect, whatsappController.sendMessage);
router.post('/send-media', protect, upload.single('media'), whatsappController.sendMedia);
router.post('/broadcast', protect, whatsappController.broadcastMessage);

// Chat routes
router.get('/accounts/:id/chats', protect, whatsappController.getChats);

module.exports = router;
