// src/modules/rides/shared/payment.ts
//
// Fluxo de pagamento da corrida (DEPRECATED - usar distribution.service.ts)
// Este arquivo foi mantido para compatibilidade, mas o processamento real
// está em distribution.service.ts que usa SplitEngine

import { distributionService } from "../distribution/distribution.service";
import { BadRequestError } from "@core/errors";

export interface ProcessRidePaymentInput {
  tenantId: string;
  rideId: string;
  passengerId: string;
  driverId: string;
  totalAmount: number;
  platformFeePercent: number;
  communityFeePercent: number;
  driverIncentives: number;
  tipAmount: number;
}

export async function processRidePayment(input: ProcessRidePaymentInput) {
  // DEPRECATED: Este método foi mantido para compatibilidade
  // O processamento real está em distribution.service.ts que usa SplitEngine
  // Este método apenas delega para distributionService.processRidePayment
  
  const { tenantId, rideId, passengerId, driverId, totalAmount } = input;

  if (!tenantId || !rideId) {
    throw new BadRequestError("Missing tenantId or rideId for payment processing");
  }

  // Buscar ride completo
  const { runQueryWithTenant } = await import("@core/db");
  const ride = await runQueryWithTenant<any>(
    tenantId,
    {
      text: `
        SELECT ride_id, passenger_user_id, driver_id, service_type_id, final_price
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
        LIMIT 1
      `,
      values: [tenantId, rideId],
    }
  );

  if (!ride) {
    throw new BadRequestError("Ride not found");
  }

  // Delegar para distributionService que usa SplitEngine
  return await distributionService.processRidePayment(
    tenantId,
    ride,
    { total: totalAmount || ride.final_price || 0 }
  );
}