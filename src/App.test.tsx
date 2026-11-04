import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: () => {} }),
}));

describe('App', () => {
  it('shows the friendly empty state, a sourced quote and the author credit', async () => {
    const { default: App } = await import('./App');
    render(<App />);
    expect(await screen.findByText('Plant your first habit')).toBeInTheDocument();
    expect(screen.getByLabelText('Quote of the day').querySelector('cite')?.textContent).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Amir Ali' })[0]).toHaveAttribute('href', 'https://amir-ali.me');
  });
});
