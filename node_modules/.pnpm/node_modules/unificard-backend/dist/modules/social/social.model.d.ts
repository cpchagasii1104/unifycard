import type { Post, PostRow } from './social.types';
export declare class SocialModel {
    static fromRow(row: PostRow): Post;
    static fromRows(rows: PostRow[]): Post[];
    static toRow(post: Partial<Post>): Partial<PostRow>;
}
//# sourceMappingURL=social.model.d.ts.map