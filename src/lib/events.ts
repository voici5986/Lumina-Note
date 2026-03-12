export function openFilteredView(scopeLabel: string, pathPrefixes: string[]): void {
  window.dispatchEvent(
    new CustomEvent("open-global-search", {
      detail: { scopeLabel, pathPrefixes },
    }),
  );
}
