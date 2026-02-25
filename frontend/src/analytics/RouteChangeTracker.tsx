import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './ga';

const RouteChangeTracker = () => {
  const location = useLocation();

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
};

export default RouteChangeTracker;
