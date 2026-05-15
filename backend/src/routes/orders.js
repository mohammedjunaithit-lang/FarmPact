const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ========================================
// CREATE ORDER (POST /api/orders)
// ========================================
// Customer buys a crop
// REQUIRES: JWT token
// REQUEST BODY: cropId, quantity

router.post('/', verifyToken, async (req, res) => {
  try {
    const { cropId, quantity } = req.body;
    const customerId = req.user.userId; // Buyer

    // Validation
    if (!cropId || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'cropId and quantity are required',
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity must be greater than 0',
      });
    }

    // STEP 1: Find the crop
    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: { vendor: true },
    });

    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop not found',
      });
    }

    // STEP 2: Check if enough quantity is available
    if (crop.quantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Only ${crop.quantity}${crop.unit} available`,
      });
    }

    // STEP 3: Calculate total price
    const totalPrice = crop.price * quantity;

    // STEP 4: Create order
    const order = await prisma.order.create({
      data: {
        cropId,
        quantity: parseInt(quantity),
        totalPrice,
        vendorId: crop.vendorId, // The farmer selling the crop
        customerId, // The buyer
        status: 'PENDING', // Default status
      },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            price: true,
            unit: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // STEP 5: Decrease crop quantity
    await prisma.crop.update({
      where: { id: cropId },
      data: {
        quantity: crop.quantity - quantity,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
    });
  }
});

// ========================================
// LIST ORDERS (GET /api/orders)
// ========================================
// Show all orders where user is vendor OR customer
// REQUIRES: JWT token
// OPTIONAL QUERY: status (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    // Build where clause
    const where = {
      OR: [
        { vendorId: userId }, // Orders where user is selling
        { customerId: userId }, // Orders where user is buying
      ],
    };

    // Add status filter if provided
    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            price: true,
            unit: true,
            category: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
    });
  }
});

// ========================================
// GET SINGLE ORDER (GET /api/orders/:id)
// ========================================
// View details of one order

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            price: true,
            unit: true,
            category: true,
            description: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        review: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Check if user is vendor or customer
    if (order.vendorId !== userId && order.customerId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this order',
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
    });
  }
});

// ========================================
// UPDATE ORDER STATUS (PUT /api/orders/:id)
// ========================================
// Vendor updates order status
// REQUIRES: JWT token, must be the vendor
// REQUEST BODY: status (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required',
      });
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Find order
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Check if user is the vendor
    if (order.vendorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the vendor can update order status',
      });
    }

    // If status is CANCELLED, restore crop quantity
    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      const crop = await prisma.crop.findUnique({
        where: { id: order.cropId },
      });

      if (crop) {
        await prisma.crop.update({
          where: { id: order.cropId },
          data: {
            quantity: crop.quantity + order.quantity,
          },
        });
      }
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
    });
  }
});

module.exports = router;
