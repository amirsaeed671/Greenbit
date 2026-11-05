import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: () => {} }),
}));

describe('App', () => {
  it('opens on Today with an empty state, no quote in the way, and the author credit', async () => {
    const { default: App } = await import('./App');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(await screen.findByText(/Nothing due today/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Quote of the day')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Amir Ali' })[0]).toHaveAttribute('href', 'https://amir-ali.me');
  });
});
