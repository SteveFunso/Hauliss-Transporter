import { useState, useCallback } from 'react';

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeItem, setActiveItem] = useState('dashboard');

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setActive = useCallback((item: string) => {
    setActiveItem(item);
  }, []);

  return {
    isOpen,
    activeItem,
    toggle,
    open,
    close,
    setActive
  };
}
