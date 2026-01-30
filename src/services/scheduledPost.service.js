const ScheduledPost = require('../models/scheduledPost.model');
const instagramService = require('./instagram.service');
const telegramService = require('./telegram.service');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class ScheduledPostService {
    // Create a new scheduled post
    async createScheduledPost(userId, postData) {
        try {
            const scheduledPost = new ScheduledPost({
                userId,
                platform: postData.platform,
                accountId: postData.accountId,
                targetId: postData.targetId, // New field
                postType: postData.postType || 'image',
                content: {
                    caption: postData.caption || '',
                    mediaPath: postData.mediaPath,
                    mediaUrl: postData.mediaUrl
                },
                scheduledTime: new Date(postData.scheduledTime),
                status: 'pending'
            });

            await scheduledPost.save();
            logger.info(`Scheduled post created: ${scheduledPost._id}`);
            return scheduledPost;
        } catch (error) {
            logger.error('Create scheduled post error:', error);
            throw error;
        }
    }

    // Get all scheduled posts for a user
    async getScheduledPosts(userId, filters = {}) {
        try {
            const query = { userId };

            if (filters.platform) {
                query.platform = filters.platform;
            }

            if (filters.status) {
                query.status = filters.status;
            }

            const posts = await ScheduledPost.find(query)
                .sort({ scheduledTime: 1 })
                .lean();

            return posts;
        } catch (error) {
            logger.error('Get scheduled posts error:', error);
            throw error;
        }
    }

    // Update a scheduled post
    async updateScheduledPost(userId, postId, updateData) {
        try {
            const post = await ScheduledPost.findOne({ _id: postId, userId });

            if (!post) {
                throw new Error('Scheduled post not found');
            }

            if (post.status === 'posted') {
                throw new Error('Cannot edit already posted content');
            }

            if (updateData.caption !== undefined) {
                post.content.caption = updateData.caption;
            }

            if (updateData.scheduledTime) {
                post.scheduledTime = new Date(updateData.scheduledTime);
            }

            if (updateData.mediaPath) {
                // Delete old file if exists
                if (post.content.mediaPath && fs.existsSync(post.content.mediaPath)) {
                    fs.unlinkSync(post.content.mediaPath);
                }
                post.content.mediaPath = updateData.mediaPath;
            }

            await post.save();
            logger.info(`Scheduled post updated: ${postId}`);
            return post;
        } catch (error) {
            logger.error('Update scheduled post error:', error);
            throw error;
        }
    }

    // Delete a scheduled post
    async deleteScheduledPost(userId, postId) {
        try {
            const post = await ScheduledPost.findOne({ _id: postId, userId });

            if (!post) {
                throw new Error('Scheduled post not found');
            }

            // Delete associated media file
            if (post.content.mediaPath && fs.existsSync(post.content.mediaPath)) {
                fs.unlinkSync(post.content.mediaPath);
            }

            await ScheduledPost.deleteOne({ _id: postId });
            logger.info(`Scheduled post deleted: ${postId}`);
            return { success: true };
        } catch (error) {
            logger.error('Delete scheduled post error:', error);
            throw error;
        }
    }

    // Post immediately
    async postNow(userId, postId) {
        try {
            const post = await ScheduledPost.findOne({ _id: postId, userId });

            if (!post) {
                throw new Error('Scheduled post not found');
            }

            if (post.status === 'posted') {
                throw new Error('Post already published');
            }

            // Process the post
            await this.processPost(post);

            return post;
        } catch (error) {
            logger.error('Post now error:', error);
            throw error;
        }
    }

    // Process scheduled posts (called by scheduler)
    async processScheduledPosts() {
        try {
            const now = new Date();

            // Find all pending posts that should be posted
            const duePosts = await ScheduledPost.find({
                status: 'pending',
                scheduledTime: { $lte: now }
            });

            console.log(`[Scheduler] Found ${duePosts.length} posts to process`);

            for (const post of duePosts) {
                await this.processPost(post);
            }

            return duePosts.length;
        } catch (error) {
            logger.error('Process scheduled posts error:', error);
            return 0;
        }
    }

    // Process a single post
    async processPost(post) {
        try {
            console.log(`[Scheduler] Processing post ${post._id} for platform: ${post.platform}`);

            // Currently just mark as posted since Puppeteer is unstable
            // In future, can integrate actual posting logic

            if (post.platform === 'instagram') {
                // Determine absolute path for image if it exists
                let imagePath = null;
                if (post.content.mediaPath) {
                    // Start from CWD usually if relative, or use absolute
                    imagePath = path.isAbsolute(post.content.mediaPath)
                        ? post.content.mediaPath
                        : path.join(process.cwd(), post.content.mediaPath);
                }

                if (!imagePath && !post.content.caption) {
                    throw new Error("Cannot post empty content");
                }

                console.log(`[Scheduler] Calling Instagram Service with image: ${imagePath}`);

                await instagramService.createPost(
                    post.userId,
                    post.accountId,
                    imagePath,
                    post.content.caption
                );

                post.status = 'posted';
                post.postedAt = new Date();
                // clear error message if it succeeded
                post.errorMessage = null;
            } else if (post.platform === 'telegram') {
                console.log(`[Scheduler] Processing Telegram post for account ${post.accountId}`);

                // Determine absolute path for media if it exists
                let mediaPath = null;
                if (post.content.mediaPath) {
                    mediaPath = path.isAbsolute(post.content.mediaPath)
                        ? post.content.mediaPath
                        : path.join(process.cwd(), post.content.mediaPath);
                }

                if (!post.targetId) {
                    throw new Error("Telegram post requires a target Chat ID (targetId)");
                }

                if (post.postType === 'image' && mediaPath) {
                    await telegramService.sendPhoto(
                        post.userId,
                        post.accountId,
                        post.targetId,
                        mediaPath,
                        post.content.caption
                    );
                } else if (post.postType === 'video' && mediaPath) {
                    await telegramService.sendVideo(
                        post.userId,
                        post.accountId,
                        post.targetId,
                        mediaPath,
                        post.content.caption
                    );
                } else if (post.postType === 'text') {
                    await telegramService.sendMessage(
                        post.userId,
                        post.accountId,
                        post.targetId,
                        post.content.caption
                    );
                }

                post.status = 'posted';
                post.postedAt = new Date();
                post.errorMessage = null;
            } else {
                // Other platforms
                post.status = 'posted';
                post.postedAt = new Date();
            }

            await post.save();
            logger.info(`Post processed: ${post._id}`);

        } catch (error) {
            console.error(`[Scheduler] Failed to process post ${post._id}:`, error.message);

            post.status = 'failed';
            post.errorMessage = error.message;
            post.retryCount += 1;
            await post.save();

            logger.error(`Post failed: ${post._id}`, error);
        }
    }
}

module.exports = new ScheduledPostService();
