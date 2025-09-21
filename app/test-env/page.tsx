export default function TestEnv() {
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Environment Variables Test</h1>
      <div style={{ lineHeight: '1.6' }}>
        <p><strong>DATABASE_URL:</strong> {process.env.DATABASE_URL || 'NOT FOUND'}</p>
        <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV || 'NOT FOUND'}</p>
        <p><strong>CARDCOM_TERMINAL_NUMBER:</strong> {process.env.CARDCOM_TERMINAL_NUMBER || 'NOT FOUND'}</p>
        <p><strong>Current time:</strong> {new Date().toISOString()}</p>
      </div>
    </div>
  );
}
