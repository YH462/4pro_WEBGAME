"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-page"><span className="eyebrow">CONNECTION CHECK</span><h1>接続を確認しています。</h1><p>サーバーに接続できません。少し待って、もう一度お試しください。</p><button className="button primary" onClick={reset}>もう一度試す</button></main>; }
