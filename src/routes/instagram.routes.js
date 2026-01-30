const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagram.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

// Account management (for scraping purposes)
router.post('/accounts', instagramController.addAccount); // Add account for scraping
router.get('/accounts', instagramController.getAccounts);
router.delete('/account/:accountId', instagramController.removeAccount);

// Scraping routes
router.get('/followers/:accountId', instagramController.getFollowers);
router.get('/following/:accountId', instagramController.getFollowing);
router.get('/posts/:accountId', instagramController.getPosts);
router.get('/comments/:postId', instagramController.getComments);

// Posting/DM routes REMOVED (as per user request)
// router.post('/create-post', upload.single('image'), instagramController.createPost);
// router.post('/send-dm', instagramController.sendDM);

module.exports = router;
