'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_DATABASE || '',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    dialect: 'postgres',
    logging: false,
  }
);

const db = {};

// 🔁 Carrega todos os modelos da pasta /database/models
const modelsDir = path.join(__dirname, 'models');

if (fs.existsSync(modelsDir)) {
  console.log(`[DB] 📂 Lendo modelos de: ${modelsDir}`);
  fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      const modelPath = path.join(modelsDir, file);
      const model = require(modelPath)(sequelize, DataTypes);
      db[model.name] = model;
      console.log(`[DB] ✅ Modelo carregado: ${model.name}`);
    });
} else {
  console.warn(`[DB] ⚠️ Pasta de modelos não encontrada: ${modelsDir}`);
}

// 🔗 Associações entre modelos (se houver)
Object.keys(db).forEach(modelName => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
    console.log(`[DB] 🔗 Associações aplicadas para: ${modelName}`);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
