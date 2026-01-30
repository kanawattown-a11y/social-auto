const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { logActivity } = require('../middleware/activityLogger.middleware');
const ReplyTemplate = require('../models/replyTemplate.model');

// @desc    Create reply template
// @route   POST /api/templates
// @access  Private
router.post('/', protect, logActivity('template_created', 'ReplyTemplate'), async (req, res) => {
    try {
        const { name, content, category, platform, variables, isAIGenerated } = req.body;

        const template = await ReplyTemplate.create({
            user: req.user.id,
            name,
            content,
            category,
            platform,
            variables,
            isAIGenerated,
        });

        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all user templates
// @route   GET /api/templates
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { category, platform } = req.query;

        const query = { user: req.user.id };

        if (category) query.category = category;
        if (platform) query.platform = { $in: [platform, 'all'] };

        const templates = await ReplyTemplate.find(query).sort({ usageCount: -1, createdAt: -1 });

        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get single template
// @route   GET /api/templates/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const template = await ReplyTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (template.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(template);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private
router.put('/:id', protect, logActivity('template_updated', 'ReplyTemplate'), async (req, res) => {
    try {
        const template = await ReplyTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (template.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { name, content, category, platform, variables } = req.body;

        if (name) template.name = name;
        if (content) template.content = content;
        if (category) template.category = category;
        if (platform) template.platform = platform;
        if (variables) template.variables = variables;

        await template.save();

        res.json(template);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private
router.delete('/:id', protect, logActivity('template_deleted', 'ReplyTemplate'), async (req, res) => {
    try {
        const template = await ReplyTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (template.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await template.deleteOne();

        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Use template (increment usage count)
// @route   POST /api/templates/:id/use
// @access  Private
router.post('/:id/use', protect, logActivity('template_used', 'ReplyTemplate'), async (req, res) => {
    try {
        const template = await ReplyTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (template.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        template.usageCount += 1;
        template.lastUsed = new Date();
        await template.save();

        // Replace variables with provided values
        const { variables } = req.body;
        let content = template.content;

        if (variables) {
            Object.entries(variables).forEach(([key, value]) => {
                content = content.replace(new RegExp(`{${key}}`, 'g'), value);
            });
        }

        res.json({ content, template });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
