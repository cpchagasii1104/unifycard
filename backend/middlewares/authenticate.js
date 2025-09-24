const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // 'Bearer TOKEN'

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Aqui estará: { user_id, email }
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return res.status(403).json({ message: 'Token inválido.' });
  }
};
