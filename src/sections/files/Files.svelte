<script lang="ts">
	import { tick } from "svelte";
	import type { State } from "../../state";
	import { FileSystem, type Node } from "./filesystem.svelte";
	import type { SlDialog, SlInput } from "@shoelace-style/shoelace";

	let {
		appState,
	}: {
		appState: State | null;
	} = $props();

	const filesystem = new FileSystem();

	// Files settings
	let showAsGrid = $state(true);
	let syncFiles = $derived(Boolean(appState?.userId));
	let syncFilesDismissed = $state(
		sessionStorage.getItem("syncFilesDismissed") === "true",
	);

	// Modals
	let newFolderDialog = $state<SlDialog | null>(null);
	let newFolderInput = $state<SlInput | null>(null);
	let newFolderName = $state("");
</script>

{#snippet dirOrFile<T extends "dir" | "file">(type: T, data: Node<T>)}
	{#if type === "dir"}
		<div class="folder-item" onclick={() => filesystem.pushPath(data.name)}>
			<sl-icon name="folder" style="margin-right: 0.5rem;"></sl-icon>
			{data.name}
		</div>
	{:else if type === "file"}
		<div class="mt-1 flex justify-between align-baseline">
			<div>{data.name}</div>
			<sl-button variant="text" caret>Download</sl-button>
		</div>
	{/if}
{/snippet}

{#snippet gridOrList<T extends "dir" | "file">(
	type: T,
	data: Node<T>[],
	showAsGrid: boolean,
	fallback: string,
)}
	{#if showAsGrid}
		<div class="file-list-block">
			{#if data.length}
				{#each data as datum}
					{@render dirOrFile(type, datum)}
				{/each}
			{:else}
				<p>{fallback}</p>
			{/if}
		</div>
	{:else if data.length}
		{#each data as datum}
			{@render dirOrFile(type, datum)}
		{/each}
	{:else}
		<p>{fallback}</p>
	{/if}
{/snippet}

<section class="p-1">
	<h1>Files</h1>

	<div class="flex justify-between gap-1 align-center">
		<sl-breadcrumb>
			<sl-breadcrumb-item onclick={() => filesystem.home()}
				>Home</sl-breadcrumb-item
			>
			{#each filesystem.breadcrumbs as { name, path }}
				<sl-breadcrumb-item onclick={() => filesystem.navigateTo(path)}
					>{name}</sl-breadcrumb-item
				>
			{/each}
		</sl-breadcrumb>

		<sl-button-group label="Alignment">
			<!-- Back button -->
			<sl-button
				disabled={filesystem.breadcrumbs.length === 0}
				onclick={() => filesystem.back()}
			>
				<sl-icon name="chevron-left"></sl-icon>
			</sl-button>

			<!-- Add to fs -->
			<sl-dropdown>
				<sl-button slot="trigger">
					<sl-icon name="plus-lg"></sl-icon>
				</sl-button>
				<sl-menu>
					<sl-menu-item
						value="addFolder"
						onclick={() => newFolderDialog?.show()}
					>
						Add Folder
						<sl-icon slot="prefix" name="folder"></sl-icon>
					</sl-menu-item>
					<sl-menu-item value="uploadFolder">
						Upload Files
						<sl-icon slot="prefix" name="file-arrow-up"></sl-icon>
					</sl-menu-item>
					<sl-menu-item value="speechToText">
						New Script
						<sl-icon slot="prefix" name="book"></sl-icon>
					</sl-menu-item>
					<sl-menu-item value="speechToText">
						New Recording
						<sl-icon slot="prefix" name="mic"></sl-icon>
					</sl-menu-item>
				</sl-menu>
			</sl-dropdown>

			<!-- Files settings -->
			<sl-dropdown>
				<sl-button slot="trigger">
					<sl-icon name="three-dots-vertical"></sl-icon>
				</sl-button>
				<sl-menu>
					<sl-menu-item
						value="showGrid"
						disabled={showAsGrid}
						onclick={() => {
							showAsGrid = true;
						}}
					>
						Show as grid
						<sl-icon slot="prefix" name="grid"></sl-icon>
						{#if showAsGrid}
							<sl-icon slot="suffix" name="check"></sl-icon>
						{/if}
					</sl-menu-item>
					<sl-menu-item
						value="showList"
						disabled={!showAsGrid}
						onclick={() => {
							showAsGrid = false;
						}}
					>
						Show as list
						<sl-icon slot="prefix" name="list"></sl-icon>
						{#if !showAsGrid}
							<sl-icon slot="suffix" name="check"></sl-icon>
						{/if}
					</sl-menu-item>
					<sl-divider></sl-divider>
				</sl-menu>
			</sl-dropdown>
		</sl-button-group>
	</div>

	<div class="file-list">
		<!-- Directory list -->
		{#if filesystem.dirs.length}
			<div class="file-list-block">
				{#each filesystem.dirs as dir}
					<div
						class="folder-item"
						onclick={() => filesystem.pushPath(dir.name)}
					>
						<sl-icon name="folder" style="margin-right: 0.5rem;"
						></sl-icon>
						{dir.name}
					</div>
				{/each}
			</div>
		{/if}

		<!-- File list -->
		<div class="file-list-block">
			{#if filesystem.files.length}
				{#each filesystem.files as file}
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
		onkeydown={(e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();

			const name = newFolderName.trim();
			if (!name) return;
			filesystem.addFolder(name);
			newFolderDialog?.hide();
		}}
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
			const name = newFolderName.trim();
			if (!name) return;
			filesystem.addFolder(name);
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
