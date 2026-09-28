import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryCity, queryProvince } from './service';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

describe('account settings service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns local city options without calling remote request', async () => {
    const cities = await queryCity('330000');
    expect(request).not.toHaveBeenCalled();
    expect(Array.isArray(cities)).toBe(true);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities[0]).toHaveProperty('label');
    expect(cities[0]).toHaveProperty('key');
  });

  it('returns local province options without calling remote request', async () => {
    const provinces = await queryProvince();
    expect(request).not.toHaveBeenCalled();
    expect(provinces.length).toBeGreaterThan(0);
  });
});
