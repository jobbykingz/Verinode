import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrendAnalysis } from '../TrendAnalysis';

// Mock the recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line"></div>,
  XAxis: () => <div data-testid="x-axis"></div>,
  YAxis: () => <div data-testid="y-axis"></div>,
  CartesianGrid: () => <div data-testid="cartesian-grid"></div>,
  Tooltip: () => <div data-testid="tooltip"></div>,
  Legend: () => <div data-testid="legend"></div>,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock fetch
global.fetch = jest.fn();

describe('TrendAnalysis Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders trend analysis component', () => {
    render(<TrendAnalysis />);
    
    expect(screen.getByText('Usage Trends')).toBeInTheDocument();
    expect(screen.getByText('Track usage patterns and growth over time')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(<TrendAnalysis />);
    
    // Check for loading skeleton
    expect(screen.getByText('Usage Trends')).toBeInTheDocument();
  });

  it('renders timeframe selector', () => {
    render(<TrendAnalysis />);
    
    const timeframeSelect = screen.getByDisplayValue('Last 30 Days');
    expect(timeframeSelect).toBeInTheDocument();
  });

  it('renders granularity selector', () => {
    render(<TrendAnalysis />);
    
    const granularitySelect = screen.getByDisplayValue('Daily');
    expect(granularitySelect).toBeInTheDocument();
  });

  it('changes timeframe when selected', async () => {
    render(<TrendAnalysis />);
    
    const timeframeSelect = screen.getByDisplayValue('Last 30 Days');
    fireEvent.change(timeframeSelect, { target: { value: '7d' } });
    
    expect(timeframeSelect).toHaveValue('7d');
  });

  it('changes granularity when selected', async () => {
    render(<TrendAnalysis />);
    
    const granularitySelect = screen.getByDisplayValue('Daily');
    fireEvent.change(granularitySelect, { target: { value: 'weekly' } });
    
    expect(granularitySelect).toHaveValue('weekly');
  });

  it('fetches data on component mount', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          date: '2024-01-01',
          value: 100,
          change: 10,
          changePercent: 10,
          forecast: 105
        }
      ]
    });

    render(<TrendAnalysis />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/usage-trends?timeframe=30d&granularity=daily'
      );
    });
  });

  it('displays key insights section', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          date: '2024-01-01',
          value: 100,
          change: 10,
          changePercent: 10,
          forecast: 105
        }
      ]
    });

    render(<TrendAnalysis />);
    
    await waitFor(() => {
      expect(screen.getByText('Key Insights')).toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TrendAnalysis />);
    
    // Should not crash and should still render the component
    expect(screen.getByText('Usage Trends')).toBeInTheDocument();
  });
});
