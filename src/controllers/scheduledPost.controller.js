const scheduledPostService = require('../services/scheduledPost.service');
const logger = require('../utils/logger');
const fs = require('fs');

exports.createScheduledPost = async (req, res) => {
    try {
        const { platform, accountId, caption, scheduledTime, postType } = req.body;

        if (!platform || !accountId || !scheduledTime) {
            return res.status(400).json({ message: 'Platform, account ID, and scheduled time are required' });
        }

        const postData = {
            platform,
            accountId,
            caption,
            scheduledTime,
            postType: postType || 'image'
        };

        // Handle file upload
        if (req.file) {
            postData.mediaPath = req.file.path;
        }

        const scheduledPost = await scheduledPostService.createScheduledPost(req.user._id, postData);

        res.json({
            success: true,
            message: 'Scheduled post created successfully',
            post: scheduledPost
        });
    } catch (error) {
        logger.error('Create scheduled post error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: error.message });
    }
};

exports.getScheduledPosts = async (req, res) => {
    try {
        const { platform, status } = req.query;

        const filters = {};
        if (platform) filters.platform = platform;
        if (status) filters.status = status;

        const posts = await scheduledPostService.getScheduledPosts(req.user._id, filters);

        res.json({
            success: true,
            count: posts.length,
            data: posts
        });
    } catch (error) {
        logger.error('Get scheduled posts error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.updateScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        if (req.body.caption !== undefined) updateData.caption = req.body.caption;
        if (req.body.scheduledTime) updateData.scheduledTime = req.body.scheduledTime;
        if (req.file) updateData.mediaPath = req.file.path;

        const updatedPost = await scheduledPostService.updateScheduledPost(req.user._id, id, updateData);

        res.json({
            success: true,
            message: 'Scheduled post updated successfully',
            post: updatedPost
        });
    } catch (error) {
        logger.error('Update scheduled post error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: error.message });
    }
};

exports.deleteScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;

        await scheduledPostService.deleteScheduledPost(req.user._id, id);

        res.json({
            success: true,
            message: 'Scheduled post deleted successfully'
        });
    } catch (error) {
        logger.error('Delete scheduled post error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.postNow = async (req, res) => {
    try {
        const { id } = req.params;

        const post = await scheduledPostService.postNow(req.user._id, id);

        res.json({
            success: true,
            message: 'Post published',
            post
        });
    } catch (error) {
        logger.error('Post now error:', error);
        res.status(500).json({ message: error.message });
    }
};
