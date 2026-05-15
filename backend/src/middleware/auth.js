const jwt = require('jsonwebtoken');

// ========================================
// VERIFY JWT MIDDLEWARE
// ========================================
// This middleware checks if request has a valid JWT token
// If valid, extracts user ID and attaches to req.user
// If invalid, returns 401 error

const verifyToken = (req, res, next) => {
  try {
    // STEP 1: Get token from header
    // Frontend sends: Authorization: Bearer eyJ...
    // We extract "eyJ..." from the header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.slice(7); // "Bearer " is 7 characters

    // STEP 2: Verify token signature
    // jwt.verify checks that:
    // - Token wasn't tampered with (signature is valid)
    // - Token hasn't expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // STEP 3: Attach user data to request object
    // Now in route handlers, we can access req.user
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    // STEP 4: Pass control to next middleware/route
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    res.status(401).json({
      success: false,
      error: 'Token verification failed',
    });
  }
};

module.exports = { verifyToken };
