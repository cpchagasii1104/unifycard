'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyEmployee extends Model {
    static associate(models) {
      // 🔗 Empresa
      CompanyEmployee.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 👤 Usuário (base)
      CompanyEmployee.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
      });

      // 🔐 Permissões específicas do funcionário
      CompanyEmployee.hasOne(models.CompanyPermission, {
        foreignKey: 'company_employee_id',
        as: 'permissions',
        onDelete: 'CASCADE',
      });

      // 📅 Agendas (vínculo direto com agendamentos)
      CompanyEmployee.hasMany(models.Schedule, {
        foreignKey: 'employee_id',
        as: 'schedules',
        onDelete: 'SET NULL',
      });
    }
  }

  CompanyEmployee.init(
    {
      companyEmployeeId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_employee_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      role: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Descrição do cargo ou função do colaborador',
      },
      status: {
        type: DataTypes.ENUM(
          'active',
          'inactive',
          'pending',
          'blocked',
          'deleted'
        ),
        defaultValue: 'active',
      },
      joinedAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'joined_at',
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
      modelName: 'CompanyEmployee',
      tableName: 'company_employee',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanyEmployee;
};
