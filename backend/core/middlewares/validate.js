// /backend/core/middleware/validate.js

/**
 * Middleware para validar dados de requisição com Joi
 * @param {Joi.Schema} schema - Esquema de validação
 * @returns {Function}
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({ error: messages });
    }
    next();
  };
}

module.exports = validate;
