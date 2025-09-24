'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyAddress extends Model {
    static associate(models) {
      // 📌 Empresa relacionada
      CompanyAddress.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 🌎 Bairro
      CompanyAddress.belongsTo(models.Neighborhood, {
        foreignKey: 'neighborhood_id',
        as: 'neighborhood',
        onDelete: 'SET NULL',
      });

      // 🏙️ Cidade
      CompanyAddress.belongsTo(models.City, {
        foreignKey: 'city_id',
        as: 'city',
        onDelete: 'SET NULL',
      });

      // 🗺️ Estado
      CompanyAddress.belongsTo(models.State, {
        foreignKey: 'state_id',
        as: 'state',
        onDelete: 'SET NULL',
      });
    }
  }

  CompanyAddress.init(
    {
      companyAddressId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_address_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      street: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      number: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      complement: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      neighborhoodId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'neighborhood_id',
      },
      cityId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'city_id',
      },
      stateId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'state_id',
      },
      cep: {
        type: DataTypes.CHAR(8),
        validate: {
          is: /^\d{8}$/,
        },
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'CompanyAddress',
      tableName: 'company_address',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanyAddress;
};
