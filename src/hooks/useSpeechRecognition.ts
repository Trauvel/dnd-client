import { useCallback, useRef, useState, useEffect } from 'react';
import { API_CONFIG } from '../config';

const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
const SpeechRecognitionPhrase =
  typeof window !== 'undefined' ? (window as any).SpeechRecognitionPhrase : null;
const HAS_PHRASES = !!(SR && SpeechRecognitionPhrase);

export interface SpeechRecognitionMessage {
  v: number;
  roomId: string;
  playerId: string;
  type: 'partial' | 'final';
  seq: number;
  tsClient: number;
  text: string;
}

/**
 * Подсказки фраз улучшают распознавание имён и терминов (Chrome: только при локальной обработке).
 * Передай имена персонажей, никнеймы, названия локаций и т.п.
 */
export function useSpeechRecognition(roomId: string, playerId: string, phraseHints?: string[]) {
  const wsUrl = API_CONFIG.SPEECH_WS;
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef('');

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SR>> | null>(null);
  const runningRef = useRef(false);
  const seqRef = useRef(0);

  const connectWs = useCallback(() => {
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const url = wsUrl.startsWith('ws') ? wsUrl : `ws://${wsUrl.replace(/^https?:\/\//, '')}`;
      const ws = new WebSocket(url);
      ws.onopen = () => setError(null);
      ws.onclose = () => {};
      ws.onerror = () => setError('Ошибка соединения с сервером речи');
      wsRef.current = ws;
    } catch {
      setError('Неверный адрес сервера речи');
    }
  }, [wsUrl]);

  const send = useCallback(
    (type: 'partial' | 'final', text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;
      const msg: SpeechRecognitionMessage = {
        v: 1,
        roomId,
        playerId,
        type,
        seq: ++seqRef.current,
        tsClient: Date.now(),
        text: text.trim(),
      };
      ws.send(JSON.stringify(msg));
    },
    [roomId, playerId]
  );

  const startRecognition = useCallback(() => {
    if (!SR) {
      setError('Распознавание речи недоступно в этом браузере (Chrome/Edge)');
      return;
    }
    setError(null);
    connectWs();

    const recognition = new SR() as InstanceType<NonNullable<typeof SR>>;
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Подсказки и processLocally только для en-US: локальная модель Chrome не поддерживает ru-RU (language-not-supported)
    const lang = recognition.lang || 'ru-RU';
    const usePhrases = lang.startsWith('en') && HAS_PHRASES;
    const hints = usePhrases ? (phraseHints?.filter((s) => typeof s === 'string' && s.trim().length > 0) ?? []) : [];
    if (usePhrases && hints.length > 0) {
      try {
        (recognition as any).processLocally = true;
        const boost = 3;
        (recognition as any).phrases = hints.map((phrase) => new (SpeechRecognitionPhrase as any)(phrase.trim(), boost));
      } catch (_) {}
    }

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; length: number; [j: number]: { transcript?: string } } } }) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = (res[0]?.transcript || '').trim();
        if (!txt) continue;

        if (res.isFinal) finalText += (finalText ? ' ' : '') + txt;
        else interim += (interim ? ' ' : '') + txt;
      }

      if (finalText) committedRef.current = (committedRef.current ? committedRef.current + ' ' : '') + finalText;
      const display = (committedRef.current + (interim ? ' ' + interim : '')).trim();
      setLiveText(display);
      if (interim) send('partial', interim);
      if (finalText) send('final', finalText);
    };

    recognition.onerror = (e: { error: string }) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error', e.error);
    };

    recognition.onend = () => {
      if (runningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    runningRef.current = true;
    try {
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      setError('Не удалось запустить микрофон');
      runningRef.current = false;
    }
  }, [connectWs, send, phraseHints]);

  const stopRecognition = useCallback(() => {
    runningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    committedRef.current = '';
    setIsRecording(false);
    setLiveText('');
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) stopRecognition();
    else startRecognition();
  }, [isRecording, startRecognition, stopRecognition]);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [stopRecognition]);

  return { isRecording, toggle, liveText, error, isAvailable: !!SR && !!wsUrl };
}
