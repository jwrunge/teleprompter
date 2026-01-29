import { readJson, writeJson } from "../../lib/storage/kvStore";

export type Node<T extends "dir" | "file"> = {
	type: T;
	name: string;
	content: (T extends "file" ? string : Node<"dir" | "file">)[];
};

export type Directory = Node<"dir">;
export type FileNode = Node<"file">;

export class FileSystem {
	#nodes = $state<Node<"dir" | "file">[]>([]);
	#selectedIndices = $state<number[]>([]);
	showAsGrid = $state(true);
	#persistKey = "files.json";

	constructor() {
		void this.#loadFiles();
	}

	#loadFiles = async () => {
		await this.#loadFilesFromLocalCache();
	};

	#loadFilesFromLocalCache = async () => {
		this.#nodes = await readJson<Node<"dir" | "file">[]>(this.#persistKey, []);
	};

	#saveFilesToLocalCache = async () => {
		await writeJson(this.#persistKey, this.#nodes);
	};

	getNodeAtPath = (path: number[]) => {
		let node: Node<"dir" | "file"> | null = null;
		for (const idx of path) {
			if (node === null) {
				node = this.#nodes[idx] ?? null;
			} else if (node.type === "dir") {
				node = (node.content[idx] as Node<"dir" | "file">) ?? null;
			} else {
				return null;
			}
		}
		return node;
	};

	#getCurrentNode(selectedIndices: number[]) {
		let node: Node<"dir" | "file"> | null = null;
		for (const idx of selectedIndices) {
			if (node === null) {
				node = this.#nodes[idx];
			} else if (node.type === "dir") {
				node = node.content[idx] as Node<"dir" | "file">;
			} else {
				node = null;
				break;
			}
		}
		return node ?? { type: "dir", name: "root", content: this.#nodes };
	}

	get currentNode() {
		return this.#getCurrentNode(this.#selectedIndices);
	}

	get dirs() {
		const currentNode = this.currentNode;
		if (currentNode.type !== "dir") return [];

		return (currentNode as Directory).content.filter(
			({ type }) => type === "dir",
		) as Directory[];
	}

	get files() {
		const currentNode = this.currentNode;
		if (currentNode.type !== "dir") return [];

		return (currentNode as Directory).content.filter(
			({ type }) => type === "file",
		) as FileNode[];
	}

	get breadcrumbs() {
		const crumbs: { name: string; path: number[] }[] = [];
		const path: number[] = [];
		let node: Node<"dir" | "file"> | null = null;

		for (const idx of this.#selectedIndices) {
			if (node === null) {
				node = this.#nodes[idx];
			} else if (node.type === "dir") {
				node = node.content[idx] as Node<"dir" | "file">;
			} else {
				node = null;
				break;
			}

			if (node) {
				crumbs.push({ name: node.name, path: [...path, idx] });
				path.push(idx);
			}
		}

		return crumbs;
	}

	home() {
		this.#selectedIndices = [];
	}

	navigateTo(path: number[]) {
		this.#selectedIndices = path;
	}

	back() {
		this.#selectedIndices = this.#selectedIndices.slice(0, -1);
	}

	pushPath(name: string) {
		const currentNode = this.currentNode;
		if (currentNode.type !== "dir") return;

		const dirIndex = (currentNode as Directory).content.findIndex(
			(node) => node.name === name && node.type === "dir",
		);
		if (dirIndex === -1) return;

		this.#selectedIndices = [...this.#selectedIndices, dirIndex];
	}

	addFolder = (name: string) => {
		if (this.currentNode?.type === "file") return;
		const newFolder: Node<"dir"> = { type: "dir", name, content: [] };
		if (this.currentNode) {
			this.currentNode.content.push(newFolder);
		} else {
			this.#nodes.push(newFolder);
		}
		void this.#saveFilesToLocalCache();
	};

	removeFolder = (name: string) => {
		const currentNode = this.currentNode;
		if (!currentNode || currentNode.type !== "dir") return;

		const idx = (currentNode as Directory).content.findIndex(
			(node) => node.type === "dir" && node.name === name,
		);
		if (idx === -1) return;

		(currentNode as Directory).content.splice(idx, 1);
		void this.#saveFilesToLocalCache();
	};
}
