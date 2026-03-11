import React, { useState } from 'react';
import { DraggableWindow } from './DraggableWindow';
import { GENERATORS, type GeneratorId } from '../Generators';

type Screen = 'tools' | 'generators' | GeneratorId;

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 14px',
  marginBottom: 8,
  borderRadius: 8,
  border: '1px solid #dee2e6',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  textAlign: 'left',
};

export interface MasterToolsModalProps {
  onClose: () => void;
}

export const MasterToolsModal: React.FC<MasterToolsModalProps> = ({ onClose }) => {
  const [screen, setScreen] = useState<Screen>('tools');

  const title =
    screen === 'tools'
      ? 'Инструменты'
      : screen === 'generators'
        ? 'Генераторы'
        : GENERATORS.find((g) => g.id === screen)?.title ?? 'Генератор';

  const backButton = (to: Screen) => (
    <button
      type="button"
      onClick={() => setScreen(to)}
      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #6c757d', background: '#fff', color: '#333', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}
    >
      ← Назад
    </button>
  );

  let content: React.ReactNode;
  if (screen === 'tools') {
    content = (
      <div style={{ padding: 12 }}>
        <button type="button" style={btnStyle} onClick={() => setScreen('generators')}>
          Генераторы
        </button>
      </div>
    );
  } else if (screen === 'generators') {
    content = (
      <div style={{ padding: 12, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {backButton('tools')}
        {GENERATORS.map((g) => (
          <button
            key={g.id}
            type="button"
            style={btnStyle}
            onClick={() => setScreen(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>
    );
  } else {
    const gen = GENERATORS.find((g) => g.id === screen);
    const GenComponent = gen?.component;
    content = (
      <div style={{ padding: 12, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {backButton('generators')}
        {GenComponent && <GenComponent />}
      </div>
    );
  }

  return (
    <DraggableWindow title={title} onClose={onClose} width={420} maxHeight="80vh">
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {content}
      </div>
    </DraggableWindow>
  );
};
