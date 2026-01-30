const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { logActivity, createActivityLog } = require('../middleware/activityLogger.middleware');
const aiService = require('../services/ai.service');

// @desc    Generate content suggestions
// @route   POST /api/ai/content-suggestions
// @access  Private
router.post('/content-suggestions', protect, logActivity('ai_content_generated'), async (req, res) => {
    try {
        const { prompt, platform, tone, length, count } = req.body;

        if (!prompt) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        const suggestions = await aiService.generateContentSuggestions(prompt, {
            platform,
            tone,
            length,
            count,
        });

        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Generate hashtag suggestions
// @route   POST /api/ai/hashtags
// @access  Private
router.post('/hashtags', protect, async (req, res) => {
    try {
        const { content, platform, count } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }

        const hashtags = await aiService.generateHashtags(content, {
            platform,
            count,
        });

        res.json({ hashtags });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Generate reply template
// @route   POST /api/ai/reply-template
// @access  Private
router.post('/reply-template', protect, async (req, res) => {
    try {
        const { context, tone, language } = req.body;

        if (!context) {
            return res.status(400).json({ message: 'Context is required' });
        }

        const template = await aiService.generateReplyTemplate(context, {
            tone,
            language,
        });

        res.json({ template });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Analyze sentiment
// @route   POST /api/ai/sentiment
// @access  Private
router.post('/sentiment', protect, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        const sentiment = await aiService.analyzeSentiment(text);

        res.json({ sentiment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
