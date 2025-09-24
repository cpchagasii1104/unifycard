const express = require('express');
const router = express.Router();
const loginController = require('../../user/controllers/login-controller');
const signupController = require('../../user/controllers/signup-controller');

/**
 * Rota de login
 * POST /api/login
 */
router.post('/login', loginController);

/**
 * Rota de cadastro
 * POST /api/signup
 */
router.post('/signup', signupController);

module.exports = router;
