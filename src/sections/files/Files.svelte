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
</script>

<section>
	<h1>Files</h1>

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
