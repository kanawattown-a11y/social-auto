const { IgApiClient } = require('instagram-private-api');
const InstagramAccount = require('../models/instagramAccount.model');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';
const ALGORITHM = 'aes-256-cbc';

class InstagramApiService {
    constructor() {
        this.clients = new Map(); // accountId -> IgApiClient instance
    }

    // Encrypt password before storing
    encryptPassword(password) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    // Decrypt password when needed
    decryptPassword(encryptedPassword) {
        const parts = encryptedPassword.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // Get or create Instagram client for an account
    async getClient(accountId) {
        // Return cached client if exists
        if (this.clients.has(accountId)) {
            return this.clients.get(accountId);
        }

        // Load account from database
        const account = await InstagramAccount.findById(accountId).select('+password');
        if (!account) {
            throw new Error('Instagram account not found');
        }

        // Create new client
        const ig = new IgApiClient();
        ig.state.generateDevice(account.username);

        // ALWAYS re-login instead of restoring session (avoids corrupted session issues)
        if (!account.password) {
            throw new Error('Password required for Instagram API. Please re-add account with password.');
        }

        const password = this.decryptPassword(account.password);

        try {
            console.log(`[Instagram API] Logging in as ${account.username}...`);
            await ig.account.login(account.username, password);

            // Save session state
            const state = await ig.state.serialize();
            account.sessionData = { state, lastLogin: new Date() };
            account.status = 'connected';
            account.lastActivityAt = new Date();
            await account.save();

            console.log(`[Instagram API] ✅ Logged in successfully: ${account.username}`);
            this.clients.set(accountId, ig);
            return ig;
        } catch (error) {
            console.error(`[Instagram API] Login failed:`, error.message);
            account.status = 'error';
            await account.save();

            // Provide more specific error messages
            let errorMessage = 'Instagram login failed';

            if (error.message.includes('checkpoint_required')) {
                errorMessage = 'Instagram requires verification. Please login manually on Instagram app/website first, complete any verification, then try again.';
            } else if (error.message.includes('challenge_required')) {
                errorMessage = 'Instagram detected unusual activity. Please login manually and complete the challenge, then try again.';
            } else if (error.message.includes('two_factor_required') || error.message.includes('2FA')) {
                errorMessage = 'This account has Two-Factor Authentication enabled. Please disable 2FA or use an account without 2FA for automation.';
            } else if (error.message.includes('incorrect') || error.message.includes('password')) {
                errorMessage = 'Incorrect username or password. Please verify your credentials and try again.';
            } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
                errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
            } else {
                errorMessage = `Instagram login failed: ${error.message}`;
            }

            throw new Error(errorMessage);
        }
    }

    // Add account with username and password
    async addAccount(userId, username, password) {
        try {
            console.log(`[Instagram API] Adding account: ${username}`);

            // Encrypt password
            const encryptedPassword = this.encryptPassword(password);

            // Try to login first to validate credentials
            const ig = new IgApiClient();
            ig.state.generateDevice(username);

            try {
                await ig.account.login(username, password);
            } catch (loginError) {
                console.error(`[Instagram API] Login error:`, loginError);

                // Provide user-friendly error messages
                let errorMessage = 'Failed to add Instagram account';

                if (loginError.message.includes('checkpoint_required')) {
                    errorMessage = 'Instagram requires verification. Please:\n1. Login to Instagram on your phone/browser\n2. Complete any verification steps\n3. Try adding the account again';
                } else if (loginError.message.includes('challenge_required')) {
                    errorMessage = 'Instagram security challenge required. Please login manually first and complete the challenge.';
                } else if (loginError.message.includes('two_factor') || loginError.message.includes('2FA')) {
                    errorMessage = 'Two-Factor Authentication detected. Please disable 2FA or use a different account.';
                } else if (loginError.message.includes('incorrect') || loginError.message.includes('password')) {
                    errorMessage = 'Incorrect username or password. Please check your credentials.';
                } else if (loginError.message.includes('rate')) {
                    errorMessage = 'Too many attempts. Please wait 10-15 minutes and try again.';
                } else {
                    errorMessage = `Instagram error: ${loginError.message}`;
                }

                throw new Error(errorMessage);
            }

            const state = await ig.state.serialize();

            // Save account
            const account = await InstagramAccount.findOneAndUpdate(
                { userId, username },
                {
                    userId,
                    username,
                    password: encryptedPassword,
                    sessionData: { state, lastLogin: new Date() },
                    status: 'connected',
                    lastActivityAt: new Date()
                },
                { upsert: true, new: true }
            );

            console.log(`[Instagram API] ✅ Account added successfully: ${username}`);
            logger.info(`Instagram account added via API: ${username}`);

            // Cache the client
            this.clients.set(account._id.toString(), ig);

            return account;
        } catch (error) {
            console.error(`[Instagram API] Failed to add account:`, error.message);
            logger.error('Instagram addAccount error:', error);
            throw error;
        }
    }

