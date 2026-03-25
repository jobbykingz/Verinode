import React, { useState, useEffect, useRef } from 'react';

interface MobileNavProps {
  items: NavItem[];
  onNavigate: (path: string) => void;
  currentPath: string;
}

interface NavItem {
  label: string;
  path: string;
  icon?: string;
  badge?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ items, onNavigate, currentPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleItemClick = (path: string) => {
    onNavigate(path);
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Toggle navigation menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7a2 2 0 002-2v-4a2 2 0 00-2-2H6a2 2 0 00-2 2v4a2 2 0 002 2h7a2 2 0 002-2v-4z" />
          )}
        </svg>
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" />
          
          <div
            ref={menuRef}
            className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2
                  id="mobile-menu-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Menu
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  aria-label="Close navigation menu"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation items */}
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleItemClick(item.path)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors duration-200 ${
                      currentPath === item.path
                        ? 'bg-blue-50 text-blue-700 border-2 border-blue-500'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-2 border-transparent'
                    }`}
                  >
                    {item.icon && (
                      <span className="mr-3 text-xl">{item.icon}</span>
                    )}
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-red-500 text-white rounded-full">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Verinode Mobile</span>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() => handleItemClick('/settings')}
                  >
                    Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
