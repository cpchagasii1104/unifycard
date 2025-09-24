'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductImage extends Model {
    static associate(models) {
      // 🔗 Produto vinculado
      ProductImage.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product',
        onDelete: 'CASCADE',
      });
    }
  }

  ProductImage.init(
    {
      productImageId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'product_image_id',
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'image_url',
        validate: {
          isUrl: true,
        },
        comment: 'URL da imagem do produto (armazenada em CDN ou S3)',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Legenda ou descrição acessível da imagem',
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_primary',
        comment: 'Indica se esta é a imagem principal do produto',
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'sort_order',
        comment: 'Ordem de exibição na galeria',
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
      modelName: 'ProductImage',
      tableName: 'product_image',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return ProductImage;
};
