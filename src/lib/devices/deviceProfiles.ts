export type DeviceKind = "videoinput" | "audioinput";

export type DeviceProfile = {
	kind: DeviceKind;
	deviceId: string;
	label?: string;
	groupId?: string;
	firstSeenAt: string;
	lastSeenAt: string;
	userAgent?: string;
	platform?: string;
	supportedConstraints?: MediaTrackSupportedConstraints;
	capabilities?: MediaTrackCapabilities;
	settings?: MediaTrackSettings;
	appNotes?: string;
};

const STORAGE_KEY = "teleprompter.deviceProfiles.v1";

export function loadDeviceProfiles(): DeviceProfile[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed as DeviceProfile[];
	} catch {
		return [];
	}
}

export function saveDeviceProfiles(profiles: DeviceProfile[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function clearDeviceProfiles(): void {
	localStorage.removeItem(STORAGE_KEY);
}

function stableKey(p: Pick<DeviceProfile, "kind" | "deviceId">): string {
	return `${p.kind}:${p.deviceId}`;
}

export function upsertDeviceProfile(profile: DeviceProfile): DeviceProfile[] {
	const profiles = loadDeviceProfiles();
	const key = stableKey(profile);
	const existingIdx = profiles.findIndex((p) => stableKey(p) === key);

	if (existingIdx >= 0) {
		const existing = profiles[existingIdx];
		profiles[existingIdx] = {
			...existing,
			...profile,
			firstSeenAt: existing.firstSeenAt ?? profile.firstSeenAt,
			lastSeenAt: profile.lastSeenAt,
		};
	} else {
		profiles.push(profile);
	}

	saveDeviceProfiles(profiles);
	return profiles;
}

export function makeProfileFromTrack(options: {
	kind: DeviceKind;
	deviceInfo?: MediaDeviceInfo;
	track: MediaStreamTrack;
	appNotes?: string;
}): DeviceProfile {
	const now = new Date().toISOString();
	const supportedConstraints =
		navigator.mediaDevices?.getSupportedConstraints?.();

	let capabilities: MediaTrackCapabilities | undefined;
	try {
		capabilities = options.track.getCapabilities?.();
	} catch {
		capabilities = undefined;
	}

	let settings: MediaTrackSettings | undefined;
	try {
		settings = options.track.getSettings?.();
	} catch {
		settings = undefined;
	}

	return {
		kind: options.kind,
		deviceId: options.deviceInfo?.deviceId ?? settings?.deviceId ?? "",
		label: options.deviceInfo?.label,
		groupId: options.deviceInfo?.groupId,
		firstSeenAt: now,
		lastSeenAt: now,
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		supportedConstraints,
		capabilities,
		settings,
		appNotes: options.appNotes,
	};
}
