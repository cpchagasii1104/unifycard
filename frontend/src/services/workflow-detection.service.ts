// frontend/src/services/workflow-detection.service.ts
// CONTINUOUS PRODUCTION: Serviço de Detecção de Workflows - SPRINT 7
// Detecta automaticamente em qual passo do workflow o usuário está

import type { Workflow, WorkflowStep, WorkflowStatus } from '../types/workflow';
import { listCompanies } from '../api/companies';
import { listCompanyMembers } from '../api/companyMembers';
import { getBankBalance, getBankStatement } from '../api/bank';
import { getUserGroupAllocations } from '../api/group-allocation';
import { getMyGroups } from '../api/groups';
import { detectPendingActions } from './pending-actions.service';
import { checkOperationalState } from './operational-limits.service';

interface WorkflowContext {
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'project';
  userId?: string;
  companyId?: string;
}

/**
 * Detecta workflows disponíveis e retorna o mais relevante
 */
export async function detectActiveWorkflow(
  context: WorkflowContext
): Promise<Workflow | null> {
  try {
    // Verificar workflows em ordem de prioridade
    const workflows: Workflow[] = [];

    if (context.actorType === 'user') {
      // Workflow: Onboard Company
      const onboardCompany = await detectOnboardCompanyWorkflow(context);
      if (onboardCompany && onboardCompany.status !== 'not_applicable') {
        workflows.push(onboardCompany);
      }

      // Workflow: Onboard Group
      const onboardGroup = await detectOnboardGroupWorkflow(context);
      if (onboardGroup && onboardGroup.status !== 'not_applicable') {
        workflows.push(onboardGroup);
      }

      // Workflow: Earn and Understand Money
      const earnMoney = await detectEarnAndUnderstandMoneyWorkflow(context);
      if (earnMoney && earnMoney.status !== 'not_applicable') {
        workflows.push(earnMoney);
      }
    }

    if (context.actorType === 'page') {
      // Workflow: Delegate and Act (para empresas)
      const delegateAndAct = await detectDelegateAndActWorkflow(context);
      if (delegateAndAct && delegateAndAct.status !== 'not_applicable') {
        workflows.push(delegateAndAct);
      }
    }

    // Retornar o workflow mais relevante (primeiro não completado)
    const activeWorkflow = workflows.find(w => w.status !== 'completed');
    return activeWorkflow || null;
  } catch (error) {
    console.warn('Erro ao detectar workflows:', error);
    return null;
  }
}

/**
 * Workflow: Onboard Company
 * Fluxo para criar e configurar uma empresa
 */
async function detectOnboardCompanyWorkflow(
  context: WorkflowContext
): Promise<Workflow> {
  const steps: WorkflowStep[] = [];
  let currentStepIndex = 0;

  try {
    // Passo 1: Criar empresa
    const companies = await listCompanies().catch(() => []);
    const hasCompany = companies.length > 0;
    
    steps.push({
      id: 'create_company',
      title: 'Criar sua primeira empresa',
      description: 'Registre uma empresa para começar a operar como pessoa jurídica.',
      action: {
        label: 'Criar Empresa',
        path: '/empresas',
      },
      isRequired: true,
      isCompleted: hasCompany,
      isBlocked: false,
    });

    if (!hasCompany) {
      return {
        id: 'onboard_company',
        title: 'Configurar Empresa',
        description: 'Crie e configure sua empresa para começar a operar.',
        status: 'available',
        currentStepIndex: 0,
        steps,
      };
    }

    // Passo 2: Adicionar colaboradores
    const firstCompany = companies[0];
    const members = await listCompanyMembers(firstCompany.companyId).catch(() => []);
    const hasMembers = members.length > 0;

    steps.push({
      id: 'add_members',
      title: 'Adicionar colaboradores',
      description: 'Convide membros da equipe para sua empresa.',
      action: {
        label: 'Gerenciar Equipe',
        path: `/empresa/${firstCompany.companyId}`,
      },
      isRequired: true,
      isCompleted: hasMembers,
      isBlocked: false,
    });

    if (!hasMembers) {
      currentStepIndex = 1;
    }

    // Passo 3: Entender economia (opcional)
    const balance = await getBankBalance().catch(() => null);
    // Saldo em centavos (canônico §4.7); fallback para `balance` legado.
    const balanceCents = balance ? (balance.balanceCents ?? balance.balance ?? 0) : 0;
    const hasBalance = balance !== null && balanceCents !== 0;

    steps.push({
      id: 'understand_economy',
      title: 'Entender como o dinheiro é distribuído',
      description: 'Veja como os recursos financeiros são distribuídos na plataforma.',
      action: {
        label: 'Ver Distribuição',
        path: '/home',
      },
      isRequired: false,
      isCompleted: hasBalance,
      isBlocked: false,
    });

    // Determinar status
    let status: WorkflowStatus = 'completed';
    if (!hasCompany) {
      status = 'available';
    } else if (!hasMembers) {
      status = 'available';
    } else if (!hasBalance) {
      status = 'available';
    }

    return {
      id: 'onboard_company',
      title: 'Configurar Empresa',
      description: 'Crie e configure sua empresa para começar a operar.',
      status,
      currentStepIndex,
      steps,
    };
  } catch (error) {
    return {
      id: 'onboard_company',
      title: 'Configurar Empresa',
      description: 'Crie e configure sua empresa para começar a operar.',
      status: 'not_applicable',
      currentStepIndex: 0,
      steps: [],
    };
  }
}

