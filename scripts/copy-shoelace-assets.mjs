import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const srcDir = path.join(
	projectRoot,
	"node_modules",
	"@shoelace-style",
	"shoelace",
	"dist",
	"assets",
);
const destDir = path.join(projectRoot, "public", "shoelace", "assets");

async function main() {
	try {
		await fs.access(srcDir);
	} catch {
		console.error(`Shoelace assets not found at: ${srcDir}`);
		console.error("Did you run `npm install`?");
		process.exit(1);
	}

	await fs.mkdir(destDir, { recursive: true });
	await fs.cp(srcDir, destDir, { recursive: true });
	console.log(
		`Copied Shoelace assets -> ${path.relative(projectRoot, destDir)}`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
