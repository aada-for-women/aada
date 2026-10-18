import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AADA boutique shop call to action', () => {
  render(<App />);
  const ctaElement = screen.getByText(/SHOP THE COLLECTION/i);
  expect(ctaElement).toBeInTheDocument();
});
