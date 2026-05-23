// src/modules/social-actions/social-actions.types.ts

export type ActionStatus = 'available' | 'executed' | 'failed' | 'cancelled';

export interface SocialAction {
  actionId: string;
  postId: string;
  tenantId: string;
  globalUserId: string;
  intent: string;
  confidence: number | null;
  parameters: Record<string, any>;
  status: ActionStatus;
  executionResult?: Record<string, any> | null;
  createdAt: string;
  executedAt: Date | null;
}

export interface SocialActionRow {
  action_id: string;
  post_id: string;
  tenant_id: string;
  global_user_id: string;
  intent: string;
  confidence: number | null;
  parameters: any; // JSONB
  status: string;
  execution_result: any; // JSONB
  created_at: string | Date;
  executed_at: Date | null;
}

export interface CreateActionInput {
  postId: string;
  intent: string;
  confidence?: number;
  parameters: Record<string, any>;
}

export interface ExecuteActionResult {
  success: boolean;
  actionId: string;
  intent: string;
  result?: any;
  error?: string;
  executedAt: Date;
}


















