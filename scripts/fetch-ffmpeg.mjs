import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const projectRoot = process.cwd();
const binDir = path.join(projectRoot, "src-tauri", "bin");
const platform = process.platform;
const arch = process.arch;

function targetTriple() {
	if (platform === "darwin") {
		return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
	}
	if (platform === "linux") {
		return arch === "arm64"
			? "aarch64-unknown-linux-gnu"
			: "x86_64-unknown-linux-gnu";
	}
	if (platform === "win32") {
		return arch === "arm64"
			? "aarch64-pc-windows-msvc"
			: "x86_64-pc-windows-msvc";
	}
	throw new Error(`Unsupported platform ${platform} ${arch}`);
}

function exeSuffix() {
	return platform === "win32" ? ".exe" : "";
}

function defaultDownloadUrl() {
	if (platform === "win32") {
		const winArch = arch === "arm64" ? "winarm64" : "win64";
		return `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-${winArch}-lgpl.zip`;
	}
	if (platform === "linux") {
		const linuxArch = arch === "arm64" ? "linuxarm64" : "linux64";
		return `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-${linuxArch}-lgpl.tar.xz`;
	}
	return null;
}

function findInPath(cmd) {
	const pathEnv = process.env.PATH ?? "";
	for (const p of pathEnv.split(path.delimiter)) {
		if (!p) continue;
		const candidate = path.join(p, cmd + exeSuffix());
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

async function downloadToFile(url, dest) {
	await fsp.mkdir(path.dirname(dest), { recursive: true });
	await new Promise((resolve, reject) => {
		https
			.get(url, { headers: { "User-Agent": "teleprompter" } }, (res) => {
				if (
					res.statusCode &&
					res.statusCode >= 300 &&
					res.statusCode < 400 &&
					res.headers.location
				) {
					void downloadToFile(res.headers.location, dest)
						.then(resolve)
						.catch(reject);
					return;
				}
				if (res.statusCode !== 200) {
					reject(new Error(`Failed to download ${url} (${res.statusCode})`));
					return;
				}
				void pipeline(res, fs.createWriteStream(dest))
					.then(resolve)
					.catch(reject);
			})
			.on("error", reject);
	});
}

function extractArchive(archivePath, destDir) {
	if (platform === "win32") {
		execFileSync(
			"powershell",
			[
				"-NoProfile",
				"-Command",
				`Expand-Archive -Force -Path "${archivePath}" -DestinationPath "${destDir}"`,
			],
			{ stdio: "inherit" },
		);
		return;
	}
	if (archivePath.endsWith(".zip")) {
		execFileSync("unzip", ["-q", archivePath, "-d", destDir], {
			stdio: "inherit",
		});
		return;
	}
	execFileSync("tar", ["-xJf", archivePath, "-C", destDir], {
		stdio: "inherit",
	});
}

async function findBinary(rootDir, fileName) {
	const entries = await fsp.readdir(rootDir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(rootDir, entry.name);
		if (entry.isDirectory()) {
			const nested = await findBinary(full, fileName);
			if (nested) return nested;
		} else if (entry.isFile() && entry.name === fileName) {
			return full;
		}
	}
	return null;
}

async function main() {
	const target = targetTriple();
	const dest = path.join(binDir, `ffmpeg-${target}${exeSuffix()}`);

	if (fs.existsSync(dest) && process.env.FFMPEG_FORCE !== "1") {
		console.log(`FFmpeg sidecar already present at ${dest}`);
		return;
	}

	await fsp.mkdir(binDir, { recursive: true });

	const overrideUrl = process.env.FFMPEG_DOWNLOAD_URL ?? null;
	if (overrideUrl) {
		const tmpFile = path.join(os.tmpdir(), `ffmpeg-${Date.now()}`);
		await downloadToFile(overrideUrl, tmpFile);
		const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ffmpeg-"));
		extractArchive(tmpFile, tmpDir);
		const binary = await findBinary(
			tmpDir,
			platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
		);
		if (!binary) throw new Error("ffmpeg binary not found in archive");
		fs.copyFileSync(binary, dest);
		if (platform !== "win32") fs.chmodSync(dest, 0o755);
		console.log(`FFmpeg sidecar written to ${dest}`);
		return;
	}

	if (platform === "darwin") {
		const systemFfmpeg = findInPath("ffmpeg");
		if (!systemFfmpeg) {
			throw new Error(
				"ffmpeg not found in PATH. Install via Homebrew or set FFMPEG_DOWNLOAD_URL.",
			);
		}
		fs.copyFileSync(systemFfmpeg, dest);
		fs.chmodSync(dest, 0o755);
		console.log(`Copied ${systemFfmpeg} -> ${dest}`);
		return;
	}

	const url = defaultDownloadUrl();
	if (!url) {
		throw new Error(
			"No default FFmpeg download URL for this platform. Set FFMPEG_DOWNLOAD_URL.",
		);
	}
	const tmpFile = path.join(
		os.tmpdir(),
		`ffmpeg-${Date.now()}${url.endsWith(".zip") ? ".zip" : ".tar.xz"}`,
	);
	await downloadToFile(url, tmpFile);
	const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ffmpeg-"));
	extractArchive(tmpFile, tmpDir);
	const binary = await findBinary(
		tmpDir,
		platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
	);
	if (!binary) throw new Error("ffmpeg binary not found in archive");
	fs.copyFileSync(binary, dest);
	if (platform !== "win32") fs.chmodSync(dest, 0o755);
	console.log(`FFmpeg sidecar written to ${dest}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
