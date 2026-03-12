import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, clampZoom, roundZoom } from "./typesettingUtils";

interface TypesettingToolbarProps {
  zoom: number;
  setZoom: (updater: (current: number) => number) => void;
  currentPage: number;
  setCurrentPage: (updater: (current: number) => number) => void;
  displayTotalPages: number;
  isDirty: boolean;
  onSave: () => void;
  // Export
  exporting: boolean;
  exportError: string | null;
  onExport: () => void;
  exportingDocx: boolean;
  exportDocxError: string | null;
  onExportDocx: () => void;
  printing: boolean;
  printError: string | null;
  onPrint: () => void;
  // OpenOffice
  openOfficePreview: boolean;
  openOfficeLoading: boolean;
  openOfficeError: string | null;
  openOfficeStale: boolean;
  openOfficeAutoRefresh: boolean;
  onToggleOpenOfficePreview: () => void;
  onRefreshOpenOfficePreview: () => void;
  onToggleAutoRefresh: () => void;
  docToolsInstalling: boolean;
  onInstallDocTools: () => void;
  tauriAvailable: boolean;
  // Formatting
  editableRef: React.RefObject<HTMLDivElement | null>;
  // Summary
  layoutSummary: string;
}

export function TypesettingToolbar({
  zoom,
  setZoom,
  currentPage,
  setCurrentPage,
  displayTotalPages,
  isDirty,
  onSave,
  exporting,
  exportError,
  onExport,
  exportingDocx,
  exportDocxError,
  onExportDocx,
  printing,
  printError,
  onPrint,
  openOfficePreview,
  openOfficeLoading,
  openOfficeError,
  openOfficeStale,
  openOfficeAutoRefresh,
  onToggleOpenOfficePreview,
  onRefreshOpenOfficePreview,
  onToggleAutoRefresh,
  docToolsInstalling,
  onInstallDocTools,
  tauriAvailable,
  editableRef,
  layoutSummary,
}: TypesettingToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-center bg-background/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {/* Zoom */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground shadow-sm">
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-sm disabled:opacity-50"
            aria-label="Zoom out"
            onClick={() =>
              setZoom((current) => clampZoom(roundZoom(current - ZOOM_STEP)))
            }
            disabled={zoom <= MIN_ZOOM}
          >
            -
          </button>
          <span className="min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-sm disabled:opacity-50"
            aria-label="Zoom in"
            onClick={() =>
              setZoom((current) => clampZoom(roundZoom(current + ZOOM_STEP)))
            }
            disabled={zoom >= MAX_ZOOM}
          >
            +
          </button>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground shadow-sm">
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="min-w-[5rem] text-center">
            Page {currentPage} / {displayTotalPages}
          </span>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
            onClick={() =>
              setCurrentPage((prev) => Math.min(displayTotalPages, prev + 1))
            }
            disabled={currentPage >= displayTotalPages}
            aria-label="Next page"
          >
            Next
          </button>
        </div>

        {/* Save */}
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
          onClick={onSave}
          disabled={!isDirty}
        >
          Save
        </button>

        {/* OpenOffice toggle */}
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
          onClick={onToggleOpenOfficePreview}
          disabled={openOfficeLoading || !tauriAvailable}
        >
          {openOfficePreview ? "Close OpenOffice" : "OpenOffice Preview"}
        </button>
        {openOfficePreview ? (
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
            onClick={onRefreshOpenOfficePreview}
            disabled={openOfficeLoading || !tauriAvailable}
          >
            {openOfficeLoading ? "Rendering..." : "Refresh OpenOffice"}
          </button>
        ) : null}
        {openOfficePreview ? (
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
            onClick={onToggleAutoRefresh}
            disabled={!tauriAvailable}
          >
            Auto Refresh: {openOfficeAutoRefresh ? "On" : "Off"}
          </button>
        ) : null}

        {/* Formatting buttons */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground shadow-sm">
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs"
            onClick={() => {
              editableRef.current?.focus();
              document.execCommand("bold");
            }}
            aria-label="Bold"
          >
            B
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs"
            onClick={() => {
              editableRef.current?.focus();
              document.execCommand("italic");
            }}
            aria-label="Italic"
          >
            I
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs"
            onClick={() => {
              editableRef.current?.focus();
              document.execCommand("underline");
            }}
            aria-label="Underline"
          >
            U
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs"
            onClick={() => {
              editableRef.current?.focus();
              document.execCommand("insertUnorderedList");
            }}
            aria-label="Bulleted list"
          >
            •
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs"
            onClick={() => {
              editableRef.current?.focus();
              document.execCommand("insertOrderedList");
            }}
            aria-label="Numbered list"
          >
            1.
          </button>
        </div>

        {/* Export buttons */}
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? "Exporting..." : "Export PDF"}
        </button>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
          onClick={onPrint}
          disabled={printing}
        >
          {printing ? "Printing..." : "Print"}
        </button>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
          onClick={onExportDocx}
          disabled={exportingDocx}
        >
          {exportingDocx ? "Exporting DOCX..." : "Export DOCX"}
        </button>

        {/* Error messages */}
        {exportError ? (
          <span className="text-xs text-destructive">{exportError}</span>
        ) : null}
        {printError ? (
          <span className="text-xs text-destructive">{printError}</span>
        ) : null}
        {exportDocxError ? (
          <span className="text-xs text-destructive">{exportDocxError}</span>
        ) : null}
        {openOfficeError ? (
          <span className="text-xs text-destructive">OpenOffice: {openOfficeError}</span>
        ) : null}
        {openOfficeError && openOfficeError.toLowerCase().includes("soffice") ? (
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm disabled:opacity-50"
            onClick={onInstallDocTools}
            disabled={docToolsInstalling || !tauriAvailable}
          >
            {docToolsInstalling ? "Installing tools..." : "Install Doc Tools"}
          </button>
        ) : null}
        {openOfficePreview && openOfficeStale ? (
          <span className="text-xs text-warning">OpenOffice preview stale</span>
        ) : null}
        <span className="text-xs text-muted-foreground">{layoutSummary}</span>
      </div>
    </div>
  );
}
