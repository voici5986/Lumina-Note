import { useState, useRef } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Loader2, RefreshCw, Download, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";

export function UpdateChecker() {
    const [checking, setChecking] = useState(false);
    const [update, setUpdate] = useState<Update | null>(null);
    const [status, setStatus] = useState<"idle" | "downloading" | "installing" | "ready" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [downloadedSize, setDownloadedSize] = useState<string>("");

    const contentLengthRef = useRef<number>(0);
    const downloadedRef = useRef<number>(0);

    const checkForUpdates = async () => {
        try {
            setChecking(true);
            setError(null);
            setStatus("idle");

            const updateResult = await check();

            if (updateResult?.available) {
                setUpdate(updateResult);
            } else {
                setUpdate(null);
            }
        } catch (err) {
            console.error("Failed to check for updates:", err);
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        } finally {
            setChecking(false);
        }
    };

    const installUpdate = async () => {
        if (!update) return;

        try {
            setStatus("downloading");
            setProgress(0);
            setDownloadedSize("");
            contentLengthRef.current = 0;
            downloadedRef.current = 0;

            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case 'Started':
                        const len = (event.data as any).contentLength;
                        if (len) contentLengthRef.current = len;
                        break;
                    case 'Progress':
                        const chunk = (event.data as any).chunkLength;
                        downloadedRef.current += chunk;

                        if (contentLengthRef.current > 0) {
                            const pct = (downloadedRef.current / contentLengthRef.current) * 100;
                            setProgress(pct);
                            setDownloadedSize(`${(downloadedRef.current / 1024 / 1024).toFixed(1)} MB / ${(contentLengthRef.current / 1024 / 1024).toFixed(1)} MB`);
                        } else {
                            setDownloadedSize(`${(downloadedRef.current / 1024 / 1024).toFixed(1)} MB`);
                        }
                        break;
                    case 'Finished':
                        setStatus("installing");
                        break;
                }
            });

            setStatus("ready");
        } catch (err) {
            console.error("Failed to install update:", err);
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
    };

    const handleRelaunch = async () => {
        try {
            await relaunch();
        } catch (err) {
            console.error("Failed to relaunch:", err);
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="font-medium">软件更新</h3>
                    <p className="text-sm text-muted-foreground">
                        {status === "idle" && !update && "检查新版本"}
                        {status === "idle" && update && `发现新版本 v${update.version}`}
                        {status === "downloading" && "正在下载更新..."}
                        {status === "installing" && "正在安装..."}
                        {status === "ready" && "更新已就绪"}
                        {status === "error" && "更新失败"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {status === "idle" && !update && (
                        <button
                            onClick={checkForUpdates}
                            disabled={checking}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {checking ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            检查更新
                        </button>
                    )}

                    {status === "idle" && update && (
                        <button
                            onClick={installUpdate}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            下载并安装
                        </button>
                    )}

                    {status === "ready" && (
                        <button
                            onClick={handleRelaunch}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            重启生效
                        </button>
                    )}
                </div>
            </div>

            {/* 错误信息 */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            {/* 更新详情 */}
            {update && status === "idle" && (
                <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="font-medium text-foreground mb-1">版本 {update.version}</p>
                    <p className="whitespace-pre-wrap">{update.body || "暂无更新日志"}</p>
                </div>
            )}

            {/* 进度条 */}
            {status === "downloading" && (
                <div className="space-y-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{downloadedSize}</span>
                        <span>{progress > 0 ? `${progress.toFixed(1)}%` : "准备中..."}</span>
                    </div>
                </div>
            )}

            {/* 就绪提示 */}
            {status === "ready" && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-3 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>更新已下载并安装，请重启应用以生效。</span>
                </div>
            )}
        </div>
    );
}
