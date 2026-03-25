import React, { Suspense, LazyExoticComponent, ComponentType } from 'react';

interface CodeSplitterProps {
  component: LazyExoticComponent<ComponentType<any>>;
  fallback?: React.ReactNode;
  [key: string]: any;
}

/**
 * Higher-order component for automatic code splitting and lazy loading with a default fallback
 */
const CodeSplitter: React.FC<CodeSplitterProps> = ({ 
  component: Component, 
  fallback = (
    <div className="flex items-center justify-center p-8 bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-700/50 animate-pulse">
      <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
    </div>
  ), 
  ...props 
}) => {
  return (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  );
};

export default CodeSplitter;
