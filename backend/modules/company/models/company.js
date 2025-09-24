'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    static associate(models) {
      // 📎 Endereço principal
      Company.hasOne(models.CompanyAddress, {
        foreignKey: 'company_id',
        as: 'address',
        onDelete: 'CASCADE',
      });

      // 📄 Perfil completo
      Company.hasOne(models.CompanyProfile, {
        foreignKey: 'company_id',
        as: 'profile',
        onDelete: 'CASCADE',
      });

      // 🖼️ Imagem de perfil
      Company.hasOne(models.CompanyProfileImage, {
        foreignKey: 'company_id',
        as: 'profileImage',
        onDelete: 'CASCADE',
      });

      // 🏞️ Imagem de capa
      Company.hasOne(models.CompanyCoverImage, {
        foreignKey: 'company_id',
        as: 'coverImage',
        onDelete: 'CASCADE',
      });

      // 🔗 Redes sociais
      Company.hasMany(models.CompanySocialLink, {
        foreignKey: 'company_id',
        as: 'socialLinks',
        onDelete: 'CASCADE',
      });

      // 👥 Funcionários
      Company.hasMany(models.CompanyEmployee, {
        foreignKey: 'company_id',
        as: 'employees',
        onDelete: 'CASCADE',
      });

      // 🕒 Horários
      Company.hasMany(models.CompanySchedule, {
        foreignKey: 'company_id',
        as: 'schedules',
        onDelete: 'CASCADE',
      });

      // 🏬 Filiais
      Company.hasMany(models.CompanyBranch, {
        foreignKey: 'company_id',
        as: 'branches',
        onDelete: 'CASCADE',
      });

      // 🛒 Produtos
      Company.hasMany(models.Product, {
        foreignKey: 'company_id',
        as: 'products',
        onDelete: 'CASCADE',
      });

      // 🔧 Campos personalizados
      Company.hasMany(models.CompanyCustomField, {
        foreignKey: 'company_id',
        as: 'customFields',
        onDelete: 'CASCADE',
      });

      // 📅 Agendamentos diretos
      Company.hasMany(models.Schedule, {
        foreignKey: 'company_id',
        as: 'scheduleSlots',
        onDelete: 'CASCADE',
      });

      // 🔐 Permissões dos funcionários
      Company.hasMany(models.CompanyPermission, {
        foreignKey: 'company_id',
        as: 'permissions',
        onDelete: 'CASCADE',
      });
    }
  }

  Company.init(
    {
      companyId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_id',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      cnpj: {
        type: DataTypes.BLOB, // Criptografado com pgcrypto (BYTEA)
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        validate: {
          isEmail: true,
        },
      },
      phone: {
        type: DataTypes.STRING(20),
      },
      companyType: {
        type: DataTypes.ENUM('MEI', 'LTDA', 'EIRELI', 'SA'),
        field: 'company_type',
      },
      companySize: {
        type: DataTypes.ENUM('micro', 'pequena', 'media', 'grande'),
        field: 'company_size',
      },
      companySector: {
        type: DataTypes.ENUM(
          'industria',
          'comercio',
          'servicos',
          'tecnologia',
          'agropecuaria',
          'educacao',
          'saude',
          'financeiro',
          'governo',
          'outro'
        ),
        field: 'company_sector',
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
      modelName: 'Company',
      tableName: 'company',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return Company;
};
