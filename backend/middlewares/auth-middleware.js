const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      user_id: decoded.user_id || decoded.id || decoded.sub || decoded.uid, // compatibilidade
      id: decoded.user_id || decoded.id || decoded.sub || decoded.uid
    };
    next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE] Token inválido:', err);
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
  }
}

module.exports = authMiddleware;
