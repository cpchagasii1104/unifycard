const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/gender-identity', async (req, res) => {
  try {
    const result = await pool.query(`SELECT unnest(enum_range(NULL::gender_identity)) AS value`);
    const values = result.rows.map(row => row.value);
    res.json(values);
  } catch (err) {
    console.error('Erro ao buscar ENUM gender_identity:', err);
    res.status(500).json({ error: 'Erro ao buscar opções de identidade de gênero' });
  }
});

module.exports = router;

