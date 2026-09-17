export function tabElementId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-tab-${tabId}`;
}

export function tabPanelElementId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-panel-${tabId}`;
}
