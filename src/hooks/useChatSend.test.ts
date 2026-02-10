/**
 * useChatSend 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri readFile
vi.mock('@/lib/tauri', () => ({
  readFile: vi.fn(),
}));

import { processMessageWithFiles, type ReferencedFile } from './useChatSend';
import { readFile } from '@/lib/tauri';

describe('processMessageWithFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return simple message when no files', async () => {
    const result = await processMessageWithFiles('Hello AI', []);
    
    expect(result.displayMessage).toBe('Hello AI');
    expect(result.fullMessage).toBe('Hello AI');
    expect(result.fileContext).toBe('');
    expect(result.attachments).toEqual([]);
  });

  it('should expose file attachments for UI rendering', async () => {
    vi.mocked(readFile).mockResolvedValue('File content');
    
    const files: ReferencedFile[] = [
      { path: '/path/to/note.md', name: 'note.md', isFolder: false },
    ];
    
    const result = await processMessageWithFiles('Check this', files);
    
    expect(result.displayMessage).toBe('Check this');
    expect(result.attachments).toEqual([
      { type: 'file', name: 'note.md', path: '/path/to/note.md' },
    ]);
  });

  it('should keep multiple attachments in order', async () => {
    vi.mocked(readFile).mockResolvedValue('Content');
    
    const files: ReferencedFile[] = [
      { path: '/file1.md', name: 'file1.md', isFolder: false },
      { path: '/file2.md', name: 'file2.md', isFolder: false },
    ];
    
    const result = await processMessageWithFiles('Test', files);
    
    expect(result.displayMessage).toBe('Test');
    expect(result.attachments).toEqual([
      { type: 'file', name: 'file1.md', path: '/file1.md' },
      { type: 'file', name: 'file2.md', path: '/file2.md' },
    ]);
  });

  it('should skip folders when building attachments', async () => {
    const files: ReferencedFile[] = [
      { path: '/folder', name: 'folder', isFolder: true },
      { path: '/file.md', name: 'file.md', isFolder: false },
    ];
    
    vi.mocked(readFile).mockResolvedValue('Content');
    
    const result = await processMessageWithFiles('Message', files);
    
    expect(result.displayMessage).toBe('Message');
    expect(result.attachments).toEqual([
      { type: 'file', name: 'file.md', path: '/file.md' },
    ]);
  });

  it('should include file content in fullMessage', async () => {
    vi.mocked(readFile).mockResolvedValue('# Note Content\n\nSome text');
    
    const files: ReferencedFile[] = [
      { path: '/note.md', name: 'note.md', isFolder: false },
    ];
    
    const result = await processMessageWithFiles('Explain this', files);
    
    expect(result.fullMessage).toContain('Explain this');
    expect(result.fullMessage).toContain('[用户引用的文件内容]');
    expect(result.fullMessage).toContain('# Note Content');
  });

  it('should handle file read errors gracefully', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('File not found'));
    
    const files: ReferencedFile[] = [
      { path: '/invalid.md', name: 'invalid.md', isFolder: false },
    ];
    
    const result = await processMessageWithFiles('Test', files);
    
    // Should still work, just without file content
    expect(result.displayMessage).toBe('Test');
    expect(result.fileContext).toBe('');
    expect(result.attachments).toEqual([
      { type: 'file', name: 'invalid.md', path: '/invalid.md' },
    ]);
  });

  it('should handle empty message with files', async () => {
    vi.mocked(readFile).mockResolvedValue('Content');
    
    const files: ReferencedFile[] = [
      { path: '/file.md', name: 'file.md', isFolder: false },
    ];
    
    const result = await processMessageWithFiles('', files);
    
    expect(result.displayMessage).toBe('');
    expect(result.attachments).toEqual([
      { type: 'file', name: 'file.md', path: '/file.md' },
    ]);
  });

  it('should set fileContext correctly', async () => {
    vi.mocked(readFile).mockResolvedValue('File content here');
    
    const files: ReferencedFile[] = [
      { path: '/note.md', name: 'note.md', isFolder: false },
    ];
    
    const result = await processMessageWithFiles('Question', files);
    
    expect(result.fileContext).toContain('引用文件: note.md');
    expect(result.fileContext).toContain('File content here');
  });
});
