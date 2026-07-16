import { join } from 'node:path';
import { UiStateSchema, type UiState } from '@pnode/core';
import { JsonStore } from './json-store.js';

const defaultUiState = UiStateSchema.parse({});

export class WorkspaceStore {
  private readonly uiState: JsonStore<UiState>;

  constructor(readonly root: string) {
    this.uiState = new JsonStore(
      join(root, '.pnode', 'state', 'ui.json'),
      UiStateSchema,
      defaultUiState
    );
  }

  readUiState(): Promise<UiState> {
    return this.uiState.read();
  }

  writeUiState(value: UiState): Promise<void> {
    return this.uiState.write(value);
  }
}
