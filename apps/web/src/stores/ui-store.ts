import { UiStateSchema, type UiState } from '@pnode/core';
import { create } from 'zustand';

interface UiStore extends UiState {
  filePanelOpen: boolean;
  hydrated: boolean;
  setFilePanelOpen(open: boolean): void;
  setDiscussionOpen(open: boolean): void;
  setActiveDocument(path: string): void;
  setTheme(theme: UiState['theme']): void;
  setReadingFont(font: UiState['readingFont']): void;
  hydrate(state: UiState): void;
  durableState(): UiState;
}

const defaults = UiStateSchema.parse({});

export const useUiStore = create<UiStore>((set, get) => ({
  ...defaults,
  filePanelOpen: false,
  hydrated: false,
  setFilePanelOpen: (filePanelOpen) => set({ filePanelOpen }),
  setDiscussionOpen: (discussionOpen) => set({ discussionOpen }),
  setActiveDocument: (lastDocument) => set({ lastDocument }),
  setTheme: (theme) => set({ theme }),
  setReadingFont: (readingFont) => set({ readingFont }),
  hydrate: (state) => set({ ...state, hydrated: true }),
  durableState: () => {
    const state = get();
    return UiStateSchema.parse({
      filePanelWidth: state.filePanelWidth,
      filePanelPinned: state.filePanelPinned,
      discussionWidth: state.discussionWidth,
      discussionOpen: state.discussionOpen,
      theme: state.theme,
      readingFont: state.readingFont,
      ...(state.lastDocument ? { lastDocument: state.lastDocument } : {}),
      ...(state.cursor ? { cursor: state.cursor } : {}),
      ...(state.scrollOffset !== undefined ? { scrollOffset: state.scrollOffset } : {})
    });
  }
}));
