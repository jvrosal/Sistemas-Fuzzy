import { APP_INFO, INFERENCE_STAGES } from './constants.js';
import { initializeInterface, mountSimulator } from './ui.js';

const root = document.querySelector('#app');

initializeInterface(root, {
  title: APP_INFO.title,
  stages: INFERENCE_STAGES
});

mountSimulator(root);
