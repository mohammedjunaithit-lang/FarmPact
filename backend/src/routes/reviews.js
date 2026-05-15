const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ========================================
// CREATE REVIEW (POST /api/reviews)
// ========================================
// Leave a review on an order
// REQUIRES: JWT token
// REQUEST BODY: orderId, rating, comment (optional)
// Only possible if order status is DELIVERED

router.post('/', verifyToken, async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    const reviewerId = req.user.userId; // Who is writing the review

    // Validation
    if (!orderId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'orderId and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'rating must be between 1 and 5',
      });
    }

    // STEP 1: Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        review: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // STEP 2: Check if order is DELIVERED
    if (order.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        error: 'Can only review delivered orders',
      });
    }

    // STEP 3: Check if review already exists
    if (order.review) {
      return res.status(400).json({
        success: false,
        error: 'This order already has a review',
      });
    }

    // STEP 4: Check if user is involved in the order
    // Either the customer or vendor can review
    if (order.customerId !== reviewerId && order.vendorId !== reviewerId) {
      return res.status(403).json({
        success: false,
        error: 'You can only review orders you are involved in',
      });
    }

    // STEP 5: Determine who is being reviewed
    // Customer reviews the vendor (seller)
    // Vendor reviews the customer (buyer)
    let revieweeId;
    if (order.customerId === reviewerId) {
      revieweeId = order.vendorId; // Customer reviews vendor
    } else {
      revieweeId = order.customerId; // Vendor reviews customer
    }

    // STEP 6: Create review
    const review = await prisma.review.create({
      data: {
        orderId,
        rating: parseInt(rating),
        comment: comment || '',
        reviewerId,
        revieweeId,
      },
      include: {
        order: {
          select: {
            id: true,
            crop: {
              select: {
                name: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review,
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create review',
    });
  }
});

// ========================================
// GET REVIEWS FOR USER (GET /api/reviews/:userId)
// ========================================
// Get all reviews about a specific user (their rating)

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all reviews where this user is being reviewed
    const reviews = await prisma.review.findMany({
      where: {
        revieweeId: userId,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
        order: {
          select: {
            id: true,
            crop: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      userId,
      averageRating: parseFloat(avgRating),
      totalReviews: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews',
    });
  }
});

module.exports = router;
