import type { FastifyInstance } from 'fastify';
import { availabilityController } from './availability.controller';

export async function availabilityRoutes(app: FastifyInstance) {
  app.post('/rides/drivers/availability/online', (req, reply) =>
    availabilityController.setOnline(req, reply),
  );

  app.post('/rides/drivers/:driverId/availability/offline', (req, reply) =>
    availabilityController.setOffline(req, reply),
  );

  app.post('/rides/drivers/availability/destination', (req, reply) =>
    availabilityController.setDestinationMode(req, reply),
  );

  app.post('/rides/drivers/:driverId/:tenantId/availability/destination/disable', (req, reply) =>
    availabilityController.disableDestinationMode(req, reply),
  );

  app.get('/rides/drivers/:driverId/availability', (req, reply) =>
    availabilityController.getAvailability(req, reply),
  );
}
