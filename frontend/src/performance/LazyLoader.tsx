import React, { useRef, useState, useEffect, ReactNode } from 'react';

interface LazyLoaderProps {
  children: ReactNode;
  placeholder?: ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
}

const LazyLoader: React.FC<LazyLoaderProps> = ({ 
  children, 
  placeholder, 
  threshold = 0.1, 
  rootMargin = '50px',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [threshold, rootMargin]);

  return (
    <div ref={containerRef} className={`lazy-container ${className}`}>
      {isVisible ? children : (placeholder || <div className="min-h-[100px] w-full bg-slate-800/20 rounded-xl" />)}
    </div>
  );
};

export default LazyLoader;
