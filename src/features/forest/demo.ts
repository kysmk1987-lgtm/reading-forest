import type { ForestTree } from './model';

export const DEMO_FOREST_ID = 'demo';

const cover = (id: number, ts: string) => `https://t1.daumcdn.net/lbook/image/${id}?timestamp=${ts}`;

/** Sample forest used for the shareable-page demo while Supabase is not connected. */
export const DEMO_FOREST = {
  nickname: '숲속 책벌레',
  baseWaterCount: 27,
  trees: [
    { id: 'd1', bookId: 'kr_9788936434120', title: '소년이 온다', coverUrl: cover(532683, '20260930111213'), status: 'read', percent: 100, species: 'apple', createdAt: 1 },
    { id: 'd2', bookId: 'kr_9791198363510', title: '아몬드', coverUrl: cover(6381968, '20260528150556'), status: 'read', percent: 100, species: 'round', createdAt: 2 },
    { id: 'd3', bookId: 'kr_9791161571188', title: '불편한 편의점', coverUrl: cover(5643183, '20261006121959'), status: 'reading', percent: 72, species: 'pine', createdAt: 3 },
    { id: 'd4', bookId: 'kr_9788932917245', title: '어린 왕자', coverUrl: cover(507587, '20251119111036'), status: 'reading', percent: 40, species: 'round', createdAt: 4 },
    { id: 'd5', bookId: 'kr_9788937460449', title: '데미안', coverUrl: cover(540810, '20260826111023'), status: 'stopped', percent: 20, species: 'pine', createdAt: 5 },
    { id: 'd6', bookId: 'kr_9788936434595', title: '채식주의자', coverUrl: cover(6042324, '20260930122525'), status: 'reading', percent: 15, species: 'apple', createdAt: 6 },
    { id: 'd7', bookId: 'kr_9791165341909', title: '달러구트 꿈 백화점', coverUrl: cover(5416922, '20260701140519'), status: 'want', percent: 0, species: 'round', createdAt: 7 },
  ] satisfies ForestTree[] as ForestTree[],
};
