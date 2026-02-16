const state = {
  imagesEnabled: true,
  imagesBlurred: false,
  animationsDisabled: false,
  selectedTextStyle: null,
  originalStylesStored: false
};

export function getImagesEnabled() { return state.imagesEnabled; }
export function setImagesEnabled(value) { state.imagesEnabled = value; }
export function getImagesBlurred() { return state.imagesBlurred; }
export function setImagesBlurred(value) { state.imagesBlurred = value; }
export function getAnimationsDisabled() { return state.animationsDisabled; }
export function setAnimationsDisabled(value) { state.animationsDisabled = value; }
export function getSelectedTextStyle() { return state.selectedTextStyle; }
export function setSelectedTextStyle(value) { state.selectedTextStyle = value; }
export function getOriginalStylesStored() { return state.originalStylesStored; }
export function setOriginalStylesStored(value) { state.originalStylesStored = value; }

export function resetState() {
  state.imagesEnabled = true;
  state.imagesBlurred = false;
  state.animationsDisabled = false;
  state.selectedTextStyle = null;
  // Don't reset originalStylesStored - we want to keep the stored styles
}
