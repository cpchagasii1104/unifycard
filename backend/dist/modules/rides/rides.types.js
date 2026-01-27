"use strict";
// =========================================================
// Rides Types – Unificard
// Estrutura completa alinhada às migrations 009–015
// =========================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverSessionStatus = exports.IncentiveType = exports.RideCancelledBy = exports.RideStatus = exports.RideRequestStatus = void 0;
// =========================================================
// ENUMS
// =========================================================
var RideRequestStatus;
(function (RideRequestStatus) {
    RideRequestStatus["Pending"] = "pending";
    RideRequestStatus["Searching"] = "searching";
    RideRequestStatus["Offered"] = "offered";
    RideRequestStatus["Cancelled"] = "cancelled";
})(RideRequestStatus || (exports.RideRequestStatus = RideRequestStatus = {}));
var RideStatus;
(function (RideStatus) {
    RideStatus["Assigned"] = "assigned";
    RideStatus["Arrived"] = "arrived";
    RideStatus["Started"] = "started";
    RideStatus["Completed"] = "completed";
    RideStatus["Cancelled"] = "cancelled";
})(RideStatus || (exports.RideStatus = RideStatus = {}));
var RideCancelledBy;
(function (RideCancelledBy) {
    RideCancelledBy["Driver"] = "driver";
    RideCancelledBy["Passenger"] = "passenger";
    RideCancelledBy["System"] = "system";
})(RideCancelledBy || (exports.RideCancelledBy = RideCancelledBy = {}));
var IncentiveType;
(function (IncentiveType) {
    IncentiveType["PerKm"] = "per_km";
    IncentiveType["PerRide"] = "per_ride";
    IncentiveType["Bonus"] = "bonus";
})(IncentiveType || (exports.IncentiveType = IncentiveType = {}));
var DriverSessionStatus;
(function (DriverSessionStatus) {
    DriverSessionStatus["Active"] = "active";
    DriverSessionStatus["Break"] = "break";
    DriverSessionStatus["ForcedBreak"] = "forced_break";
    DriverSessionStatus["Ended"] = "ended";
})(DriverSessionStatus || (exports.DriverSessionStatus = DriverSessionStatus = {}));
