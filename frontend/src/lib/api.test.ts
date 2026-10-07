import { apiUrl } from './api';

describe('apiUrl', () => {
  it('adds parameters, skipping empty ones and joining lists', () => {
    expect(apiUrl('/programmes', { q: 'nursing', page: 2, region: undefined, field: '' })).toBe(
      '/api/programmes?q=nursing&page=2',
    );
    expect(apiUrl('/scholarships', { availability: ['open', 'upcoming'] })).toBe(
      '/api/scholarships?availability=open%2Cupcoming',
    );
    expect(apiUrl('/grades')).toBe('/api/grades');
  });
});
