'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyCustomField extends Model {
    static associate(models) {
      // 🔗 Empresa proprietária do campo
      CompanyCustomField.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 🔄 Valores vinculados a este campo
      CompanyCustomField.hasMany(models.CompanyCustomFieldValue, {
        foreignKey: 'company_custom_field_id',
        as: 'values',
        onDelete: 'CASCADE',
      });
    }
  }

  CompanyCustomField.init(
    {
      companyCustomFieldId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_custom_field_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      fieldKey: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'field_key',
        validate: {
          notEmpty: true,
        },
        comment: 'Chave única interna (ex: company_size, delivery_zone)',
      },
      fieldLabel: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'field_label',
        validate: {
          notEmpty: true,
        },
        comment: 'Rótulo visível para o usuário',
      },
      fieldType: {
        type: DataTypes.ENUM(
          'text',
          'textarea',
          'number',
          'date',
          'datetime',
          'boolean',
          'select',
          'multiselect',
          'file',
          'image',
          'phone',
          'email',
          'cpf',
          'cnpj',
          'url',
          'rating'
        ),
        allowNull: false,
        field: 'field_type',
      },
      fieldOptions: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
        field: 'field_options',
        comment: 'Usado quando o campo for select/multiselect (ex: lista de opções)',
      },
      isRequired: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_required',
      },
      isVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_visible',
        comment: 'Se deve aparecer no frontend ou ficar oculto (uso interno)',
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'sort_order',
        comment: 'Ordem de exibição',
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
      modelName: 'CompanyCustomField',
      tableName: 'company_custom_field',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanyCustomField;
};
