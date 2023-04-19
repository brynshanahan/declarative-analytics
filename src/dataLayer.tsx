// @ts-ignore
export const dataLayer = window.dataLayer || (window.dataLayer = []);
export const onDataLayerPushListeners = new Set<() => any>();
// @ts-ignore
window.onDataLayerUpdate = onDataLayerPushListeners;
