import { isRouteErrorResponse, useRouteError } from 'react-router';
import { NotFoundPage } from './NotFoundPage';

/** Shown when a page fails to load or render. */
export function ErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <title>Something went wrong</title>
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-red-800" role="alert">
        This page could not be loaded. Check your connection and try again.
      </p>
      <a href="/" className="mt-6 inline-block">
        Go to the homepage
      </a>
    </div>
  );
}
