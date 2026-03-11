import { useState } from 'react';
import { GENERATORS, type GeneratorId } from '../components/Generators';

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: 16,
  background: '#f8f9fa',
  borderRadius: 12,
  border: '1px solid #dee2e6',
};

export default function GeneratorsPage() {
  const [expanded, setExpanded] = useState<GeneratorId | null>(null);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Генераторы</h1>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        Случайные списки товаров, NPC и сокровища для подготовки к игре. В комнате мастер может открыть их через Инструменты.
      </p>
      {GENERATORS.map((g) => (
        <section key={g.id} style={sectionStyle}>
          <button
            type="button"
            onClick={() => setExpanded(expanded === g.id ? null : g.id)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {g.title}
            <span style={{ fontSize: 14, color: '#666' }}>{expanded === g.id ? '▼' : '▶'}</span>
          </button>
          {expanded === g.id && (
            <div style={{ paddingTop: 12, borderTop: '1px solid #dee2e6' }}>
              <g.component />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
