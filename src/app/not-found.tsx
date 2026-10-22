import Link from "next/link";
export default function NotFound() { return <main className="error-page"><span className="eyebrow">404 / NOT FOUND</span><h1>このページは見つかりませんでした。</h1><Link className="button primary" href="/">ホームへ</Link></main>; }
