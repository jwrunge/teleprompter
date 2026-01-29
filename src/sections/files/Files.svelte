<script lang="ts">
	import { onMount, tick } from "svelte";
	import type { State } from "../../state";
	import { Filesystem } from "@capacitor/filesystem";
	import type { SlDialog, SlInput } from "@shoelace-style/shoelace";

	type Node<T extends "dir" | "file"> = {
		type: T;
		name: string;
		content: (T extends "file" ? string : Node<"dir" | "file">)[];
	};

	let {
		appState,
	}: {
		appState: State | null;
	} = $props();

	let nodes = $state<Node<"dir" | "file">[]>([]);
	let selectedIndices = $state<number[]>([]);

	const getNodeAtPath = (path: number[]) => {
		let node: Node<"dir" | "file"> | null = null;
		for (const idx of path) {
			if (node === null) {
				node = nodes[idx] ?? null;
			} else if (node.type === "dir") {
				node = (node.content[idx] as Node<"dir" | "file">) ?? null;
			} else {
				return null;
			}
		}
		return node;
	};

	let currentNode = $derived(
		((selectedIndices: number[]) => {
			let node: Node<"dir" | "file"> | null = null;
			for (const idx of selectedIndices) {
				if (node === null) {
					node = nodes[idx];
				} else if (node.type === "dir") {
					node = node.content[idx] as Node<"dir" | "file">;
				} else {
					node = null;
					break;
				}
			}
			return node ?? { type: "dir", name: "root", content: nodes };
		})(selectedIndices),
	);

	let dirs = $derived(
		(currentNode?.type === "dir" &&
			((currentNode as Node<"dir">)?.content.filter(
				({ type }) => type === "dir",
			) as Node<"dir">[])) ||
			[],
	);
	let files = $derived(
		(currentNode?.type === "dir" &&
			((currentNode as Node<"dir">)?.content.filter(
				({ type }) => type === "file",
			) as Node<"file">[])) ||
			[],
	);

	let syncFiles = $derived(Boolean(appState?.userId));

	let syncFilesDismissed = $state(
		sessionStorage.getItem("syncFilesDismissed") === "true",
	);

	// Modals
	let newFolderDialog = $state<SlDialog | null>(null);
	let newFolderInput = $state<SlInput | null>(null);
	let newFolderName = $state("");

	const loadFilesFromLocalCache = async () => {
		if (appState) {
			try {
				const res = await Filesystem.readFile({ path: "files.json" });
				nodes =
					typeof res.data === "string"
						? (JSON.parse(res.data) as Node<"dir" | "file">[])
						: [];
			} catch (e) {
				// No files yet
			}
		}
	};

	const addFolder = (name: string) => {
		if (currentNode?.type == "file") return;
		const newFolder: Node<"dir"> = { type: "dir", name, content: [] };
		if (currentNode) {
			currentNode.content.push(newFolder);
		} else {
			nodes.push(newFolder);
		}
	};

	const removeFolder = (name: string) => {};

	onMount(async () => {
		await loadFilesFromLocalCache();
	});
</script>

