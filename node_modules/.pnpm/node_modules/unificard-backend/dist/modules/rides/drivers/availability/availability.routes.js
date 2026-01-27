"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityRoutes = availabilityRoutes;
const availability_controller_1 = require("./availability.controller");
async function availabilityRoutes(app) {
    app.post('/rides/drivers/availability/online', (req, reply) => availability_controller_1.availabilityController.setOnline(req, reply));
    app.post('/rides/drivers/:driverId/availability/offline', (req, reply) => availability_controller_1.availabilityController.setOffline(req, reply));
    app.post('/rides/drivers/availability/destination', (req, reply) => availability_controller_1.availabilityController.setDestinationMode(req, reply));
    app.post('/rides/drivers/:driverId/:tenantId/availability/destination/disable', (req, reply) => availability_controller_1.availabilityController.disableDestinationMode(req, reply));
    app.get('/rides/drivers/:driverId/availability', (req, reply) => availability_controller_1.availabilityController.getAvailability(req, reply));
}
