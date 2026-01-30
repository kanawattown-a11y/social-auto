const whatsappService = require('../services/whatsapp.service');
const WhatsappAccount = require('../models/whatsappAccount.model');
const logger = require('../utils/logger');

// Add new WhatsApp account
exports.addAccount = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user._id;

    const account = await whatsappService.createAccount(userId, phoneNumber);

    res.status(201).json({
      success: true,
      message: 'WhatsApp account created. Please scan QR code.',
      account: {
        _id: account._id,
        number: account.number,
        status: account.status
      }
    });
  } catch (error) {
    logger.error('Add WhatsApp account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all user's WhatsApp accounts
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await WhatsappAccount.find({ userId: req.user._id });
    res.json(accounts);
  } catch (error) {
    logger.error('Get WhatsApp accounts error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Remove WhatsApp account
exports.removeAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await WhatsappAccount.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Disconnect client if connected
    await whatsappService.disconnectAccount(id);

    // Delete account
    await WhatsappAccount.findByIdAndDelete(id);

    res.json({ success: true, message: 'Account removed successfully' });
  } catch (error) {
    logger.error('Remove WhatsApp account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get account status
exports.getStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await WhatsappAccount.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const status = await whatsappService.getStatus(id);
    res.json(status);
  } catch (error) {
    logger.error('Get WhatsApp status error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Initialize/reconnect account
exports.initializeAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await WhatsappAccount.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    await whatsappService.initializeClient(id);

    res.json({
      success: true,
      message: 'Initializing... Please scan QR code if needed.'
    });
  } catch (error) {
    logger.error('Initialize WhatsApp account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Disconnect account
exports.disconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await WhatsappAccount.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    await whatsappService.disconnectAccount(id);

    res.json({ success: true, message: 'Account disconnected' });
  } catch (error) {
    logger.error('Disconnect WhatsApp account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    logger.info('=== WhatsApp Send Message Request ===');
    const { accountId, number, text } = req.body;
    logger.info('Request data:', { accountId, number, textLength: text?.length });

    const account = await WhatsappAccount.findOne({
      _id: accountId,
      userId: req.user._id
    });

    if (!account) {
      logger.error('Account not found:', accountId);
      return res.status(404).json({ message: 'Account not found' });
    }

    logger.info('Account found:', { id: account._id, number: account.number, status: account.status });
    logger.info('Calling whatsappService.sendMessage...');

    await whatsappService.sendMessage(accountId, number, text);

    logger.info('Message sent successfully!');
    res.json({
      success: true,
      message: `Message sent from ${account.number} to ${number}`
    });
  } catch (error) {
    logger.error('Send WhatsApp message error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send media
exports.sendMedia = async (req, res) => {
  try {
    const { accountId, number } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Media file is required' });
    }

    const account = await WhatsappAccount.findOne({
      _id: accountId,
      userId: req.user._id
    });

    if (!account) {
      return res.status(400).json({ message: 'Account not found' });
    }

    await whatsappService.sendMedia(accountId, number, {
      path: file.path,
      caption: req.body.caption || ''
    });

    res.json({
      success: true,
      message: `Media sent from ${account.number} to ${number}`
    });
  } catch (error) {
    logger.error('Send WhatsApp media error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Broadcast message
exports.broadcastMessage = async (req, res) => {
  try {
    const { accountId, numbers, text } = req.body;

    const account = await WhatsappAccount.findOne({
      _id: accountId,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const results = await whatsappService.broadcastMessage(accountId, numbers, text);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Broadcast completed: ${successful} successful, ${failed} failed`,
      results
    });
  } catch (error) {
    logger.error('Broadcast WhatsApp message error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get chats
exports.getChats = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await WhatsappAccount.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const chats = await whatsappService.getChats(id);

    res.json({ success: true, chats });
  } catch (error) {
    logger.error('Get WhatsApp chats error:', error);
    res.status(500).json({ message: error.message });
  }
};
