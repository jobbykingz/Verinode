import React from 'react';

interface HamburgerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onToggle, className = '' }) => {
  return (
    <button
      onClick={onToggle}
      className={`relative w-8 h-8 flex flex-col justify-center items-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      aria-label="Toggle navigation menu"
      aria-expanded={isOpen}
    >
      <span
        className={`block w-6 h-0.5 bg-current transition-all duration-300 ease-in-out ${
          isOpen ? 'rotate-45 translate-y-1.5' : 'rotate-0 translate-y-0.5'
        }`}
      />
      <span
        className={`block w-6 h-0.5 bg-current transition-all duration-300 ease-in-out my-1 ${
          isOpen ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <span
        className={`block w-6 h-0.5 bg-current transition-all duration-300 ease-in-out ${
          isOpen ? '-rotate-45 -translate-y-1.5' : 'rotate-0 translate-y-1'
        }`}
      />
    </button>
  );
};
