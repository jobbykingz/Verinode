import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Mock component that throws an error
const ThrowErrorComponent: React.FC = () => {
  throw new Error('Test error');
};

// Mock component that throws a string
const ThrowStringComponent: React.FC = () => {
  throw 'String error';
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch and render error fallback when component throws error', () => {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        errorInfo: expect.any(Object)
      })
    );
  });

  it('should catch and render error fallback when component throws string', () => {
    render(
      <ErrorBoundary fallback={<div>String error caught</div>}>
        <ThrowStringComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('String error caught')).toBeInTheDocument();
  });

  it('should render custom error message when provided', () => {
    const errorMessage = 'Custom error message';
    
    render(
      <ErrorBoundary fallback={<div>{errorMessage}</div>}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should call onError callback when provided', () => {
    const onError = jest.fn();
    
    render(
      <ErrorBoundary onError={onError} fallback={<div>Error handled</div>}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        errorInfo: expect.any(Object)
      })
    );
    expect(screen.getByText('Error handled')).toBeInTheDocument();
  });

  it('should render default fallback when no custom fallback provided', () => {
    render(
      <ErrorBoundary>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should handle async errors', async () => {
    const AsyncErrorComponent: React.FC = () => {
      React.useEffect(() => {
        throw new Error('Async error');
      }, []);
      return <div>Async component</div>;
    };

    render(
      <ErrorBoundary fallback={<div>Async error handled</div>}>
        <AsyncErrorComponent />
      </ErrorBoundary>
    );

    // Wait for useEffect to run
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Async error handled')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });

  it('should reset error state when children change', () => {
    const { rerender } = render(
      <ErrorBoundary fallback={<div>Initial error</div>}>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();

    // Rerender with error
    rerender(
      <ErrorBoundary fallback={<div>Updated error</div>}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Updated error')).toBeInTheDocument();

    // Rerender back to normal content
    rerender(
      <ErrorBoundary fallback={<div>Updated error</div>}>
        <div>Normal content again</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content again')).toBeInTheDocument();
  });

  it('should handle error boundary nesting', () => {
    const InnerErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ErrorBoundary fallback={<div>Inner error</div>}>
        {children}
      </ErrorBoundary>
    );

    render(
      <ErrorBoundary fallback={<div>Outer error</div>}>
        <InnerErrorBoundary>
          <ThrowErrorComponent />
        </InnerErrorBoundary>
      </ErrorBoundary>
    );

    expect(screen.getByText('Inner error')).toBeInTheDocument();
    expect(screen.queryByText('Outer error')).not.toBeInTheDocument();
  });

  it('should log error details', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new Error('Test error with details');
    error.stack = 'Error stack trace';

    render(
      <ErrorBoundary fallback={<div>Error logged</div>}>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: error,
        errorInfo: expect.objectContaining({
          componentStack: expect.any(String)
        })
      })
    );
  });
});
