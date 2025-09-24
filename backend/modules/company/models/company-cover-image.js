'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyCoverImage extends Model {
    static associate(models) {
      // 🔗 Empresa vinculada
      CompanyCoverImage.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 👤 Usuário que fez o upload
      CompanyCoverImage.belongsTo(models.UserProfile, {
        foreignKey: 'uploaded_by',
        as: 'uploader',
        onDelete: 'SET NULL',
      });
    }
  }

  CompanyCoverImage.init(
    {
      companyCoverImageId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_cover_image_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'image_url',
        validate: {
          isUrl: true,
        },
        comment: 'URL da imagem de capa (armazenada em CDN ou S3)',
      },
      uploadedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'uploaded_by',
        comment: 'user_profile_id de quem enviou a imagem',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
        comment: 'Indica se esta é a capa atual em uso',
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
      modelName: 'CompanyCoverImage',
      tableName: 'company_cover_image',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanyCoverImage;
};
