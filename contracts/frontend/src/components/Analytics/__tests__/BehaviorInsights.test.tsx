import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BehaviorInsights } from '../BehaviorInsights';

// Mock the recharts components
jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar"></div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie"></div>,
  Cell: () => <div data-testid="cell"></div>,
  XAxis: () => <div data-testid="x-axis"></div>,
  YAxis: () => <div data-testid="y-axis"></div>,
  CartesianGrid: () => <div data-testid="cartesian-grid"></div>,
  Tooltip: () => <div data-testid="tooltip"></div>,
  Legend: () => <div data-testid="legend"></div>,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock fetch
global.fetch = jest.fn();

describe('BehaviorInsights Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders behavior insights component', () => {
    render(<BehaviorInsights />);
    
    expect(screen.getByText('User Behavior Insights')).toBeInTheDocument();
    expect(screen.getByText('Understand how users interact with your platform')).toBeInTheDocument();
  });

  it('renders view tabs', () => {
    render(<BehaviorInsights />);
    
    expect(screen.getByText('Segments')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Patterns')).toBeInTheDocument();
  });

  it('displays segments view by default', () => {
    render(<BehaviorInsights />);
    
    const segmentsTab = screen.getByText('Segments');
    expect(segmentsTab).toHaveClass('bg-blue-600', 'text-white');
  });

  it('switches to features view when clicked', () => {
    render(<BehaviorInsights />);
    
    const featuresTab = screen.getByText('Features');
    fireEvent.click(featuresTab);
    
    expect(featuresTab).toHaveClass('bg-blue-600', 'text-white');
  });

  it('switches to patterns view when clicked', () => {
    render(<BehaviorInsights />);
    
    const patternsTab = screen.getByText('Patterns');
    fireEvent.click(patternsTab);
    
    expect(patternsTab).toHaveClass('bg-blue-600', 'text-white');
  });

  it('displays user statistics cards', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        segments: [
          {
            segmentName: 'Power Users',
            userCount: 450,
            loginFrequency: 8.5,
            sessionDuration: 2400,
            featureUsage: { 'proof_creation': 15 }
          }
        ],
        featureUsage: [
          {
            featureName: 'Proof Creation',
            usageCount: 15420,
            uniqueUsers: 3200,
            adoptionRate: 85.5
          }
        ]
      })
    });

    render(<BehaviorInsights />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('Avg Session')).toBeInTheDocument();
      expect(screen.getByText('Active Features')).toBeInTheDocument();
      expect(screen.getByText('Engagement Rate')).toBeInTheDocument();
    });
  });

  it('fetches data on component mount', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        segments: [],
        featureUsage: []
      })
    });

    render(<BehaviorInsights />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/user-behavior?userId=undefined&timeframe=30d'
      );
    });
  });

  it('displays segments content when segments tab is active', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        segments: [
          {
            segmentName: 'Power Users',
            userCount: 450,
            loginFrequency: 8.5,
            sessionDuration: 2400,
            featureUsage: { 'proof_creation': 15 }
          }
        ],
        featureUsage: []
      })
    });

    render(<BehaviorInsights />);
    
    await waitFor(() => {
      expect(screen.getByText('User Segments')).toBeInTheDocument();
      expect(screen.getByText('Segment Details')).toBeInTheDocument();
    });
  });

  it('displays features content when features tab is active', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        segments: [],
        featureUsage: [
          {
            featureName: 'Proof Creation',
            usageCount: 15420,
            uniqueUsers: 3200,
            adoptionRate: 85.5
          }
        ]
      })
    });

    render(<BehaviorInsights />);
    
    const featuresTab = screen.getByText('Features');
    fireEvent.click(featuresTab);
    
    await waitFor(() => {
      expect(screen.getByText('Feature Usage')).toBeInTheDocument();
    });
  });

  it('displays patterns content when patterns tab is active', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        segments: [],
        featureUsage: []
      })
    });

    render(<BehaviorInsights />);
    
    const patternsTab = screen.getByText('Patterns');
    fireEvent.click(patternsTab);
    
    await waitFor(() => {
      expect(screen.getByText('Behavior Patterns')).toBeInTheDocument();
      expect(screen.getByText('Time-based Patterns')).toBeInTheDocument();
      expect(screen.getByText('Interaction Patterns')).toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<BehaviorInsights />);
    
    // Should not crash and should still render the component
    expect(screen.getByText('User Behavior Insights')).toBeInTheDocument();
  });
});
