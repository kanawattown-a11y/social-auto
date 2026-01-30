const express = require('express');
const router = express.Router();
const { createRule, getRules, deleteRule } = require('../controllers/chatbot.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, createRule);
router.get('/', protect, getRules);
router.delete('/:id', protect, deleteRule);

module.exports = router;
