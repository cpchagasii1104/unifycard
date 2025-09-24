'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyCustomFieldValue extends Model {
    static associate(models) {
      // 🔗 Campo ao qual o valor pertence
      CompanyCustomFieldValue.belongsTo(models.CompanyCustomField, {
        foreignKey: 'company_custom_field_id',
        as: 'customField',
        onDelete: 'CASCADE',
      });

      // 🔗 Empresa vinculada (reforço de integridade)
      CompanyCustomFieldValue.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });
    }
  }

  CompanyCustomFieldValue.init(
    {
      companyCustomFieldValueId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_custom_field_value_id',
      },
      companyCustomFieldId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_custom_field_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      fieldValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'field_value',
        comment: 'Valor armazenado do campo customizado (interpretado dinamicamente conforme o tipo)',
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
      modelName: 'CompanyCustomFieldValue',
      tableName: 'company_custom_field_value',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanyCustomFieldValue;
};
