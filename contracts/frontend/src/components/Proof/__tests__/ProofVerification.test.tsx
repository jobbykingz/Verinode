import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProofVerification from '../ProofVerification';

// Mock the proof verification service
const mockVerifyProof = jest.fn();
jest.mock('../../services/proofService', () => ({
  verifyProof: mockVerifyProof,
}));

describe('ProofVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the verification form', () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    expect(screen.getByText('Verify Proof')).toBeInTheDocument();
    expect(screen.getByLabelText('Proof Data')).toBeInTheDocument();
    expect(screen.getByLabelText('Verification Method')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify Proof' })).toBeInTheDocument();
  });

  it('should handle input changes correctly', async () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const methodSelect = screen.getByLabelText('Verification Method');
    
    await userEvent.type(proofDataInput, 'test proof data');
    await userEvent.selectOptions(methodSelect, 'zk-proof');
    
    expect(proofDataInput).toHaveValue('test proof data');
    expect(methodSelect).toHaveValue('zk-proof');
  });

  it('should call verification service on form submission', async () => {
    mockVerifyProof.mockResolvedValue({ success: true, verified: true });
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(mockVerifyProof).toHaveBeenCalledWith({
        proofId: 'test-proof-123',
        proofData: 'test data',
        method: 'standard'
      });
    });
  });

  it('should show loading state during verification', async () => {
    mockVerifyProof.mockImplementation(() => {
      return new Promise(() => {}); // Never resolves
    });
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    const proofDataInput = screen.getByLabelText('Proof Data');
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(verifyButton);
    
    // Check loading state
    expect(verifyButton).toBeDisabled();
    expect(verifyButton).toHaveTextContent('Verifying...');
    expect(proofDataInput).toBeDisabled();
  });

  it('should display success message on successful verification', async () => {
    mockVerifyProof.mockResolvedValue({ success: true, verified: true });
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(screen.getByText(/verification successful/i)).toBeInTheDocument();
      expect(screen.getByText(/proof verified successfully/i)).toBeInTheDocument();
    });
  });

  it('should display error message on failed verification', async () => {
    mockVerifyProof.mockResolvedValue({ success: false, error: 'Invalid proof format' });
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    await userEvent.type(proofDataInput, 'invalid data');
    await userEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid proof format/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors gracefully', async () => {
    mockVerifyProof.mockRejectedValue(new Error('Network error'));
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Verify Proof' })).not.toBeDisabled();
    });
  });

  it('should validate required fields', async () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    // Button should be disabled initially
    expect(verifyButton).toBeDisabled();
    
    // Try to submit without entering data
    await userEvent.click(verifyButton);
    
    // Should show validation error
    expect(screen.getByText(/proof data is required/i)).toBeInTheDocument();
  });

  it('should support different verification methods', () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    const methodSelect = screen.getByLabelText('Verification Method');
    
    // Check if all expected methods are available
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('ZK-Proof')).toBeInTheDocument();
    expect(screen.getByText('Multi-Signature')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('should clear form after successful verification', async () => {
    mockVerifyProof.mockResolvedValue({ success: true, verified: true });
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(screen.getByText(/verification successful/i)).toBeInTheDocument();
      expect(proofDataInput).toHaveValue('');
    });
  });

  it('should handle file upload for document-based verification', async () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    const methodSelect = screen.getByLabelText('Verification Method');
    const fileInput = screen.getByLabelText('Upload Documents');
    
    await userEvent.selectOptions(methodSelect, 'document');
    expect(fileInput).toBeInTheDocument();
    
    const file = new File(['test.pdf'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('should be accessible', () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    // Check for proper ARIA labels
    expect(screen.getByLabelText('Proof Data')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('button', { name: 'Verify Proof' })).toHaveAttribute('aria-describedby');
    
    // Check for keyboard navigation
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    verifyButton.focus();
    expect(verifyButton).toHaveFocus();
  });

  it('should handle proof ID not found', () => {
    render(<ProofVerification proofId="non-existent-proof" />);
    
    await waitFor(() => {
      expect(screen.getByText(/proof not found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Verify Proof' })).not.toBeInTheDocument();
    });
  });

  it('should display verification progress', async () => {
    let resolveVerification: (value: any) => void;
    mockVerifyProof.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolveVerification({ progress: 25 });
        }, 100);
        setTimeout(() => {
          resolveVerification({ progress: 50 });
        }, 200);
        setTimeout(() => {
          resolveVerification({ progress: 75 });
        }, 300);
        setTimeout(() => {
          resolveVerification({ success: true, verified: true });
        }, 400);
      });
    });
    
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    }, { timeout: 200 });
    
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    }, { timeout: 300 });
    
    await waitFor(() => {
      expect(screen.getByText(/verification successful/i)).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('should handle cancellation of verification', async () => {
    render(<ProofVerification proofId="test-proof-123" />);
    
    const proofDataInput = screen.getByLabelText('Proof Data');
    const verifyButton = screen.getByRole('button', { name: 'Verify Proof' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    
    await userEvent.type(proofDataInput, 'test data');
    await userEvent.click(cancelButton);
    
    expect(screen.getByText(/verification cancelled/i)).toBeInTheDocument();
    expect(proofDataInput).toHaveValue('');
  });
});
