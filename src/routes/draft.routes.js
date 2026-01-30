const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const Draft = require('../models/draft.model');
const ScheduledPost = require('../models/scheduledPost.model');

// @desc    Create new draft
// @route   POST /api/drafts
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { title, platform, account, accountModel, content, metadata } = req.body;

        const draft = await Draft.create({
            user: req.user.id,
            title,
            platform,
            account,
            accountModel,
            content,
            metadata,
        });

        res.status(201).json(draft);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all user's drafts
// @route   GET /api/drafts
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { platform, search } = req.query;

        const query = { user: req.user.id };

        if (platform) {
            query.platform = platform;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'content.text': { $regex: search, $options: 'i' } },
            ];
        }

        const drafts = await Draft.find(query)
            .populate('account')
            .sort({ lastEdited: -1 });

        res.json(drafts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get single draft
// @route   GET /api/drafts/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const draft = await Draft.findById(req.params.id).populate('account');

        if (!draft) {
            return res.status(404).json({ message: 'Draft not found' });
        }

        if (draft.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(draft);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update draft
// @route   PUT /api/drafts/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const draft = await Draft.findById(req.params.id);

        if (!draft) {
            return res.status(404).json({ message: 'Draft not found' });
        }

        if (draft.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { title, platform, account, accountModel, content, metadata } = req.body;

        if (title) draft.title = title;
        if (platform) draft.platform = platform;
        if (account) draft.account = account;
        if (accountModel) draft.accountModel = accountModel;
        if (content) draft.content = content;
        if (metadata) draft.metadata = metadata;

        await draft.save();

        res.json(draft);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete draft
// @route   DELETE /api/drafts/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const draft = await Draft.findById(req.params.id);

        if (!draft) {
            return res.status(404).json({ message: 'Draft not found' });
        }

        if (draft.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await draft.deleteOne();

        res.json({ message: 'Draft deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Convert draft to scheduled post
// @route   POST /api/drafts/:id/schedule
// @access  Private
router.post('/:id/schedule', protect, async (req, res) => {
    try {
        const draft = await Draft.findById(req.params.id);

        if (!draft) {
            return res.status(404).json({ message: 'Draft not found' });
        }

        if (draft.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { scheduledTime, recipients } = req.body;

        if (!scheduledTime) {
            return res.status(400).json({ message: 'Scheduled time is required' });
        }

        // Create scheduled post from draft
        const scheduledPost = await ScheduledPost.create({
            user: req.user.id,
            platform: draft.platform,
            account: draft.account,
            content: draft.content,
            scheduledTime: new Date(scheduledTime),
            recipients: recipients || [],
            status: 'pending',
        });

        // Optionally delete draft after scheduling
        // await draft.deleteOne();

        res.status(201).json({
            message: 'Post scheduled successfully',
            scheduledPost,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Duplicate draft
// @route   POST /api/drafts/:id/duplicate
// @access  Private
router.post('/:id/duplicate', protect, async (req, res) => {
    try {
        const draft = await Draft.findById(req.params.id);

        if (!draft) {
            return res.status(404).json({ message: 'Draft not found' });
        }

        if (draft.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const newDraft = await Draft.create({
            user: draft.user,
            title: `${draft.title} (Copy)`,
            platform: draft.platform,
            account: draft.account,
            accountModel: draft.accountModel,
            content: draft.content,
            metadata: draft.metadata,
        });

        res.status(201).json(newDraft);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
