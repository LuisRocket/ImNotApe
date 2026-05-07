import type { Challenge } from '$lib/types';

// 카탈로그 + (legacy) daily 모두 로드. catalog가 우선.
const catalogModules = import.meta.glob<Challenge>('../../content/catalog/*.json', {
  eager: true,
  import: 'default'
});
const dailyModules = import.meta.glob<Challenge>('../../content/daily/*.json', {
  eager: true,
  import: 'default'
});

export const prerender = true;

export function load() {
  // _index.json은 제외
  const catalog = Object.entries(catalogModules)
    .filter(([path]) => !path.endsWith('_index.json'))
    .map(([path, mod]) => {
      const slug = path.match(/([A-Z0-9.-]+)-FY\d+/)?.[0] ?? '';
      return { slug, mod };
    })
    .filter((e) => e.slug)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const daily = Object.entries(dailyModules)
    .map(([path, mod]) => {
      const date = path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
      return { date, mod };
    })
    .filter((e) => e.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (catalog.length === 0 && daily.length === 0) {
    throw new Error('No challenges found in content/catalog/ or content/daily/');
  }

  // 모든 challenge를 풀로 반환 (런타임에서 오늘 날짜 기반으로 선택)
  const pool = [
    ...catalog.map((c) => ({ id: c.slug, source: 'catalog' as const, data: c.mod })),
    ...daily.map((d) => ({ id: d.date, source: 'daily' as const, data: d.mod }))
  ];

  return {
    pool,
    catalogCount: catalog.length,
    dailyCount: daily.length
  };
}
