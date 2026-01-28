<script lang="ts">
	import type { State } from "../../state";

	let {
		appState,
	}: {
		appState: State | null;
	} = $props();

	let syncFiles = $derived(Boolean(appState?.userId));

	let syncFilesDismissed = $state(
		sessionStorage.getItem("syncFilesDismissed") === "true",
	);

	const loadFilesFromLocalCache = async () => {
		if (appState) {
			await C;
		}
	};
</script>

<section class="p-1">
	<div class="flex justify-between align-center">
		<h1>Files</h1>
		<sl-dropdown>
			<sl-button slot="trigger" caret>Add</sl-button>
			<sl-menu>
				<sl-menu-item value="cut">Upload Files</sl-menu-item>
				<sl-menu-item value="copy">Add Folder</sl-menu-item>
				<sl-menu-item value="copy">Speech-To-Text</sl-menu-item>
			</sl-menu>
		</sl-dropdown>
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
