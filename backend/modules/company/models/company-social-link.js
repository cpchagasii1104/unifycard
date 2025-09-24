'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanySocialLink extends Model {
    static associate(models) {
      // 🔗 Empresa vinculada
      CompanySocialLink.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });
    }
  }

  CompanySocialLink.init(
    {
      companySocialLinkId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_social_link_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Tipo da rede social ou canal (ex: instagram, linkedin, whatsapp, site)',
      },
      label: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Rótulo customizável para exibição pública (ex: "@unifycard")',
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          isUrl: true,
        },
        comment: 'Link da rede social, perfil, página ou canal',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
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
      modelName: 'CompanySocialLink',
      tableName: 'company_social_link',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanySocialLink;
};
