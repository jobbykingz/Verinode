import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChainSwitcher from '../ChainSwitcher';

// Mock window.ethereum
const mockEthereum = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
};

Object.defineProperty(window, 'ethereum', {
  value: mockEthereum,
  writable: true,
});

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: jest.fn().mockImplementation(() => ({
        listAccounts: jest.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
        getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
      })),
    },
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0x1234567890123456789012345678901234567890',
    })),
  },
}));

describe('ChainSwitcher', () => {
  const mockOnChainChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthereum.request.mockResolvedValue([]);
  });

  test('renders connect wallet button when wallet is not connected', () => {
    // Mock no accounts
    const mockProvider = {
      listAccounts: jest.fn().mockResolvedValue([]),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    };
    
    require('ethers').ethers.providers.Web3Provider.mockImplementation(() => mockProvider);
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    const connectButton = screen.getByText('Connect Wallet');
    expect(connectButton).toBeInTheDocument();
  });

  test('renders chain switcher when wallet is connected', async () => {
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  test('opens dropdown when chain switcher is clicked', async () => {
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    expect(screen.getByText('Select Network')).toBeInTheDocument();
    expect(screen.getByText('Polygon')).toBeInTheDocument();
    expect(screen.getByText('BSC')).toBeInTheDocument();
  });

  test('switches to different chain when clicked', async () => {
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    // Click on Polygon
    const polygonOption = screen.getByText('Polygon');
    fireEvent.click(polygonOption);
    
    expect(mockEthereum.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }], // 137 in hex
    });
  });

  test('adds new chain when not available in wallet', async () => {
    // Mock switch error (chain not added)
    mockEthereum.request
      .mockResolvedValueOnce([]) // First call for accounts
      .mockRejectedValueOnce({ code: 4902 }) // Switch error
      .mockResolvedValueOnce([]); // Add chain call
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown and click on Polygon
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    const polygonOption = screen.getByText('Polygon');
    fireEvent.click(polygonOption);
    
    await waitFor(() => {
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x89',
            chainName: 'Polygon',
            rpcUrls: ['https://polygon-rpc.com'],
            blockExplorerUrls: ['https://polygonscan.com'],
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18,
            },
          },
        ],
      });
    });
  });

  test('calls onChainChange callback when chain is switched', async () => {
    mockEthereum.request.mockResolvedValue([]);
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown and click on Polygon
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    const polygonOption = screen.getByText('Polygon');
    fireEvent.click(polygonOption);
    
    await waitFor(() => {
      expect(mockOnChainChange).toHaveBeenCalledWith(137);
    });
  });

  test('shows loading state during chain switch', async () => {
    // Mock slow chain switch
    mockEthereum.request.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown and click on Polygon
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    const polygonOption = screen.getByText('Polygon');
    fireEvent.click(polygonOption);
    
    // Should show loading state
    expect(screen.getByText('Switching chain...')).toBeInTheDocument();
  });

  test('connects wallet when connect button is clicked', async () => {
    // Mock no accounts initially
    const mockProvider = {
      listAccounts: jest.fn()
        .mockResolvedValueOnce([]) // No accounts initially
        .mockResolvedValueOnce(['0x1234567890123456789012345678901234567890']), // Account after connection
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    };
    
    require('ethers').ethers.providers.Web3Provider.mockImplementation(() => mockProvider);
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);
    
    expect(mockEthereum.request).toHaveBeenCalledWith({
      method: 'eth_requestAccounts',
    });
  });

  test('displays correct chain icons and colors', async () => {
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    // Check chain icons in dropdown
    const chainIcons = screen.getAllByText('🟣'); // Polygon icon
    expect(chainIcons.length).toBeGreaterThan(0);
    
    const bscIcon = screen.getByText('🟡'); // BSC icon
    expect(bscIcon).toBeInTheDocument();
  });

  test('shows current chain status information', async () => {
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    expect(screen.getByText('Current Chain ID:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('handles chain switch errors gracefully', async () => {
    // Mock chain switch error
    mockEthereum.request.mockRejectedValue(new Error('Failed to switch chain'));
    
    // Mock alert
    const mockAlert = jest.spyOn(window, 'alert').mockImplementation();
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
    
    // Open dropdown and click on Polygon
    const switcherButton = screen.getByText('Ethereum').closest('button');
    fireEvent.click(switcherButton!);
    
    const polygonOption = screen.getByText('Polygon');
    fireEvent.click(polygonOption);
    
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Failed to switch chain. Please try again.');
    });
    
    mockAlert.mockRestore();
  });

  test('applies custom className', () => {
    const customClass = 'custom-chain-switcher';
    
    // Mock no accounts to show connect button
    const mockProvider = {
      listAccounts: jest.fn().mockResolvedValue([]),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    };
    
    require('ethers').ethers.providers.Web3Provider.mockImplementation(() => mockProvider);
    
    render(<ChainSwitcher onChainChange={mockOnChainChange} className={customClass} />);
    
    const container = screen.getByText('Connect Wallet').closest('div');
    expect(container).toHaveClass(customClass);
  });
});
