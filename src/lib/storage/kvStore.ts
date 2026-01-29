import { isTauri } from "../platform/runtime";

const IDB_DB_NAME = "teleprompter";
const IDB_STORE_NAME = "kv";

function openKvDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("IndexedDB is not available in this environment."));
			return;
		}

		const request = indexedDB.open(IDB_DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
				db.createObjectStore(IDB_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Failed to open IndexedDB"));
	});
}

async function idbGet(key: string): Promise<string | null> {
	const db = await openKvDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE_NAME, "readonly");
		const store = tx.objectStore(IDB_STORE_NAME);
		const request = store.get(key);
		request.onsuccess = () => {
			const value = request.result;
			resolve(typeof value === "string" ? value : null);
		};
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB get failed"));
	});
}

async function idbSet(key: string, value: string): Promise<void> {
	const db = await openKvDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE_NAME, "readwrite");
		const store = tx.objectStore(IDB_STORE_NAME);
		store.put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error("IndexedDB set failed"));
	});
}

async function idbDelete(key: string): Promise<void> {
	const db = await openKvDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE_NAME, "readwrite");
		const store = tx.objectStore(IDB_STORE_NAME);
		store.delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
	});
}

async function tauriResolvePath(relativePath: string): Promise<string> {
	const path = await import("@tauri-apps/api/path");
	const base = await path.appDataDir();
	return await path.join(base, relativePath);
}

export async function readText(key: string): Promise<string | null> {
	if (isTauri()) {
		const fs = await import("@tauri-apps/plugin-fs");
		try {
			const fullPath = await tauriResolvePath(key);
			try {
				if (!(await fs.exists(fullPath))) return null;
			} catch {
				// If `exists` is not permitted by capabilities, we fall back to attempting the read.
			}
			return await fs.readTextFile(fullPath);
		} catch {
			return null;
		}
	}

	return await idbGet(key);
}

export async function writeText(key: string, value: string): Promise<void> {
	if (isTauri()) {
		const fs = await import("@tauri-apps/plugin-fs");
		const path = await import("@tauri-apps/api/path");
		const base = await path.appDataDir();
		try {
			await fs.mkdir(base, { recursive: true });
		} catch {
			// ignore
		}

		const fullPath = await path.join(base, key);
		await fs.writeTextFile(fullPath, value);
		return;
	}

	await idbSet(key, value);
}

export async function deleteKey(key: string): Promise<void> {
	if (isTauri()) {
		const fs = await import("@tauri-apps/plugin-fs");
		try {
			const fullPath = await tauriResolvePath(key);
			await fs.remove(fullPath);
		} catch {
			// ignore
		}
		return;
	}

	await idbDelete(key);
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
	const text = await readText(key);
	if (!text) return fallback;
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
	await writeText(key, JSON.stringify(value));
}