/**
 * Workflow: Onboard Group
 * Fluxo para participar de grupos e configurar alocação
 */
async function detectOnboardGroupWorkflow(
  context: WorkflowContext
): Promise<Workflow> {
  const steps: WorkflowStep[] = [];
  let currentStepIndex = 0;

  try {
    // Passo 1: Participar de grupos
    const groups = await getMyGroups().catch(() => ({ groups: [] }));
    const hasGroups = groups.groups.length > 0;

    steps.push({
      id: 'join_groups',
      title: 'Participar de grupos',
      description: 'Explore e participe de grupos comunitários na plataforma.',
      action: {
        label: 'Ver Grupos',
        path: '/grupos',
      },
      isRequired: true,
      isCompleted: hasGroups,
      isBlocked: false,
    });

    if (!hasGroups) {
      return {
        id: 'onboard_group',
        title: 'Participar de Grupos',
        description: 'Participe de grupos e configure como seus lucros são distribuídos.',
        status: 'available',
        currentStepIndex: 0,
        steps,
      };
    }

    // Passo 2: Configurar alocação (opcional)
    const allocations = await getUserGroupAllocations().catch(() => []);
    const hasAllocation = allocations.length > 0;

    steps.push({
      id: 'configure_allocation',
      title: 'Configurar alocação para grupos',
      description: 'Defina como seus lucros serão distribuídos entre os grupos.',
      action: {
        label: 'Configurar Alocação',
        path: '/grupos',
      },
      isRequired: false,
      isCompleted: hasAllocation,
      isBlocked: false,
    });

    if (!hasAllocation) {
      currentStepIndex = 1;
    }

    const status: WorkflowStatus = hasGroups && hasAllocation ? 'completed' : 'available';

    return {
      id: 'onboard_group',
      title: 'Participar de Grupos',
      description: 'Participe de grupos e configure como seus lucros são distribuídos.',
      status,
      currentStepIndex,
      steps,
    };
  } catch (error) {
    return {
      id: 'onboard_group',
      title: 'Participar de Grupos',
      description: 'Participe de grupos e configure como seus lucros são distribuídos.',
      status: 'not_applicable',
      currentStepIndex: 0,
      steps: [],
    };
  }
}

/**
 * Workflow: Delegate and Act
 * Fluxo para delegar e atuar como empresa
 */
