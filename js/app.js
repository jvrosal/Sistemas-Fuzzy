import { APP_INFO, INFERENCE_STAGES } from './constants.js';
import { initializeInterface } from './ui.js';

initializeInterface(document.querySelector('#app'), {
  title: APP_INFO.title,
  stages: INFERENCE_STAGES
});
