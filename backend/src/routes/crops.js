const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ========================================
// CREATE CROP (POST /api/crops)
// ========================================
// Farmers list a crop for sale
// REQUIRES: JWT token
// REQUEST BODY: name, price, quantity, unit, category, description

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, price, quantity, unit, category, description } = req.body;
    const vendorId = req.user.userId; // From JWT token

    // Validation
    if (!name || !price || !quantity || !category) {
      return res.status(400).json({
        success: false,
        error: 'name, price, quantity, and category are required',
      });
    }

    if (price <= 0 || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'price and quantity must be greater than 0',
      });
    }

    // Create crop in database
    const crop = await prisma.crop.create({
      data: {
        name,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        unit: unit || 'kg',
        category,
        description: description || '',
        vendorId,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Crop listed successfully',
      crop,
    });
  } catch (error) {
    console.error('Create crop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create crop',
    });
  }
});

// ========================================
// LIST ALL CROPS (GET /api/crops)
// ========================================
// Public endpoint - anyone can browse all crops
// OPTIONAL QUERY PARAMS: category, minPrice, maxPrice, vendorId

router.get('/', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, vendorId } = req.query;

    // Build filter object
    const where = {};

    if (category) {
      where.category = category; // Exact match
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    // Fetch crops with filters
    const crops = await prisma.crop.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    res.status(200).json({
      success: true,
      count: crops.length,
      crops,
    });
  } catch (error) {
    console.error('List crops error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch crops',
    });
  }
});

// ========================================
// GET SINGLE CROP (GET /api/crops/:id)
// ========================================
// View details of one crop including vendor info

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const crop = await prisma.crop.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        // In the future, add orders and reviews here
      },
    });

    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop not found',
      });
    }

    res.status(200).json({
      success: true,
      crop,
    });
  } catch (error) {
    console.error('Get crop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch crop',
    });
  }
});

// ========================================
// UPDATE CROP (PUT /api/crops/:id)
// ========================================
// Only the vendor (owner) can edit their crop
// REQUIRES: JWT token, must be the crop owner

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, quantity, unit, category, description } = req.body;
    const userId = req.user.userId;

    // Find crop
    const crop = await prisma.crop.findUnique({
      where: { id },
    });

    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop not found',
      });
    }

    // Check if user is the owner (vendor)
    if (crop.vendorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own crops',
      });
    }

    // Update crop
    const updatedCrop = await prisma.crop.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(price && { price: parseFloat(price) }),
        ...(quantity && { quantity: parseInt(quantity) }),
        ...(unit && { unit }),
        ...(category && { category }),
        ...(description && { description }),
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Crop updated successfully',
      crop: updatedCrop,
    });
  } catch (error) {
    console.error('Update crop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update crop',
    });
  }
});

// ========================================
// DELETE CROP (DELETE /api/crops/:id)
// ========================================
// Only the vendor (owner) can delete their crop
// REQUIRES: JWT token, must be the crop owner

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Find crop
    const crop = await prisma.crop.findUnique({
      where: { id },
    });

    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop not found',
      });
    }

    // Check if user is the owner (vendor)
    if (crop.vendorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own crops',
      });
    }

    // Delete crop
    await prisma.crop.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Crop deleted successfully',
    });
  } catch (error) {
    console.error('Delete crop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete crop',
    });
  }
});

module.exports = router;
