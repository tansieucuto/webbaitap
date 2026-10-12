const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, reviewController.createReview);
router.get('/', reviewController.listReviews); // Used as nested route in products

module.exports = router;
