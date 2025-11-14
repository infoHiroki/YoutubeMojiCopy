// promptManager.js
// Handles loading and saving prompt templates using Chrome storage
const STORAGE_KEY = 'customPrompts';

/**
 * Load prompts from sync storage; fall back to defaultPrompts.json if none saved.
 * @returns {Promise<Array<{id: string, name: string, text: string}>>}
 */
export async function loadPrompts() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      const prompts = result.customPrompts;
      // 保存されたプロンプトがある場合は、空の配列でもそれを使用
      if (Array.isArray(prompts)) {
        resolve(prompts);
      } else {
        // 初回起動時のみデフォルトプロンプトを読み込む
        const url = chrome.runtime.getURL('defaultPrompts.json');
        fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error('Failed to fetch default prompts');
            return response.json();
          })
          .then((defaultPrompts) => resolve(defaultPrompts))
          .catch((err) => reject(err));
      }
    });
  });
}

/**
 * Save prompts array to sync storage.
 * @param {Array<{id: string, name: string, text: string}>} prompts
 * @returns {Promise<void>}
 */
export function savePrompts(prompts) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: prompts }, () => {
      resolve();
    });
  });
}