const logger = require('../utils/logger');
const InstagramAccount = require('../models/instagramAccount.model');
const instagramApiService = require('../services/instagram-api.service');

// Add account
exports.addAccount = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const account = await instagramApiService.addAccount(req.user._id, username, password);

        res.json({
            success: true,
            message: 'Instagram account added successfully',
            account: {
                _id: account._id,
                username: account.username,
                status: account.status,
                lastActivityAt: account.lastActivityAt
            }
        });
    } catch (error) {
        logger.error('Add Instagram account error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get all accounts
exports.getAccounts = async (req, res) => {
    try {
        const accounts = await InstagramAccount.find({ userId: req.user._id }).select('-password -sessionData');
        res.json({ count: accounts.length, data: accounts });
    } catch (error) {
        logger.error('Get Instagram accounts error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Remove account
exports.removeAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        await instagramApiService.removeAccount(req.user._id, accountId);
        res.json({ success: true, message: 'Account removed successfully' });
    } catch (error) {
        logger.error('Remove Instagram account error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Scraping Methods

// Get followers list
exports.getFollowers = async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await InstagramAccount.findOne({ _id: accountId, userId: req.user._id });

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const followers = await instagramApiService.getFollowers(accountId);
        res.json({
            success: true,
            count: followers.length,
            data: followers
        });
    } catch (error) {
        logger.error('Get Instagram followers error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get following list
exports.getFollowing = async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await InstagramAccount.findOne({ _id: accountId, userId: req.user._id });

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const following = await instagramApiService.getFollowing(accountId);
        res.json({
            success: true,
            count: following.length,
            data: following
        });
    } catch (error) {
        logger.error('Get Instagram following error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get posts
exports.getPosts = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { targetUsername } = req.query;

        const account = await InstagramAccount.findOne({ _id: accountId, userId: req.user._id });

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const posts = await instagramApiService.getPosts(accountId, targetUsername);
        res.json({
            success: true,
            count: posts.length,
            data: posts
        });
    } catch (error) {
        logger.error('Get Instagram posts error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get comments from a post
exports.getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const { accountId } = req.query;

        if (!accountId) {
            return res.status(400).json({ message: 'Account ID is required' });
        }

        const account = await InstagramAccount.findOne({ _id: accountId, userId: req.user._id });

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const comments = await instagramApiService.getComments(accountId, postId);
        res.json({
            success: true,
            count: comments.length,
            data: comments
        });
    } catch (error) {
        logger.error('Get Instagram comments error:', error);
        res.status(500).json({ message: error.message });
    }
};
