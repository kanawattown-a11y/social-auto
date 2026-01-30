const telegramService = require('../services/telegram.service');
const logger = require('../utils/logger');

exports.addBot = async (req, res) => {
    try {
        const { botToken } = req.body;

        if (!botToken) {
            return res.status(400).json({ message: 'Bot token is required' });
        }

        const account = await telegramService.addBot(req.user._id, botToken);
        res.json({
            success: true,
            message: 'Bot added successfully',
            account
        });
    } catch (error) {
        logger.error('Add bot error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getBots = async (req, res) => {
    try {
        const bots = await telegramService.getBots(req.user._id);
        res.json({ count: bots.length, data: bots });
    } catch (error) {
        logger.error('Get bots error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { accountId, chatId, text } = req.body;

        if (!accountId || !chatId || !text) {
            return res.status(400).json({ message: 'Account ID, chat ID, and text are required' });
        }

        const result = await telegramService.sendMessage(req.user._id, accountId, chatId, text);
        res.json({ success: true, messageId: result.message_id });
    } catch (error) {
        logger.error('Send message error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.sendPhoto = async (req, res) => {
    try {
        const { accountId, chatId, caption } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Photo file is required' });
        }

        if (!accountId || !chatId) {
            return res.status(400).json({ message: 'Account ID and chat ID are required' });
        }

        const result = await telegramService.sendPhoto(
            req.user._id,
            accountId,
            chatId,
            req.file.path,
            caption || ''
        );

        // Delete uploaded file
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        res.json({ success: true, messageId: result.message_id });
    } catch (error) {
        logger.error('Send photo error:', error);
        if (req.file) {
            const fs = require('fs');
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        res.status(500).json({ message: error.message });
    }
};

exports.sendVideo = async (req, res) => {
    try {
        const { accountId, chatId, caption } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Video file is required' });
        }

        if (!accountId || !chatId) {
            return res.status(400).json({ message: 'Account ID and chat ID are required' });
        }

        const result = await telegramService.sendVideo(
            req.user._id,
            accountId,
            chatId,
            req.file.path,
            caption || ''
        );

        // Delete uploaded file
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        res.json({ success: true, messageId: result.message_id });
    } catch (error) {
        logger.error('Send video error:', error);
        if (req.file) {
            const fs = require('fs');
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        res.status(500).json({ message: error.message });
    }
};

exports.getChat = async (req, res) => {
    try {
        const { accountId, chatId } = req.query;

        if (!accountId || !chatId) {
            return res.status(400).json({ message: 'Account ID and chat ID are required' });
        }

        const chat = await telegramService.getChat(req.user._id, accountId, chatId);
        res.json(chat);
    } catch (error) {
        logger.error('Get chat error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getUpdates = async (req, res) => {
    try {
        const { accountId } = req.query;

        if (!accountId) {
            return res.status(400).json({ message: 'Account ID is required' });
        }

        const updates = await telegramService.getUpdates(req.user._id, accountId);
        res.json(updates);
    } catch (error) {
        logger.error('Get updates error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.removeBot = async (req, res) => {
    try {
        const { accountId } = req.params;
        await telegramService.removeBot(req.user._id, accountId);
        res.json({ success: true, message: 'Bot removed successfully' });
    } catch (error) {
        logger.error('Remove bot error:', error);
        res.status(500).json({ message: error.message });
    }
};
