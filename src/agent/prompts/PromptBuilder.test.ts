/**
 * PromptBuilder 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/stores/useLocaleStore', () => ({
  getCurrentTranslations: vi.fn(() => ({
    prompts: {
      agent: {
        role: 'You are an AI assistant',
        expertise: 'Expert in notes',
        toolUseIntro: 'Tool intro',
        toolUsePrinciples: 'Principles',
        toolFormat: 'Format',
        toolRules: 'Rules',
        toolWarning: 'Warning',
        protocolActions: 'Protocol',
        toolPriority: 'Priority',
        searchGuide: 'Search guide',
        capabilities: 'Capabilities list',
        baseRules: 'Base rules',
        editVsCreate: 'Edit vs create',
        flashcardRules: 'Flashcard rules',
        writerRules: 'Writer specific rules',
        organizerRules: 'Organizer specific rules',
        context: {
          workspacePath: 'Workspace',
          activeNote: 'Active Note',
          none: 'None',
          fileTree: 'File Tree',
          recentNotes: 'Recent Notes',
          ragResults: 'Related Notes',
        },
        objective: {
          identity: 'Identity',
          coreRole: 'Core Role',
          keyRule: 'Key Rule',
          toolTask: 'Tool Task',
          toolTaskDesc: 'Tool desc',
          qaTask: 'QA Task',
          qaTaskDesc: 'QA desc',
          waitForTask: 'Wait for task',
        },
        modes: {
          editor: { name: 'Editor', roleDefinition: 'Edit notes' },
          organizer: { name: 'Organizer', roleDefinition: 'Organize notes' },
          researcher: { name: 'Researcher', roleDefinition: 'Research topics' },
          writer: { name: 'Writer', roleDefinition: 'Write content' },
        },
      },
    },
  })),
}));

vi.mock('../tools/definitions', () => ({
  getAllToolDefinitions: vi.fn(() => [
    { name: 'read_note', definition: '## read_note\nRead a note' },
    { name: 'edit_note', definition: '## edit_note\nEdit a note' },
    { name: 'list_notes', definition: '## list_notes\nList notes' },
    { name: 'create_note', definition: '## create_note\nCreate a note' },
  ]),
  attemptCompletionDefinition: {
    name: 'attempt_completion',
    definition: '## attempt_completion\nComplete task',
  },
}));

vi.mock('../modes', () => ({
  MODES: {
    editor: {
      slug: 'editor',
      name: 'Editor',
      icon: 'pencil',
      roleDefinition: 'Edit notes',
      tools: ['read_note', 'edit_note', 'list_notes'],
    },
    writer: {
      slug: 'writer',
      name: 'Writer',
      icon: 'pen-tool',
      roleDefinition: 'Write content',
      tools: ['read_note', 'create_note', 'list_notes'],
    },
    organizer: {
      slug: 'organizer',
      name: 'Organizer',
      icon: 'folder',
      roleDefinition: 'Organize notes',
      tools: ['read_note', 'list_notes'],
    },
  },
}));

import { PromptBuilder } from './PromptBuilder';
import { MODES } from '../modes';

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  describe('constructor', () => {
    it('should use editor mode by default', () => {
      const prompt = builder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('Edit notes');
    });

    it('should accept custom mode', () => {
      const writerBuilder = new PromptBuilder(MODES.writer);
      const prompt = writerBuilder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('Write content');
    });
  });

  describe('build', () => {
    it('should include workspace path', () => {
      const prompt = builder.build({ workspacePath: '/my/vault' });
      expect(prompt).toContain('/my/vault');
    });

    it('should include active note when provided', () => {
      const prompt = builder.build({
        workspacePath: '/vault',
        activeNote: 'notes/test.md',
      });
      expect(prompt).toContain('notes/test.md');
    });

    it('should include file tree when provided', () => {
      const prompt = builder.build({
        workspacePath: '/vault',
        fileTree: '├── notes\n├── docs',
      });
      expect(prompt).toContain('├── notes');
    });

    it('should include recent notes when provided', () => {
      const prompt = builder.build({
        workspacePath: '/vault',
        recentNotes: ['note1.md', 'note2.md'],
      });
      expect(prompt).toContain('- note1.md');
      expect(prompt).toContain('- note2.md');
    });

    it('should include RAG results when provided', () => {
      const prompt = builder.build({
        workspacePath: '/vault',
        ragResults: [
          { filePath: 'related.md', score: 0.85, heading: 'Section 1' },
        ] as any,
      });
      expect(prompt).toContain('related.md');
      expect(prompt).toContain('85%');
    });

    it('should include tools section', () => {
      const prompt = builder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('TOOLS');
      expect(prompt).toContain('read_note');
    });

    it('should include capabilities section', () => {
      const prompt = builder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('CAPABILITIES');
    });

    it('should include rules section', () => {
      const prompt = builder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('RULES');
    });

    it('should include objective section', () => {
      const prompt = builder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('OBJECTIVE');
    });

    it('should add writer rules for writer mode', () => {
      const prompt = builder.build({
        workspacePath: '/vault',
        mode: MODES.writer,
      });
      expect(prompt).toContain('Writer specific rules');
    });

    it('should add organizer rules for organizer mode', () => {
      const prompt = builder.build({
        workspacePath: '/vault',
        mode: MODES.organizer,
      });
      expect(prompt).toContain('Organizer specific rules');
    });
  });

  describe('setMode', () => {
    it('should change the mode', () => {
      builder.setMode(MODES.writer);
      const prompt = builder.build({ workspacePath: '/vault' });
      expect(prompt).toContain('Write content');
    });
  });
});
