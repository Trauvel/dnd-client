import React from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface VoiceInputPanelProps {
  roomId: string;
  playerId: string;
  /** Подсказки для распознавания: имена персонажей, никнеймы, названия — улучшают точность в Chrome */
  phraseHints?: string[];
}

export const VoiceInputPanel: React.FC<VoiceInputPanelProps> = ({ roomId, playerId, phraseHints }) => {
  const { isRecording, toggle, liveText, error, isAvailable } = useSpeechRecognition(roomId, playerId, phraseHints);

  if (!isAvailable) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={toggle}
        title={isRecording ? 'Выключить запись' : 'Включить запись речи'}
        style={{
          padding: '8px 14px',
          background: isRecording ? '#dc3545' : '#0d6efd',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRecording ? '#fff' : 'rgba(255,255,255,0.5)' }} />
        {isRecording ? 'Выкл запись' : 'Вкл запись'}
      </button>
      {error && <span style={{ color: '#dc3545', fontSize: '13px' }}>{error}</span>}
      {liveText && (
        <span style={{ color: '#555', fontSize: '13px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={liveText}>
          {liveText}
        </span>
      )}
    </div>
  );
};
