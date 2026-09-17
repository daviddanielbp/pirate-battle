import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/ui/atoms/Button';
import { tabElementId, tabPanelElementId } from '@/ui/shared/tabIds';
import './Tabs.css';

export interface TabItem {
  id: string;
  label: string;
  testId?: string | undefined;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  idPrefix: string;
  className?: string | undefined;
  testId?: string | undefined;
}

export function Tabs({ tabs, activeId, onChange, ariaLabel, idPrefix, className, testId }: TabsProps) {
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());

  const focusTab = (index: number) => {
    const tab = tabs[index];
    if (!tab) {
      return;
    }
    onChange(tab.id);
    buttonsRef.current.get(tab.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeId);
    const lastIndex = tabs.length - 1;
    switch (event.key) {
      case 'ArrowRight':
        focusTab(currentIndex >= lastIndex ? 0 : currentIndex + 1);
        break;
      case 'ArrowLeft':
        focusTab(currentIndex <= 0 ? lastIndex : currentIndex - 1);
        break;
      case 'Home':
        focusTab(0);
        break;
      case 'End':
        focusTab(lastIndex);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={['pb-tabs', className ?? ''].filter(Boolean).join(' ')}
      data-testid={testId}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Button
            key={tab.id}
            ref={(element) => {
              if (element) {
                buttonsRef.current.set(tab.id, element);
              }
              return () => {
                buttonsRef.current.delete(tab.id);
              };
            }}
            id={tabElementId(idPrefix, tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-controls={tabPanelElementId(idPrefix, tab.id)}
            tabIndex={isActive ? 0 : -1}
            variant={isActive ? 'primary' : 'secondary'}
            size="small"
            className="pb-tabs__tab"
            testId={tab.testId}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  tabId: string;
  active: boolean;
  children?: ReactNode;
  className?: string | undefined;
  testId?: string | undefined;
}

export function TabPanel({ idPrefix, tabId, active, children, className, testId }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelElementId(idPrefix, tabId)}
      aria-labelledby={tabElementId(idPrefix, tabId)}
      hidden={!active}
      tabIndex={0}
      className={['pb-tab-panel', className ?? ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      {active ? children : null}
    </div>
  );
}
