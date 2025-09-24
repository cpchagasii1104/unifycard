'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyProfile extends Model {
    static associate(models) {
      // 🔗 Empresa principal
      CompanyProfile.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 📈 Histórico de receitas e relatórios futuros
      CompanyProfile.hasMany(models.Product, {
        foreignKey: 'company_id',
        as: 'products',
        onDelete: 'CASCADE',
      });

      // 🏞️ Imagens (relacionadas via outros models)
      CompanyProfile.hasOne(models.CompanyProfileImage, {
        foreignKey: 'company_id',
        as: 'profileImage',
        onDelete: 'CASCADE',
      });
    }
  }

  CompanyProfile.init(
    {
      companyProfileId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_profile_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      legalRepresentativeName: {
        type: DataTypes.STRING(255),
        field: 'legal_representative_name',
        comment: 'Nome do representante legal da empresa',
      },
      foundingDate: {
        type: DataTypes.DATEONLY,
        field: 'founding_date',
      },
      website: {
        type: DataTypes.STRING(255),
        validate: {
          isUrl: true,
        },
      },
      numberOfEmployees: {
        type: DataTypes.INTEGER,
        field: 'number_of_employees',
        validate: {
          min: 0,
        },
      },
      annualRevenue: {
        type: DataTypes.DECIMAL(14, 2),
        field: 'annual_revenue',
        validate: {
          min: 0,
        },
      },
      acceptsGovernmentContracts: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'accepts_government_contracts',
      },
      hasInnovationArea: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'has_innovation_area',
      },
      receivesInvestments: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'receives_investments',
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'CompanyProfile',
      tableName: 'company_profile',
      underscored: true,
      timestamps: true,
      updatedAt: false,
      paranoid: false,
    }
  );

  return CompanyProfile;
};
