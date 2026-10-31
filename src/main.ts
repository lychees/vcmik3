import { GameApplication } from './integration/GameApplication';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Application root is missing');

try {
  const application = new GameApplication(root);
  if (import.meta.hot) import.meta.hot.dispose(() => application.dispose());
} catch (error) {
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : 'Unable to start Aster Vale.';
  const heading = document.createElement('strong');
  heading.textContent = 'The realm could not be opened';
  const wrapper = document.createElement('main');
  wrapper.className = 'h3-application-fatal';
  const content = document.createElement('div');
  content.append(heading, message);
  wrapper.appendChild(content);
  root.replaceChildren(wrapper);
  console.error(error);
}
