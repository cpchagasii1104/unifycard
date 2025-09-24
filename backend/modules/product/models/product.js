'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      // 🔗 Empresa proprietária
      Product.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 📦 Categoria
      Product.belongsTo(models.ProductCategory, {
        foreignKey: 'category_id',
        as: 'category',
        onDelete: 'SET NULL',
      });

      // 🖼️ Imagens
      Product.hasMany(models.ProductImage, {
        foreignKey: 'product_id',
        as: 'images',
        onDelete: 'CASCADE',
      });

      // 📊 Estoque
      Product.hasOne(models.ProductStock, {
        foreignKey: 'product_id',
        as: 'stock',
        onDelete: 'CASCADE',
      });

      // 💰 Histórico de preços
      Product.hasMany(models.ProductPriceHistory, {
        foreignKey: 'product_id',
        as: 'priceHistory',
        onDelete: 'CASCADE',
      });
    }
  }

  Product.init(
    {
      productId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'product_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'category_id',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'BRL',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      isVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_visible',
        comment: 'Determina se o produto está visível no catálogo público',
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'Palavras-chave para busca e filtragem',
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'product',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return Product;
};
