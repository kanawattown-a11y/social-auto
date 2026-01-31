// Optional dependency - only load if available
let Client, LocalAuth, MessageMedia;
try {
  const whatsappWeb = require('whatsapp-web.js');
  Client = whatsappWeb.Client;
  LocalAuth = whatsappWeb.LocalAuth;
  MessageMedia = whatsappWeb.MessageMedia;
} catch (e) {
  console.warn('whatsapp-web.js not installed - WhatsApp automation disabled');
}

const WhatsappAccount = require('../models/whatsappAccount.model');
const ChatbotRule = require('../models/chatbotRule.model');
const logger = require('../utils/logger');
const Analytics = require('../models/analytics.model');

class WhatsappService {
  constructor() {
    this.clients = new Map(); // Changed to Map for better management
    this.io = null;
  }

  setSocketIo(io) {
    this.io = io;
  }

  // Initialize client for specific account
  async initializeClient(accountId) {
    // Convert to string for consistent Map key
    const accountKey = accountId.toString();

    if (this.clients.has(accountKey)) {
      return this.clients.get(accountKey);
    }

    logger.info(`Initializing WhatsApp client for account ${accountKey}`);

    const account = await WhatsappAccount.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: accountKey }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    client.on('qr', (qr) => {
      logger.info(`QR code generated for account ${accountKey}`);
      if (this.io) {
        this.io.emit(`whatsapp_qr_${accountKey}`, qr);
      }
    });

    client.on('ready', async () => {
      logger.info(`WhatsApp client ready for account ${accountKey}`);
      if (this.io) {
        this.io.emit(`whatsapp_ready_${accountKey}`, { status: 'connected' });
      }

      const info = client.info;
      await WhatsappAccount.findByIdAndUpdate(accountId, {
        number: info.wid.user,
        status: 'connected',
        lastConnected: new Date()
      });
    });

    client.on('message', async msg => {
      try {
        const rules = await ChatbotRule.find({
          accountId: accountId,
          accountModel: 'WhatsappAccount',
          isEnabled: true
        });

        for (const rule of rules) {
          if (msg.body.toLowerCase().includes(rule.keyword.toLowerCase())) {
            await msg.reply(rule.response.text);
            logger.info(`Replied to ${msg.from} with rule ${rule.keyword}`);

            // Track analytics
            await Analytics.create({
              userId: account.userId,
              platform: 'whatsapp',
              action: 'chatbot_response',
              metadata: { keyword: rule.keyword, recipient: msg.from }
            });
            break;
          }
        }
      } catch (err) {
        logger.error('Chatbot Error:', err);
      }
    });

    client.on('disconnected', async (reason) => {
      logger.warn(`WhatsApp client disconnected for account ${accountKey}:`, reason);
      if (this.io) {
        this.io.emit(`whatsapp_disconnected_${accountKey}`, { status: 'disconnected' });
      }
      await WhatsappAccount.findByIdAndUpdate(accountId, { status: 'disconnected' });
      this.clients.delete(accountKey);
    });

    await client.initialize();
    this.clients.set(accountKey, client);
    return client;
  }

  // Create new WhatsApp account
  async createAccount(userId, phoneNumber) {
    const account = await WhatsappAccount.create({
      userId,
      number: phoneNumber || 'pending',
      status: 'pending_qr'
    });

    // Initialize client immediately to generate QR
    await this.initializeClient(account._id);

    return account;
  }

  // Get client for account
  async getClient(accountId) {
    logger.info(`[getClient] Checking for accountId: ${accountId}`);
    logger.info(`[getClient] Clients Map size: ${this.clients.size}`);
    logger.info(`[getClient] Has account: ${this.clients.has(accountId)}`);

    if (this.clients.has(accountId)) {
      const client = this.clients.get(accountId);
      logger.info(`[getClient] Found existing client, ready: ${!!client.info}`);
      return client;
    }

    logger.warn(`[getClient] Client not found! Attempting to initialize...`);
    // Initialize if not exists
    return await this.initializeClient(accountId);
  }

  // Send message from specific account
  async sendMessage(accountId, number, text) {
    logger.info(`[sendMessage] START - accountId: ${accountId}, number: ${number}`);

    const client = await this.getClient(accountId);
    logger.info(`[sendMessage] Got client:`, { hasClient: !!client, hasInfo: !!client?.info });

    if (!client || !client.info) {
      logger.error('[sendMessage] Client not ready!');
      throw new Error('Client not connected');
    }

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    logger.info(`[sendMessage] Sending to chatId: ${chatId}`);

    await client.sendMessage(chatId, text);
    logger.info(`[sendMessage] ✅ Message sent successfully`);

    const account = await WhatsappAccount.findById(accountId);
    logger.info(`Sent message from ${account.number} to ${number}`);

    // Track analytics
    try {
      await Analytics.create({
        userId: account.userId,
        platform: 'whatsapp',
        action: 'send_message',
        type: 'message',
        metadata: { recipient: number }
      });
    } catch (err) {
      logger.warn('Analytics tracking failed:', err.message);
    }
  }

  // Send media from specific account
  async sendMedia(accountId, number, media) {
    const client = await this.getClient(accountId);

    if (!client || !client.info) {
      throw new Error('Client not connected');
    }

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    const messageMedia = await MessageMedia.fromFilePath(media.path);
    await client.sendMessage(chatId, messageMedia, { caption: media.caption || '' });

    const account = await WhatsappAccount.findById(accountId);
    logger.info(`Sent media from ${account.number} to ${number}`);
  }

  // Get account status
  async getStatus(accountId) {
    const client = this.clients.get(accountId);
    const account = await WhatsappAccount.findById(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    return {
      accountId: account._id,
      number: account.number,
      status: client && client.info ? 'connected' : account.status,
      lastConnected: account.lastConnected
    };
  }

  // Disconnect account
  async disconnectAccount(accountId) {
    const client = this.clients.get(accountId);

    if (client) {
      await client.destroy();
      this.clients.delete(accountId);
    }

    await WhatsappAccount.findByIdAndUpdate(accountId, {
      status: 'disconnected'
    });

    logger.info(`Disconnected WhatsApp account ${accountId}`);
  }

  // Restore all connected accounts on server start
  async restoreConnectedAccounts() {
    try {
      const accounts = await WhatsappAccount.find({ status: 'connected' });
      logger.info(`Found ${accounts.length} connected account(s) to restore`);

      for (const account of accounts) {
        try {
          logger.info(`Restoring session for account ${account._id}...`);
          await this.initializeClient(account._id);
        } catch (err) {
          logger.error(`Failed to restore account ${account._id}:`, err.message);
        }
      }
    } catch (err) {
      logger.error('Error restoring WhatsApp sessions:', err);
    }
  }

  // Broadcast message to multiple recipients
  async broadcastMessage(accountId, numbers, text) {
    const client = await this.getClient(accountId);

    if (!client || !client.info) {
      throw new Error('Client not connected');
    }

    const results = [];
    for (const number of numbers) {
      try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, text);
        results.push({ number, success: true });

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        results.push({ number, success: false, error: err.message });
      }
    }

    return results;
  }

  // Get all chats
  async getChats(accountId) {
    const client = await this.getClient(accountId);

    if (!client || !client.info) {
      throw new Error('Client not connected');
    }

    const chats = await client.getChats();
    return chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount
    }));
  }
}

module.exports = new WhatsappService();
