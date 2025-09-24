'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyPermission extends Model {
    static associate(models) {
      // 🔗 Funcionário da empresa
      CompanyPermission.belongsTo(models.CompanyEmployee, {
        foreignKey: 'company_employee_id',
        as: 'employee',
        onDelete: 'CASCADE',
      });

      // 🔗 Filial associada (futuro uso em restrições regionais)
      CompanyPermission.belongsTo(models.CompanyBranch, {
        foreignKey: 'branch_id',
        as: 'branch',
        onDelete: 'SET NULL',
      });
    }
  }

  CompanyPermission.init(
    {
      companyPermissionId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_permission_id',
      },
      companyEmployeeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_employee_id',
      },
      branchId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'branch_id',
        comment: 'Permissões podem ser específicas por filial',
      },

      // 🔒 Ações permitidas (booleans)
      canEditProfile: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_edit_profile',
      },
      canManageProducts: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_manage_products',
      },
      canManageSchedule: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_manage_schedule',
      },
      canViewFinancials: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_view_financials',
      },
      canManageEmployees: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_manage_employees',
      },
      canManageOrders: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_manage_orders',
      },
      canEditAds: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_edit_ads',
      },
      canViewInsights: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'can_view_insights',
      },

      // 🛡️ Permissão administrativa total
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_admin',
        comment: 'Permissão total no escopo da empresa (override)',
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
      modelName: 'CompanyPermission',
      tableName: 'company_permission',
      underscored: true,
      timestamps: true,
      paranoid: false,
    }
  );

  return CompanyPermission;
};
