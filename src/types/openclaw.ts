export type OpenClawAttachmentStatus = "attached" | "unavailable";

export interface OpenClawGatewaySettings {
  enabled: boolean;
  endpoint: string | null;
}

export interface OpenClawConflictState {
  workspacePath: string;
  status: "idle" | "warning";
  files: string[];
  lastDetectedAt: string | null;
  message: string | null;
}

export interface OpenClawWorkspaceAttachment {
  kind: "openclaw";
  hostWorkspacePath: string;
  workspacePath: string;
  status: OpenClawAttachmentStatus;
  attachedAt: string;
  lastValidatedAt: string | null;
  detectedFiles: string[];
  detectedFolders: string[];
  gateway: OpenClawGatewaySettings;
  unavailableReason?: string | null;
}
