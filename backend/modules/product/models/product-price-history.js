'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductPriceHistory extends Model {
    static associate(models) {
      // 🔗 Produto vinculado
      ProductPriceHistory.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product',
        onDelete: 'CASCADE',
      });

      // 👤 Usuário que alterou (opcional)
      ProductPriceHistory.belongsTo(models.User, {
        foreignKey: 'updated_by',
        as: 'updatedBy',
        onDelete: 'SET NULL',
      });
    }
  }

  ProductPriceHistory.init(
    {
      productPriceHistoryId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'product_price_history_id',
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      oldPrice: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        field: 'old_price',
      },
      newPrice: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        field: 'new_price',
      },
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'BRL',
      },
      changeType: {
        type: DataTypes.ENUM('manual', 'promotion', 'automatic'),
        defaultValue: 'manual',
        field: 'change_type',
        comment: 'Identifica o motivo da mudança de preço',
      },
      updatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'updated_by',
        comment: 'user_id de quem fez a alteração (opcional)',
      },
      changedAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'changed_at',
      },
    },
    {
      sequelize,
      modelName: 'ProductPriceHistory',
      tableName: 'product_price_history',
      underscored: true,
      timestamps: false,
    }
  );

  return ProductPriceHistory;
};
