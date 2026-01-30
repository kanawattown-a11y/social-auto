const express = require('express');
const router = express.Router();
const { getSubscription, upgradePlan, checkLimit } = require('../controllers/subscription.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, getSubscription);
router.post('/upgrade', protect, upgradePlan);
router.get('/check/:action', protect, checkLimit);

module.exports = router;
