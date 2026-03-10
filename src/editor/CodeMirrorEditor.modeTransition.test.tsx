import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { CodeMirrorEditor } from './CodeMirrorEditor';

function setupEditor(content: string, viewMode: 'live' | 'reading' = 'live') {
  const onChange = vi.fn();
  const rendered = render(
    <CodeMirrorEditor content={content} onChange={onChange} viewMode={viewMode} />,
  );
  const editor = rendered.container.querySelector('.cm-editor');
  if (!editor) {
    throw new Error('CodeMirror editor root not found');
  }
  const view = EditorView.findFromDOM(editor as HTMLElement);
  if (!view) {
    throw new Error('EditorView instance not found');
  }
  return { ...rendered, view };
}

describe('CodeMirror editor mode transition selection sync', () => {
  afterEach(() => {
    cleanup();
  });

  it('reanchors a stale off-screen caret to the current viewport when returning from reading mode', () => {
    const content = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join('\n');
    const { view, rerender } = setupEditor(content, 'live');
    const staleCaret = content.indexOf('Line 2');
    const visibleLineStart = content.indexOf('Line 40');

    act(() => {
      view.dispatch({ selection: { anchor: staleCaret } });
    });

    Object.defineProperty(view.scrollDOM, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 1120,
    });
    const lineBlockSpy = vi.spyOn(view, 'lineBlockAtHeight').mockReturnValue({
      from: visibleLineStart,
      to: visibleLineStart + 'Line 40'.length,
      top: 0,
      bottom: 28,
      height: 28,
      type: 0,
      widget: null,
      length: 'Line 40'.length,
    } as any);

    act(() => {
      rerender(<CodeMirrorEditor content={content} onChange={vi.fn()} viewMode="reading" />);
    });

    act(() => {
      rerender(<CodeMirrorEditor content={content} onChange={vi.fn()} viewMode="live" />);
    });

    expect(view.state.selection.main.anchor).toBe(visibleLineStart);
    lineBlockSpy.mockRestore();
  });
});
