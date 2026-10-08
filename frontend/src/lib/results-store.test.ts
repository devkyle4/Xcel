import { resultsStore } from './results-store';

describe('resultsStore', () => {
  afterEach(() => resultsStore.clear());

  it('keeps results in sessionStorage only', () => {
    resultsStore.set({ ENGLISH: 'B3' });
    expect(JSON.parse(sessionStorage.getItem('xcel:wassce-results')!)).toEqual({ ENGLISH: 'B3' });
    expect(localStorage.length).toBe(0);
  });

  it('clears results', () => {
    resultsStore.set({ ENGLISH: 'B3' });
    resultsStore.clear();
    expect(resultsStore.get()).toBeNull();
    expect(sessionStorage.getItem('xcel:wassce-results')).toBeNull();
  });

  it('ignores corrupted or invalid stored data', () => {
    sessionStorage.setItem('xcel:wassce-results', '{not json');
    resultsStore.reload();
    expect(resultsStore.get()).toBeNull();
    sessionStorage.setItem('xcel:wassce-results', JSON.stringify({ ENGLISH: 42 }));
    resultsStore.reload();
    expect(resultsStore.get()).toBeNull();
  });

  it('keeps working when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    resultsStore.set({ PHYSICS: 'A1' });
    expect(resultsStore.get()).toEqual({ PHYSICS: 'A1' });
    spy.mockRestore();
  });
});