<section class="p-1">
	<h1>Files</h1>

	<div class="flex justify-between gap-1 align-center">
		<sl-breadcrumb>
			<sl-breadcrumb-item onclick={() => (selectedIndices = [])}
				>Home</sl-breadcrumb-item
			>
			{#each selectedIndices as idx, level}
				{@const crumb =
					getNodeAtPath(selectedIndices.slice(0, level + 1))?.name ||
					"unknown"}
				<sl-breadcrumb-item
					onclick={() =>
						(selectedIndices = selectedIndices.slice(0, level + 1))}
					>{crumb}</sl-breadcrumb-item
				>
			{/each}
		</sl-breadcrumb>

		<sl-button-group label="Alignment">
			<!-- Back button -->
			<sl-button
				disabled={selectedIndices.length === 0}
				onclick={() => {
					selectedIndices = selectedIndices.slice(0, -1);
				}}
			>
				<sl-icon name="chevron-left"></sl-icon>
			</sl-button>
			<sl-dropdown>
				<sl-button slot="trigger">
					<sl-icon name="plus-lg"></sl-icon>
				</sl-button>
				<sl-menu>
					<sl-menu-item value="uploadFolder">
						Upload Files
						<sl-icon slot="prefix" name="file-arrow-up"></sl-icon>
					</sl-menu-item>
					<sl-menu-item
						value="addFolder"
						onclick={() => newFolderDialog?.show()}
					>
						Add Folder
						<sl-icon slot="prefix" name="folder"></sl-icon>
					</sl-menu-item>
					<sl-menu-item value="speechToText">
						Speech-To-Text
						<sl-icon slot="prefix" name="mic"></sl-icon>
					</sl-menu-item>
				</sl-menu>
			</sl-dropdown>
		</sl-button-group>
	</div>

	<div class="file-list">
		{#if dirs.length}
			<div class="file-list-block">
				{#each dirs as dir}
					<div
						class="folder-item"
						onclick={() => {
							const parent =
								currentNode?.type === "dir"
									? (currentNode as Node<"dir">).content
									: nodes;
							const childIdx = parent.indexOf(dir);
							if (childIdx >= 0) {
								selectedIndices = [
									...selectedIndices,
									childIdx,
								];
							}
						}}
					>
						<sl-icon name="folder" style="margin-right: 0.5rem;"
						></sl-icon>
						{dir.name}
					</div>
				{/each}
			</div>
		{/if}

		<div class="file-list-block">
			{#if files.length}
				{#each files as file}
					<div class="mt-1 flex justify-between align-baseline">
						<div>{file.name}</div>
						<sl-button variant="text" caret>Download</sl-button>
					</div>
				{/each}
			{:else}
				<p>No files yet.</p>
			{/if}
		</div>
	</div>

	<sl-alert
		class="sticky bottom-0"
		variant="warning"
		open={!syncFiles && !syncFilesDismissed}
		closable
		onsl-after-hide={() => {
			syncFilesDismissed = true;
			sessionStorage.setItem("syncFilesDismissed", "true");
		}}
	>
		<sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
		<strong>Your file storage is volatile.</strong><br />
		{import.meta.env.VITE_APP_NAME} stores your files in your browser's per-page
		database; clearing your browser data will delete your files. Make sure to
		download important files to your local device, or
		<a href="#create">create an account</a> to store your files in the cloud
		and sync between devices.
	</sl-alert>
</section>

<sl-dialog
	label="Add a folder"
	bind:this={newFolderDialog}
	onsl-after-show={async () => {
		await tick();
		await newFolderInput?.updateComplete;
		const inner = newFolderInput?.shadowRoot?.querySelector(
			"input, textarea",
		) as HTMLInputElement | HTMLTextAreaElement | null;
		inner?.focus();
	}}
	onsl-after-hide={() => {
		newFolderName = "";
	}}
>
	<sl-input
		bind:this={newFolderInput}
		placeholder="My folder name"
		value={newFolderName}
		onsl-input={(e) => (newFolderName = (e.target as SlInput).value)}
	></sl-input>
	<sl-button
		slot="footer"
		variant="neutral"
		onclick={() => {
			newFolderDialog?.hide();
		}}>Cancel</sl-button
	>
	<sl-button
		slot="footer"
		variant="primary"
		disabled={!newFolderName}
		onclick={() => {
			addFolder(newFolderName);
			newFolderDialog?.hide();
		}}>Add</sl-button
	>
</sl-dialog>

<style>
	.file-list {
		margin-top: 1rem;
		margin-bottom: 2rem;
		padding: 1rem;
		border: 2px solid var(--sl-color-neutral-500);
		border-radius: var(--sl-border-radius-medium);
	}

	.file-list-block {
		& + .file-list-block {
			margin-top: 1rem;
		}

		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
	}

	.folder-item {
		padding: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--sl-border-radius-medium);
		background: var(--sl-color-neutral-200);

		&:hover {
			background: var(--sl-color-neutral-300);
			cursor: pointer;
		}
	}
</style>
