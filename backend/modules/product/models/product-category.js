'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductCategory extends Model {
    static associate(models) {
      // 🔄 Relacionamento reverso com produtos
      ProductCategory.hasMany(models.Product, {
        foreignKey: 'category_id',
        as: 'products',
        onDelete: 'SET NULL',
      });

      // 🔁 Suporte a hierarquia de categorias (pai/filho)
      ProductCategory.belongsTo(models.ProductCategory, {
        foreignKey: 'parent_id',
        as: 'parent',
        onDelete: 'SET NULL',
      });

      ProductCategory.hasMany(models.ProductCategory, {
        foreignKey: 'parent_id',
        as: 'children',
        onDelete: 'SET NULL',
      });
    }
  }

  ProductCategory.init(
    {
      productCategoryId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'product_category_id',
      },
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'parent_id',
        comment: 'Categoria pai (suporte a árvore de categorias)',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      slug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
        comment: 'URL amigável para filtros e SEO',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      iconUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'icon_url',
        validate: {
          isUrl: true,
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'sort_order',
        comment: 'Ordem de exibição no catálogo',
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
      deletedAt: {
        type: DataTypes.DATE,
        field: 'deleted_at',
      },
    },
    {
      sequelize,
      modelName: 'ProductCategory',
      tableName: 'product_category',
      underscored: true,
      timestamps: true,
      paranoid: true, // exclusão lógica (soft delete)
    }
  );

  return ProductCategory;
};