    // Get all accounts for a user
    async getAccounts(userId) {
        return await InstagramAccount.find({ userId });
    }

    // Create a post (photo)
    async createPost(userId, accountId, imagePath, caption) {
        try {
            const ig = await this.getClient(accountId);

            console.log(`[Instagram API] Creating post with image: ${imagePath}`);

            if (!imagePath) {
                throw new Error('Image is required for Instagram posts');
            }

            // Read image file
            const fs = require('fs');
            const imageBuffer = fs.readFileSync(imagePath);

            // Publish photo
            const publishResult = await ig.publish.photo({
                file: imageBuffer,
                caption: caption || ''
            });

            console.log(`[Instagram API] ✅ Post published successfully! Media ID: ${publishResult.media.id}`);

            // Update last activity
            await InstagramAccount.findByIdAndUpdate(accountId, {
                lastActivityAt: new Date()
            });

            return {
                success: true,
                mediaId: publishResult.media.id,
                message: 'Posted successfully'
            };
        } catch (error) {
            console.error(`[Instagram API] Post failed:`, error.message);
            logger.error('Instagram createPost error:', error);
            throw error;
        }
    }

    // Send direct message
    async sendDM(userId, accountId, recipientUsername, message) {
        try {
            const ig = await this.getClient(accountId);

            console.log(`[Instagram API] Sending DM to ${recipientUsername}`);

            // Get user ID from username
            const userIdObj = await ig.user.getIdByUsername(recipientUsername);
            const userId = userIdObj ? userIdObj.toString() : null;

            if (!userId) {
                throw new Error('Could not get recipient user ID');
            }

            // Create thread and send message
            const thread = ig.entity.directThread([userId]);
            await thread.broadcastText(message);

            console.log(`[Instagram API] ✅ DM sent successfully to ${recipientUsername}`);

            // Update last activity
            await InstagramAccount.findByIdAndUpdate(accountId, {
                lastActivityAt: new Date()
            });

            return { success: true };
        } catch (error) {
            console.error(`[Instagram API] DM failed:`, error.message);
            logger.error('Instagram sendDM error:', error);
            throw error;
        }
    }

    // Remove account
    async removeAccount(userId, accountId) {
        // Remove from cache
        this.clients.delete(accountId);

        // Remove from database
        await InstagramAccount.findOneAndDelete({ _id: accountId, userId });
        return { success: true };
    }

    // Clear cached client (useful for re-login)
    clearClient(accountId) {
        this.clients.delete(accountId);
    }

    // Scraping Methods

    /**
     * Get followers list
     */
    async getFollowers(accountId) {
        try {
            const ig = await this.getClient(accountId);
            const account = await InstagramAccount.findById(accountId);

            if (!account) {
                throw new Error('Account not found');
            }

            console.log(`[Instagram API] Getting followers for username: ${account.username}`);

            // Get user ID from username
            let userId;
            try {
                const userIdResult = await ig.user.getIdByUsername(account.username);
                console.log(`[Instagram API] getIdByUsername result:`, userIdResult);

                // Handle different return types
                if (typeof userIdResult === 'string') {
                    userId = userIdResult;
                } else if (typeof userIdResult === 'number') {
                    userId = userIdResult.toString();
                } else if (userIdResult && typeof userIdResult === 'object') {
                    userId = userIdResult.toString();
                } else {
                    console.error(`[Instagram API] Unexpected userIdResult type:`, typeof userIdResult, userIdResult);
                    throw new Error(`Could not get user ID for username: ${account.username}`);
                }

                console.log(`[Instagram API] Converted userId:`, userId);
            } catch (error) {
                console.error(`[Instagram API] Error getting user ID:`, error);
                throw new Error(`Failed to get user ID for ${account.username}: ${error.message}`);
            }

            // Get followers feed
            const followersFeed = ig.feed.accountFollowers(userId);
            const followers = [];

            // Fetch first page (up to 200 followers)
            let items = await followersFeed.items();

            for (const user of items) {
                followers.push({
                    pk: user.pk,
                    username: user.username,
                    fullName: user.full_name,
                    profilePicUrl: user.profile_pic_url,
                    isVerified: user.is_verified,
                    isPrivate: user.is_private
                });
            }

            logger.info(`Fetched ${followers.length} followers for account ${accountId}`);
            return followers;
        } catch (error) {
            logger.error(`Get followers error:`, error);
            throw error;
        }
    }

