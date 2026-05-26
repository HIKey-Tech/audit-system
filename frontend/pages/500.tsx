// Pages Router override for the global 500.
// Exists to stop Next.js 14 from prerendering its internal _error page,
// which crashes with "<Html> should not be imported outside of pages/_document".
// Keep this dependency-free so the prerender stays safe.
export default function Custom500(): JSX.Element {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: 'system-ui, sans-serif',
        color: '#1f2937',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 48, margin: 0 }}>500</h1>
      <p style={{ fontSize: 18, margin: 0 }}>Something went wrong on our end.</p>
      <a href="/dashboard" style={{ color: '#2563eb', textDecoration: 'underline' }}>
        Return to dashboard
      </a>
    </main>
  );
}
