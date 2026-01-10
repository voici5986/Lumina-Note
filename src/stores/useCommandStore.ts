import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getTranslations, detectSystemLocale, type Translations } from "@/i18n";

export interface SlashCommand {
    id: string;
    key: string;
    description: string;
    prompt: string;
}

interface CommandState {
    commands: SlashCommand[];
    registerCommand: (cmd: Omit<SlashCommand, "id">) => void;
    updateCommand: (id: string, cmd: Partial<SlashCommand>) => void;
    deleteCommand: (id: string) => void;
    unregisterCommand: (key: string) => void; // Keep for backward compatibility if needed, or remove
}

// 根据翻译对象获取默认命令（避免循环依赖）
export const getDefaultCommandsFromTranslations = (t: Translations): SlashCommand[] => {
    return [
        {
            id: "default-explain",
            key: "explain",
            description: t.ai.slashCommands.explain,
            prompt: t.ai.slashCommands.explainPrompt,
        },
        {
            id: "default-fix",
            key: "fix",
            description: t.ai.slashCommands.fix,
            prompt: t.ai.slashCommands.fixPrompt,
        },
        {
            id: "default-translate",
            key: "translate",
            description: t.ai.slashCommands.translate,
            prompt: t.ai.slashCommands.translatePrompt,
        },
    ];
};

// 兼容旧 API：延迟获取翻译
export const getDefaultCommands = (): SlashCommand[] => {
    // 延迟导入避免循环依赖
    const { useLocaleStore } = require("./useLocaleStore");
    const t = useLocaleStore.getState().t;
    return getDefaultCommandsFromTranslations(t);
};

// 获取初始语言的翻译（不依赖 useLocaleStore）
function getInitialTranslations(): Translations {
    try {
        const saved = localStorage.getItem('lumina-locale');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.state?.locale) {
                return getTranslations(parsed.state.locale);
            }
        }
    } catch {}
    return getTranslations(detectSystemLocale());
}

export const useCommandStore = create<CommandState>()(
    persist(
        (set) => ({
            commands: getDefaultCommandsFromTranslations(getInitialTranslations()),
            registerCommand: (cmd) =>
                set((state) => ({
                    commands: [
                        ...state.commands.filter((c) => c.key !== cmd.key),
                        { ...cmd, id: Date.now().toString() },
                    ],
                })),
            updateCommand: (id, newCmd) =>
                set((state) => ({
                    commands: state.commands.map((c) =>
                        c.id === id ? { ...c, ...newCmd } : c
                    ),
                })),
            deleteCommand: (id) =>
                set((state) => ({
                    commands: state.commands.filter((c) => c.id !== id),
                })),
            unregisterCommand: (key) =>
                set((state) => ({
                    commands: state.commands.filter((c) => c.key !== key),
                })),
        }),
        {
            name: "lumina-commands",
            version: 1,
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<CommandState> | undefined;
                if (!persisted?.commands) {
                    return currentState;
                }
                // 合并：保留持久化的自定义命令，更新默认命令的翻译
                const defaultCommands = getDefaultCommandsFromTranslations(getInitialTranslations());
                const defaultIds = new Set(defaultCommands.map(c => c.id));
                
                // 保留用户自定义命令（非默认命令）
                const customCommands = persisted.commands.filter(c => !defaultIds.has(c.id));
                
                return {
                    ...currentState,
                    commands: [...defaultCommands, ...customCommands],
                };
            },
        }
    )
);
