// Entry point used by every page: api('/path', { method, body }).
// The "server" runs in the browser on Firebase (see backend.js), so the site can be hosted on GitHub Pages.
import { handle } from './backend.js';

export function api(path, { method = 'GET', body } = {}) {
  return handle(method, path, body);
}
