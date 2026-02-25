import React, { useRef, useState, useCallback, useEffect } from 'react';

interface DraggableWindowProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  maxHeight?: string;
  /** Дополнительные элементы в шапке (справа от заголовка) */
  headerExtra?: React.ReactNode;
}

const DEFAULT_POSITION = { x: 80, y: 60 };

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  onClose,
  children,
  width = 640,
  maxWidth = 960,
  maxHeight = '85vh',
  headerExtra,
}) => {
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: position.x,
      startTop: position.y,
    };
  }, [position.x, position.y]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({
        x: dragRef.current.startLeft + (e.clientX - dragRef.current.startX),
        y: Math.max(0, dragRef.current.startTop + (e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9998,
        width: typeof width === 'number' ? width : width,
        maxWidth: typeof maxWidth === 'number' ? maxWidth : maxWidth,
        maxHeight,
        background: '#fff',
        color: '#333',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: '#f8f9fa',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, pointerEvents: 'none' }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6c757d', color: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            Закрыть
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
};
