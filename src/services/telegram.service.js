// Optional dependency - only load if available
let TelegramBot;
try {
    TelegramBot = require('node-telegram-bot-api');
} catch (e) {
    console.warn('node-telegram-bot-api not installed - Telegram automation disabled');
}

const TelegramAccount = require('../models/telegramAccount.model');
const logger = require('../utils/logger');

class TelegramService {
    constructor() {
        this.bots = {}; // Store bot instances by userId
    }

    async addBot(userId, botToken) {
        try {
            // Test the token by getting bot info
            const testBot = new TelegramBot(botToken, { polling: false });
            const botInfo = await testBot.getMe();

            // Save to database
            const account = await TelegramAccount.findOneAndUpdate(
                { userId, botToken },
                {
                    userId,
                    botToken,
                    botUsername: botInfo.username,
                    botName: botInfo.first_name,
                    status: 'active',
                    lastActivityAt: new Date()
                },
                { upsert: true, new: true }
            );

            // Initialize bot instance
            const bot = new TelegramBot(botToken, { polling: false });
            this.bots[userId] = this.bots[userId] || {};
            this.bots[userId][account._id.toString()] = bot;

            logger.info(`Telegram bot added for user ${userId}: @${botInfo.username}`);
            return account;
        } catch (error) {
            logger.error('Error adding Telegram bot:', error);
            throw new Error('Invalid bot token or unable to connect to Telegram');
        }
    }

    async getBots(userId) {
        return await TelegramAccount.find({ userId });
    }

    async getBot(userId, accountId) {
        // Ensure userId is string
        const uId = userId.toString();
        const aId = accountId.toString();

        if (!this.bots[uId]) {
            this.bots[uId] = {};
        }

        // If exists in memory, return it
        if (this.bots[uId][aId]) {
            return this.bots[uId][aId];
        }

        // Lazy load: Try to find in DB
        console.log(`[Telegram] Bot not in memory, attempting to restore for user ${uId}, account ${aId}`);
        try {
            const account = await TelegramAccount.findOne({ _id: aId, userId: uId });
            if (account) {
                const bot = new TelegramBot(account.botToken, { polling: false });
                this.bots[uId][aId] = bot;
                console.log(`[Telegram] Lazy restored bot: @${account.botUsername}`);
                return bot;
            }
        } catch (error) {
            console.error('[Telegram] Lazy restore failed:', error);
        }

        return null;
    }

    async sendMessage(userId, accountId, chatId, text) {
        const bot = await this.getBot(userId, accountId);
        if (!bot) {
            throw new Error('Bot not initialized');
        }

        try {
            const result = await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });

            // Update last activity
            await TelegramAccount.findByIdAndUpdate(accountId, {
                lastActivityAt: new Date()
            });

