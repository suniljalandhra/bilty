'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="center-state">
      <h1>Unable to open this page</h1>
      <p>Please try again. Your saved records are still available.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
