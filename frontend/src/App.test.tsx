import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the platform heading and admission disclaimer', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Discovery Platform');
    expect(
      screen.getByText(/final admission decisions are made by the institution/i),
    ).toBeInTheDocument();
  });
});
