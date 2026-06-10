import React from 'react';

interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
}

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <>{children}</>;
};

export const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <div className="relative inline-block group">{children}</div>;
};

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ children }) => {
  return <span className="cursor-help">{children}</span>;
};

const sideStyles: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
};

export const TooltipContent: React.FC<TooltipContentProps> = ({
  children,
  className = '',
  side = 'top',
}) => {
  return (
    <div
      className={`absolute z-50 hidden group-hover:block rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-md ${sideStyles[side]} ${className}`}
      role="tooltip"
    >
      {children}
    </div>
  );
};
