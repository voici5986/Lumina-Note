interface PluginViewPaneProps {
  title: string;
  html: string;
}

export function PluginViewPane({ title, html }: PluginViewPaneProps) {
  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      <div className="p-4">
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
