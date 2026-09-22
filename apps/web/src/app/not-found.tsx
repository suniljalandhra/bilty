import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="center-state">
      <h1>Page not found</h1>
      <p>This page may have moved or is no longer available.</p>
      <Link href="/biltys" className="button primary">
        Back to bilty book
      </Link>
    </div>
  );
}
