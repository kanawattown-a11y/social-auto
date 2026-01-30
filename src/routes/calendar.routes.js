const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const ScheduledPost = require('../models/scheduledPost.model');

// @desc    Get posts for calendar view
// @route   GET /api/calendar/posts
// @access  Private
router.get('/posts', protect, async (req, res) => {
    try {
        const { start, end, platform } = req.query;

        const query = { user: req.user.id };

        if (start && end) {
            query.scheduledTime = {
                $gte: new Date(start),
                $lte: new Date(end),
            };
        }

        if (platform) {
            query.platform = platform;
        }

        const posts = await ScheduledPost.find(query)
            .populate('account')
            .sort({ scheduledTime: 1 });

        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Move post to new time (drag-drop)
// @route   PUT /api/calendar/move/:id
// @access  Private
router.put('/move/:id', protect, async (req, res) => {
    try {
        const { newTime } = req.body;

        const post = await ScheduledPost.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        post.scheduledTime = new Date(newTime);
        await post.save();

        res.json(post);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
