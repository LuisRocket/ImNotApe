import type { Challenge } from '$lib/types';

const modules = import.meta.glob<Challenge>('../../content/daily/*.json', {
  eager: true,
  import: 'default'
});

export const prerender = true;

export function load() {
  const entries = Object.entries(modules)
    .map(([path, mod]) => {
      const date = path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
      return { date, mod };
    })
    .filter((e) => e.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) {
    throw new Error('No daily challenges found in content/daily/');
  }

  return {
    challenge: entries[0].mod
  };
}
