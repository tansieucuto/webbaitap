const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth');

router.get('/', reviewController.listReviews);
router.post('/', authenticate, reviewController.createReview);

module.exports = router;
