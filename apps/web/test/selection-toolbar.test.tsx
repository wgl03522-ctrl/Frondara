import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectionToolbar } from '../src/features/editor/SelectionToolbar.js';

const selection = {
  quote: '需要讨论的句子',
  prefix: '前文',
  suffix: '后文',
  headingPath: ['结论']
};

describe('selection toolbar', () => {
  it('keeps only three generic actions at the first level', () => {
    render(
      <SelectionToolbar
        selection={selection}
        onDiscuss={vi.fn()}
        onAnnotate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '与 AI 讨论' })).toBeVisible();
    expect(screen.getByRole('button', { name: '添加批注' })).toBeVisible();
    expect(screen.getByRole('button', { name: '更多' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '检查论证' })).not.toBeInTheDocument();
  });

  it('uses shortcuts to fill the question without sending', async () => {
    const user = userEvent.setup();
    const onDiscuss = vi.fn();
    render(
      <SelectionToolbar
        selection={selection}
        onDiscuss={onDiscuss}
        onAnnotate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: '与 AI 讨论' }));
    await user.click(screen.getByRole('button', { name: '检查论证' }));
    expect(screen.getByRole('textbox', { name: '讨论问题' })).toHaveValue('检查这段论证的前提、证据和结论强度');
    expect(onDiscuss).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '打开讨论' }));
    expect(onDiscuss).toHaveBeenCalledWith('检查这段论证的前提、证据和结论强度');
  });
});
