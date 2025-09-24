// /backend/modules/hobby/controllers/hobby-enum-controller.js

const db = require('../../../config/db');

exports.getHobbyList = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'label_en' : 'label_pt';

    const query = `
      SELECT 
        h.hobby_code,
        h.${lang} AS hobby_label,
        h.topic_code AS category_code,
        t.${lang} AS category_label
      FROM hobby h
      JOIN hobby_topic t ON h.topic_code = t.topic_code
      ORDER BY t.${lang}, h.${lang};
    `;

    const { rows } = await db.query(query);

    const result = {};
    for (const row of rows) {
      const { category_code, category_label, hobby_code, hobby_label } = row;

      if (!result[category_code]) {
        result[category_code] = {
          category_code,
          category_label,
          hobbies: []
        };
      }

      result[category_code].hobbies.push({
        hobby_code,
        label: hobby_label
      });
    }

    return res.status(200).json(Object.values(result));
  } catch (err) {
    console.error('[getHobbyList] ERRO:', err);
    return res.status(500).json({ message: 'Erro ao buscar hobbies' });
  }
};
