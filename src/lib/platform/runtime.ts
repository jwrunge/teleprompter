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
