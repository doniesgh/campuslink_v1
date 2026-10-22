const express = require('express');
const {
  signup,
  login,
  verifyOtp,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');
const {
  authRateLimit,
  authIpRateLimit,
  changePasswordRateLimit,
  resetPasswordRateLimit,
} = require('../middleware/rateLimit');

const router = express.Router();

router.post('/signup', authRateLimit('signup'), authIpRateLimit, signup);
router.post('/login', authRateLimit('login'), authIpRateLimit, login);
router.post('/verify-otp', authRateLimit('verify-otp'), authIpRateLimit, verifyOtp);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authRateLimit('forgot-password'), authIpRateLimit, forgotPassword);
router.post('/reset-password', resetPasswordRateLimit, resetPassword);
router.post('/change-password', requireAuth, changePasswordRateLimit, changePassword);

module.exports = router;
