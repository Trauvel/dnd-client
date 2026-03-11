import { useState } from 'react';
import { generateNpc, type GeneratedNpc } from './npcData';

const style = { padding: 10, borderRadius: 6, border: '1px solid #dee2e6', background: '#f8f9fa', fontSize: 13 };

export function NpcGenerator() {
  const [npc, setNpc] = useState<GeneratedNpc | null>(null);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setNpc(generateNpc())}
          style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          Сгенерировать NPC
        </button>
      </div>
      {npc && (
        <div style={style}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{npc.name}</div>
          <div><strong>Роль:</strong> {npc.role}</div>
          <div><strong>Характер:</strong> {npc.trait}</div>
          <div><strong>Секрет:</strong> {npc.secret}</div>
          <div><strong>Крючок:</strong> {npc.hook}</div>
        </div>
      )}
    </div>
  );
}
