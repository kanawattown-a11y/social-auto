const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, fixAdminPassword, debugAuth } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// @route   /api/auth
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/fix-admin', fixAdminPassword);
router.get('/debug', debugAuth);
router.get('/me', protect, getMe);

module.exports = router;