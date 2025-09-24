'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductStock extends Model {
    static associate(models) {
      // 🔗 Produto vinculado
      ProductStock.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product',
        onDelete: 'CASCADE',
      });

      // 🏢 Filial (futuro)
      ProductStock.belongsTo(models.CompanyBranch, {
        foreignKey: 'branch_id',
        as: 'branch',
        onDelete: 'SET NULL',
      });
    }
  }

  ProductStock.init(
    {
      productStockId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'product_stock_id',
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      branchId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'branch_id',
        comment: 'Filial onde o estoque está localizado',
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      reserved: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0,
        },
        comment: 'Quantidade reservada (ex: em pedidos não finalizados)',
      },
      minimum: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'minimum',
        validate: {
          min: 0,
        },
        comment: 'Estoque mínimo recomendado para alerta',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'ProductStock',
      tableName: 'product_stock',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return ProductStock;
};
