module.exports = function setup(api, plugin) {
  const unregister = api.commands.registerSlashCommand({
    key: "hello-lumina",
    description: "Insert a plugin-generated hello message",
    prompt: "请用简短友好的语气问候我，并说明这是由 Lumina 插件生成的。"
  });
  const unregisterCommand = api.commands.registerCommand({
    id: "open-hello-view",
    title: "Open Hello Lumina view",
    description: "Open a plugin-defined custom tab view",
    hotkey: "Mod+Shift+H",
    run: () => {
      api.workspace.openRegisteredTab("hello-view", { now: new Date().toISOString() });
    }
  });

  const restoreTheme = api.ui.setThemeVariables({
    "--lumina-plugin-accent": "#0ea5e9"
  });
  const removeStyle = api.ui.injectStyle(`
    :root {
      --plugin-hello-ring: color-mix(in srgb, var(--lumina-plugin-accent) 40%, transparent);
    }
    .plugin-hello-highlight {
      outline: 1px solid var(--plugin-hello-ring);
      border-radius: 8px;
    }
  `, "hello-lumina");

  const timer = api.runtime.setInterval(() => {
    api.logger.info(`[${plugin.id}] heartbeat`);
  }, 60_000);

  api.logger.info(`[${plugin.id}] loaded from ${plugin.source}`);
  api.ui.notify("Hello Lumina plugin loaded");
  const removePanel = api.workspace.registerPanel({
    id: "hello-panel",
    title: "Hello Panel",
    html: "<p>This panel is registered by hello-lumina.</p>"
  });
  const unregisterView = api.workspace.registerTabType({
    type: "hello-view",
    title: "Hello View",
    render: (payload) =>
      `<h3>Hello from ${plugin.id}</h3><p>Opened at: ${payload.now || "unknown"}</p>`
  });

  return () => {
    unregister();
    unregisterCommand();
    unregisterView();
    removePanel();
    api.runtime.clearInterval(timer);
    removeStyle();
    restoreTheme();
    api.logger.info(`[${plugin.id}] unloaded`);
  };
};
