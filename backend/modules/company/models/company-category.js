'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyCategory extends Model {
    static associate(models) {
      // 🔄 Relacionamento reverso futuro com empresas, se necessário (não obrigatório agora)
      // models.Company.belongsTo(models.CompanyCategory, { ... })
    }
  }

  CompanyCategory.init(
    {
      companyCategoryId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        field: 'company_category_id',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      slug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
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
      modelName: 'CompanyCategory',
      tableName: 'company_category',
      underscored: true,
      timestamps: true,
      paranoid: true, // para suportar exclusão lógica (deleted_at)
    }
  );

  return CompanyCategory;
};
