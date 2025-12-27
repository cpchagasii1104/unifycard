import type { Schedule, ScheduleRow, ScheduleSlot, ScheduleSlotRow } from './schedule.types';
export declare class ScheduleModel {
    static fromRow(row: ScheduleRow): Schedule;
    static fromRows(rows: ScheduleRow[]): Schedule[];
    static toRow(schedule: Partial<Schedule>): Partial<ScheduleRow>;
}
export declare class ScheduleSlotModel {
    static fromRow(row: ScheduleSlotRow): ScheduleSlot;
    static fromRows(rows: ScheduleSlotRow[]): ScheduleSlot[];
    static toRow(slot: Partial<ScheduleSlot>): Partial<ScheduleSlotRow>;
}
//# sourceMappingURL=schedule.model.d.ts.map