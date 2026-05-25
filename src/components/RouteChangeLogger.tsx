import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { queryClient } from '../queryClient/queryClient';
import { QUERY_KEYS } from '../queryClient/hooks';

const RouteChangeLogger = () => {
  const location = useLocation();
  const previousLocation = useRef(location.pathname);

  const PATH_QUERY_MAP: Record<string, string[]> = {
    '/parts': QUERY_KEYS.PARTS,
    '/rejections': QUERY_KEYS.REJECTIONS,
  };

  useEffect(() => {
    queryClient.invalidateQueries({queryKey: PATH_QUERY_MAP[previousLocation.current]});
  }, [location]);

  return null;
};

export default RouteChangeLogger;