    /**
     * Get following list
     */
    async getFollowing(accountId) {
        try {
            const ig = await this.getClient(accountId);
            const account = await InstagramAccount.findById(accountId);

            if (!account) {
                throw new Error('Account not found');
            }

            // Get user ID from username
            const userIdObj = await ig.user.getIdByUsername(account.username);
            const userId = userIdObj ? userIdObj.toString() : null;

            if (!userId) {
                throw new Error('Could not get user ID');
            }

            // Get following feed
            const followingFeed = ig.feed.accountFollowing(userId);
            const following = [];

            // Fetch first page (up to 200 following)
            let items = await followingFeed.items();

            for (const user of items) {
                following.push({
                    pk: user.pk,
                    username: user.username,
                    fullName: user.full_name,
                    profilePicUrl: user.profile_pic_url,
                    isVerified: user.is_verified,
                    isPrivate: user.is_private
                });
            }

            logger.info(`Fetched ${following.length} following for account ${accountId}`);
            return following;
        } catch (error) {
            logger.error(`Get following error:`, error);
            throw error;
        }
    }

    /**
     * Get user posts
     */
    async getPosts(accountId, targetUsername = null) {
        try {
            const ig = await this.getClient(accountId);
            const account = await InstagramAccount.findById(accountId);

            if (!account) {
                throw new Error('Account not found');
            }

            // Use target username or own username
            const username = targetUsername || account.username;
            const userIdObj = await ig.user.getIdByUsername(username);
            const userId = userIdObj ? userIdObj.toString() : null;

            if (!userId) {
                throw new Error('Could not get user ID');
            }

            // Get user feed
            const userFeed = ig.feed.user(userId);
            const posts = [];

            // Fetch first page (up to 12 posts)
            let items = await userFeed.items();

            for (const post of items) {
                posts.push({
                    id: post.id || '',
                    code: post.code || '',
                    takenAt: post.taken_at || 0,
                    mediaType: post.media_type || 0,
                    imageUrl: post.image_versions2?.candidates?.[0]?.url || '',
                    caption: post.caption?.text || '',
                    likeCount: post.like_count || 0,
                    commentCount: post.comment_count || 0,
                    user: {
                        username: post.user?.username || 'unknown',
                        fullName: post.user?.full_name || ''
                    }
                });
            }

            logger.info(`Fetched ${posts.length} posts for ${username}`);
            return posts;
        } catch (error) {
            logger.error(`Get posts error:`, error);
            throw error;
        }
    }

    /**
     * Get post comments
     */
    async getComments(accountId, mediaId) {
        try {
            const ig = await this.getClient(accountId);

            if (!mediaId) {
                throw new Error('Media ID is required');
            }

            // Get comments feed
            const commentsFeed = ig.feed.mediaComments(mediaId);
            const comments = [];

            // Fetch first page (up to 50 comments)
            let items = await commentsFeed.items();

            for (const comment of items) {
                comments.push({
                    pk: comment.pk || '',
                    text: comment.text || '',
                    createdAt: comment.created_at || 0,
                    user: {
                        pk: comment.user?.pk || '',
                        username: comment.user?.username || 'unknown',
                        fullName: comment.user?.full_name || '',
                        profilePicUrl: comment.user?.profile_pic_url || ''
                    },
                    likeCount: comment.comment_like_count || 0
                });
            }

            logger.info(`Fetched ${comments.length} comments for media ${mediaId}`);
            return comments;
        } catch (error) {
            logger.error(`Get comments error:`, error);
            throw error;
        }
    }
}

module.exports = new InstagramApiService();
