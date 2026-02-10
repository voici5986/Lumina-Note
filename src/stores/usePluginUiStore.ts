import { create } from "zustand";

export interface PluginPanelDefinition {
  pluginId: string;
  panelId: string;
  title: string;
  html: string;
}

interface PluginUiState {
  panels: PluginPanelDefinition[];
  registerPanel: (panel: PluginPanelDefinition) => void;
  unregisterPanel: (pluginId: string, panelId: string) => void;
  clearPluginPanels: (pluginId: string) => void;
}

export const usePluginUiStore = create<PluginUiState>((set) => ({
  panels: [],
  registerPanel: (panel) =>
    set((state) => {
      const next = state.panels.filter(
        (item) => !(item.pluginId === panel.pluginId && item.panelId === panel.panelId),
      );
      next.push(panel);
      return { panels: next };
    }),
  unregisterPanel: (pluginId, panelId) =>
    set((state) => ({
      panels: state.panels.filter(
        (item) => !(item.pluginId === pluginId && item.panelId === panelId),
      ),
    })),
  clearPluginPanels: (pluginId) =>
    set((state) => ({
      panels: state.panels.filter((item) => item.pluginId !== pluginId),
    })),
}));
