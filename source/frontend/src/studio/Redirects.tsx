import { Navigate, useSearchParams } from 'react-router-dom';

export function RedirectToSummary({ sheet }: { sheet: string }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set('sheet', sheet);
  return <Navigate to={`/summary?${next.toString()}`} replace />;
}

export function RedirectTo({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}
