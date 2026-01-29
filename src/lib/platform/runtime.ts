export function isTauri(): boolean {
	return (
		typeof window !== "undefined" &&
		// Tauri injects a global __TAURI__ object in the webview.
		"__TAURI__" in window
	);
}

/**
 * "Native" here means "running inside a native shell" (Tauri), not just mobile.
 */
export function isNativeShell(): boolean {
	return isTauri();
}

export function isTauriMobile(): boolean {
	if (!isTauri()) return false;
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent ?? "";
	return /Android|iPhone|iPad|iPod/i.test(ua);
}