            logger.info(`Message sent via Telegram bot to chat ${chatId}`);
            return result;
        } catch (error) {
            logger.error('Error sending Telegram message:', error);
            throw new Error('Failed to send message: ' + error.message);
        }
    }

    async sendPhoto(userId, accountId, chatId, photoPath, caption = '') {
        const bot = await this.getBot(userId, accountId);
        if (!bot) {
            throw new Error('Bot not initialized');
        }

        try {
            const result = await bot.sendPhoto(chatId, photoPath, { caption });

            await TelegramAccount.findByIdAndUpdate(accountId, {
                lastActivityAt: new Date()
            });

            logger.info(`Photo sent via Telegram bot to chat ${chatId}`);
            return result;
        } catch (error) {
            logger.error('Error sending Telegram photo:', error);
            throw new Error('Failed to send photo: ' + error.message);
        }
    }

    async sendVideo(userId, accountId, chatId, videoPath, caption = '') {
        const bot = await this.getBot(userId, accountId);
        if (!bot) {
            throw new Error('Bot not initialized');
        }

        try {
            const result = await bot.sendVideo(chatId, videoPath, { caption });

            await TelegramAccount.findByIdAndUpdate(accountId, {
                lastActivityAt: new Date()
            });

            logger.info(`Video sent via Telegram bot to chat ${chatId}`);
            return result;
        } catch (error) {
            logger.error('Error sending Telegram video:', error);
            throw new Error('Failed to send video: ' + error.message);
        }
    }

    async getChat(userId, accountId, chatId) {
        const bot = await this.getBot(userId, accountId);
        if (!bot) {
            throw new Error('Bot not initialized');
        }

        try {
            const chat = await bot.getChat(chatId);
            return {
                id: chat.id,
                type: chat.type,
                title: chat.title || chat.username || `${chat.first_name} ${chat.last_name}`.trim(),
                username: chat.username,
                membersCount: chat.members_count
            };
        } catch (error) {
            logger.error('Error getting Telegram chat:', error);
            throw new Error('Failed to get chat info: ' + error.message);
        }
    }
    async getUpdates(userId, accountId) {
        const bot = await this.getBot(userId, accountId);
        if (!bot) {
            throw new Error('Bot not initialized');
        }

        try {
            // Get last 10 updates
            const updates = await bot.getUpdates({ limit: 10 });

            // Extract and save unique chats
            const chatsToSave = new Map();
            const formattedUpdates = updates.map(update => {
                const message = update.message || update.channel_post || update.edited_message || update.my_chat_member;
                if (!message) return null;

                const chat = message.chat || (update.my_chat_member ? update.my_chat_member.chat : null);

                if (chat && chat.id) {
                    chatsToSave.set(String(chat.id), {
                        id: String(chat.id),
                        title: chat.title || chat.username || chat.first_name || 'Unknown',
                        type: chat.type,
                        username: chat.username
                    });
                }

                return {
                    update_id: update.update_id,
                    message_id: message.message_id,
                    chat: chat ? {
                        id: chat.id,
                        type: chat.type,
                        title: chat.title || chat.username || chat.first_name,
                        username: chat.username
                    } : null,
                    text: message.text || '(media/other)',
                    date: message.date
                };
            }).filter(Boolean);

            if (chatsToSave.size > 0) {
                const account = await TelegramAccount.findOne({ _id: accountId, userId: userId });
                if (account) {
                    const newChats = Array.from(chatsToSave.values());
                    let changed = false;

                    if (!account.savedChats) account.savedChats = [];

                    for (const chat of newChats) {
                        const exists = account.savedChats.some(c => c.id === chat.id);
                        if (!exists) {
                            account.savedChats.push(chat);
                            changed = true;
                        }
                    }

                    if (changed) {
                        await account.save();
                        console.log(`[Telegram] Saved ${newChats.length} new chats to account.`);
                    }
                }
            }

            return formattedUpdates;

        } catch (error) {
            logger.error('Error getting Telegram updates:', error);
            throw new Error('Failed to get updates: ' + error.message);
        }
    }

    async restoreBots() {
        try {
            console.log('Restoring Telegram bots...');
            const accounts = await TelegramAccount.find({ status: 'active' });

            if (accounts.length === 0) {
                console.log('No active Telegram bots to restore');
                return;
            }

            console.log(`Found ${accounts.length} Telegram bot(s) to restore`);

            for (const account of accounts) {
                try {
                    const bot = new TelegramBot(account.botToken, { polling: false });
                    this.bots[account.userId] = this.bots[account.userId] || {};
                    this.bots[account.userId][account._id.toString()] = bot;
                    console.log(`Restored Telegram bot: @${account.botUsername}`);
                } catch (error) {
                    console.error(`Failed to restore bot ${account.botUsername}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error restoring Telegram bots:', error);
        }
    }

    async removeBot(userId, accountId) {
        try {
            // Remove from memory
            if (this.bots[userId]?.[accountId]) {
                delete this.bots[userId][accountId];
            }

            // Remove from database
            await TelegramAccount.findByIdAndDelete(accountId);

            logger.info(`Telegram bot removed for user ${userId}`);
            return { success: true };
        } catch (error) {
            logger.error('Error removing Telegram bot:', error);
            throw error;
        }
    }
}

module.exports = new TelegramService();