async function detectDelegateAndActWorkflow(
  context: WorkflowContext
): Promise<Workflow> {
  const steps: WorkflowStep[] = [];
  let currentStepIndex = 0;

  try {
    const companyId = context.companyId || context.actorId;

    // Passo 1: Adicionar colaboradores
    const members = await listCompanyMembers(companyId).catch(() => []);
    const hasMembers = members.length > 0;

    steps.push({
      id: 'add_members',
      title: 'Adicionar colaboradores',
      description: 'Convide membros da equipe para operar em nome da empresa.',
      action: {
        label: 'Convidar Colaborador',
        path: `/empresa/${companyId}`,
      },
      isRequired: true,
      isCompleted: hasMembers,
      isBlocked: false,
    });

    if (!hasMembers) {
      return {
        id: 'delegate_and_act',
        title: 'Configurar Delegação',
        description: 'Configure sua empresa para permitir que colaboradores atuem em seu nome.',
        status: 'available',
        currentStepIndex: 0,
        steps,
      };
    }

    // Passo 2: Entender permissões (opcional)
    steps.push({
      id: 'understand_permissions',
      title: 'Entender permissões',
      description: 'Veja como as permissões funcionam e como gerenciar acessos.',
      action: {
        label: 'Ver Permissões',
        path: `/empresa/${companyId}`,
      },
      isRequired: false,
      isCompleted: true, // Assumindo que se tem membros, já entendeu
      isBlocked: false,
    });

    const status: WorkflowStatus = hasMembers ? 'completed' : 'available';

    return {
      id: 'delegate_and_act',
      title: 'Configurar Delegação',
      description: 'Configure sua empresa para permitir que colaboradores atuem em seu nome.',
      status,
      currentStepIndex,
      steps,
    };
  } catch (error) {
    return {
      id: 'delegate_and_act',
      title: 'Configurar Delegação',
      description: 'Configure sua empresa para permitir que colaboradores atuem em seu nome.',
      status: 'not_applicable',
      currentStepIndex: 0,
      steps: [],
    };
  }
}

/**
 * Workflow: Earn and Understand Money
 * Fluxo para entender como ganhar e como o dinheiro é distribuído
 */
async function detectEarnAndUnderstandMoneyWorkflow(
  context: WorkflowContext
): Promise<Workflow> {
  const steps: WorkflowStep[] = [];
  let currentStepIndex = 0;

  try {
    // Passo 1: Ver saldo
    const balance = await getBankBalance().catch(() => null);
    const hasBalance = balance !== null;

    steps.push({
      id: 'view_balance',
      title: 'Ver seu saldo',
      description: 'Acesse sua carteira para ver seu saldo atual.',
      action: {
        label: 'Ver Carteira',
        path: '/banco',
      },
      isRequired: true,
      isCompleted: hasBalance,
      isBlocked: false,
    });

    if (!hasBalance) {
      return {
        id: 'earn_and_understand_money',
        title: 'Entender Economia',
        description: 'Aprenda como ganhar e como o dinheiro é distribuído na plataforma.',
        status: 'available',
        currentStepIndex: 0,
        steps,
      };
    }

    // Passo 2: Ver distribuição (opcional)
    const statement = await getBankStatement({ limit: 1 }).catch(() => ({ entries: [], total: 0, hasMore: false }));
    const hasTransactions = statement.entries.length > 0;

    steps.push({
      id: 'understand_distribution',
      title: 'Entender distribuição',
      description: 'Veja como o dinheiro é distribuído quando você recebe pagamentos.',
      action: {
        label: 'Ver Distribuição',
        path: '/home',
      },
      isRequired: false,
      isCompleted: hasTransactions,
      isBlocked: false,
    });

    if (!hasTransactions) {
      currentStepIndex = 1;
    }

    // Passo 3: Configurar alocação (opcional)
    const groups = await getMyGroups().catch(() => ({ groups: [] }));
    const allocations = await getUserGroupAllocations().catch(() => []);
    const hasGroups = groups.groups.length > 0;
    const hasAllocation = allocations.length > 0;

    if (hasGroups && !hasAllocation) {
      steps.push({
        id: 'configure_allocation',
        title: 'Configurar alocação para grupos',
        description: 'Defina como seus lucros serão distribuídos entre os grupos.',
        action: {
          label: 'Configurar Alocação',
          path: '/grupos',
        },
        isRequired: false,
        isCompleted: false,
        isBlocked: false,
      });
      currentStepIndex = 2;
    }

    const status: WorkflowStatus = hasBalance && hasTransactions ? 'completed' : 'available';

    return {
      id: 'earn_and_understand_money',
      title: 'Entender Economia',
      description: 'Aprenda como ganhar e como o dinheiro é distribuído na plataforma.',
      status,
      currentStepIndex,
      steps,
    };
  } catch (error) {
    return {
      id: 'earn_and_understand_money',
      title: 'Entender Economia',
      description: 'Aprenda como ganhar e como o dinheiro é distribuído na plataforma.',
      status: 'not_applicable',
      currentStepIndex: 0,
      steps: [],
    };
  }
}







