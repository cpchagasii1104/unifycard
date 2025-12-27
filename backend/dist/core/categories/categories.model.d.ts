import type { Category, CategoryRow } from './categories.types';
export declare class CategoryModel {
    static fromRow(row: CategoryRow): Category;
    static fromRows(rows: CategoryRow[]): Category[];
    static toRow(category: Partial<Category>): Partial<CategoryRow>;
}
//# sourceMappingURL=categories.model.d.ts.map