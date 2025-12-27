// src/core/alerts/alert.service.ts
// Service para alertas críticos em produção
import { logger } from '../logging/logger';

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  level: AlertLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

class AlertService {
  private alertHandlers: Array<(alert: Alert) => Promise<void>> = [];

  /**
   * Registra handler de alerta (ex: email, Slack, PagerDuty)
   */
  registerHandler(handler: (alert: Alert) => Promise<void>) {
    this.alertHandlers.push(handler);
  }

  /**
   * Envia alerta
   */
  async sendAlert(level: AlertLevel, message: string, context?: Record<string, any>) {
    const alert: Alert = {
      level,
      message,
      context,
      timestamp: new Date(),
    };

    // Sempre loga
    logger[level](message, { context, alert: true });

    // Envia para handlers registrados
    for (const handler of this.alertHandlers) {
      try {
        await handler(alert);
      } catch (error) {
        logger.error('Erro ao enviar alerta', { error, alert });
      }
    }
  }

  /**
   * Alerta crítico (exige ação imediata)
   */
  async critical(message: string, context?: Record<string, any>) {
    await this.sendAlert('critical', message, context);
  }

  /**
   * Alerta de erro
   */
  async error(message: string, context?: Record<string, any>) {
    await this.sendAlert('error', message, context);
  }

  /**
   * Alerta de warning
   */
  async warning(message: string, context?: Record<string, any>) {
    await this.sendAlert('warning', message, context);
  }

  /**
   * Alerta informativo
   */
  async info(message: string, context?: Record<string, any>) {
    await this.sendAlert('info', message, context);
  }
}

export const alertService = new AlertService();

// Handler padrão: email (se configurado)
if (process.env.ALERT_EMAIL) {
  alertService.registerHandler(async (alert) => {
    // TODO: Implementar envio de email
    // Por enquanto, apenas loga
    if (alert.level === 'critical' || alert.level === 'error') {
      logger.warn('Email de alerta não implementado', { alert });
    }
  });
}

// Handler padrão: Slack (se configurado)
if (process.env.SLACK_WEBHOOK_URL) {
  alertService.registerHandler(async (alert) => {
    try {
      const response = await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 [${alert.level.toUpperCase()}] ${alert.message}`,
          attachments: alert.context
            ? [
                {
                  color: alert.level === 'critical' ? 'danger' : alert.level === 'error' ? 'warning' : 'good',
                  fields: Object.entries(alert.context).map(([key, value]) => ({
                    title: key,
                    value: String(value),
                    short: true,
                  })),
                },
              ]
            : [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Erro ao enviar alerta para Slack', { error, alert });
    }
  });
}













