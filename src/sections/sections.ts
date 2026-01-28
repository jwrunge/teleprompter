export const sectionViews = ["camera", "files", "voice"] as const;
export type SectionView = (typeof sectionViews)[number];
