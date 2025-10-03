'use client';

import { useState, useEffect } from 'react';

export default function EmailPreviewPage() {
  const [emailHtml, setEmailHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/preview-email')
      .then(response => response.text())
      .then(html => {
        setEmailHtml(html);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading email preview...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Email Template Preview</h1>
      <div 
        dangerouslySetInnerHTML={{ __html: emailHtml }}
        style={{ 
          border: '1px solid #ccc', 
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: 'white'
        }}
      />
    </div>
  );
}
