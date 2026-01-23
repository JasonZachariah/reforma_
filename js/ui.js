import { setText, clampNumber } from './utils.js';
import { getImagesEnabled, getImagesBlurred, getAnimationsDisabled } from './state.js';

// DOM elements
const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const highlightSlider = document.getElementById('highlight');
const highlightValue = document.getElementById('highlightValue');
const toggleImagesButton = document.getElementById('toggleImagesButton');
const blurImagesButton = document.getElementById('blurImagesButton');
const toggleAnimationsButton = document.getElementById('toggleAnimationsButton');

export function updateUI() {
  const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);
  const highlight = clampNumber(highlightSlider?.value, 0, 100, 0);

  setText(fontSizeValue, `${fontSize}px`);
  setText(highlightValue, `${highlight}%`);
  if (toggleImagesButton) {
    toggleImagesButton.textContent = `Images: ${getImagesEnabled() ? 'ON' : 'OFF'}`;
  }
  if (blurImagesButton) {
    blurImagesButton.textContent = `Blur Images: ${getImagesBlurred() ? 'ON' : 'OFF'}`;
  }
  if (toggleAnimationsButton) {
    toggleAnimationsButton.textContent = `Remove Animations: ${getAnimationsDisabled() ? 'ON' : 'OFF'}`;
  }
}
