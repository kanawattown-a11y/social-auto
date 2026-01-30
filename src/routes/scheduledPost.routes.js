const express = require('express');
const router = express.Router();
const scheduledPostController = require('../controllers/scheduledPost.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Create scheduled post (with optional image upload)
router.post('/', protect, upload.single('media'), scheduledPostController.createScheduledPost);

// Get all scheduled posts (with optional filters)
router.get('/', protect, scheduledPostController.getScheduledPosts);

// Update scheduled post
router.put('/:id', protect, upload.single('media'), scheduledPostController.updateScheduledPost);

// Delete scheduled post
router.delete('/:id', protect, scheduledPostController.deleteScheduledPost);

// Post immediately
router.post('/:id/post-now', protect, scheduledPostController.postNow);

module.exports = router;
