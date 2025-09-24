'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyProfileImage extends Model {
    static associate(models) {
      // 🔗 Empresa associada
      CompanyProfileImage.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });
    }
  }

  CompanyProfileImage.init(
    {
      companyProfileImageId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_profile_image_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      fileUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'file_url',
        validate: {
          isUrl: true,
        },
        comment: 'URL da imagem de perfil da empresa (CDN ou armazenamento interno)',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descrição opcional da imagem (acessibilidade, legenda, finalidade)',
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'CompanyProfileImage',
      tableName: 'company_profile_image',
      underscored: true,
      timestamps: true,
      updatedAt: false,
      paranoid: false,
    }
  );

  return CompanyProfileImage;
};
