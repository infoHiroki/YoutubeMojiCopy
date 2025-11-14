import { loadPrompts, savePrompts } from './promptManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('templatesContainer');
  const addBtn = document.getElementById('addTemplate');
  const deleteAllBtn = document.getElementById('deleteAll');
  const resetBtn = document.getElementById('resetToDefault');

  // カスタム確認ダイアログの要素
  const dialogOverlay = document.getElementById('confirmDialog');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogMessage = document.getElementById('dialogMessage');
  const dialogOkBtn = document.getElementById('dialogOk');
  const dialogCancelBtn = document.getElementById('dialogCancel');

  let saveTimeout;

  // カスタム確認ダイアログを表示
  function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      dialogTitle.textContent = title;
      dialogMessage.textContent = message;
      dialogOverlay.style.display = 'flex';

      const handleOk = () => {
        dialogOverlay.style.display = 'none';
        dialogOkBtn.removeEventListener('click', handleOk);
        dialogCancelBtn.removeEventListener('click', handleCancel);
        resolve(true);
      };

      const handleCancel = () => {
        dialogOverlay.style.display = 'none';
        dialogOkBtn.removeEventListener('click', handleOk);
        dialogCancelBtn.removeEventListener('click', handleCancel);
        resolve(false);
      };

      dialogOkBtn.addEventListener('click', handleOk);
      dialogCancelBtn.addEventListener('click', handleCancel);
    });
  }

  // 現在の状態をstorageに保存
  function saveToStorage() {
    const rows = container.querySelectorAll('.template-row');
    const newPrompts = [];
    rows.forEach((row, idx) => {
      const name = row.querySelector('.template-name').value.trim();
      const text = row.querySelector('.template-text').value;
      if (name && text) {
        newPrompts.push({ id: `${Date.now()}_${idx}`, name, text });
      }
    });
    savePrompts(newPrompts);
  }

  // デバウンス付き自動保存
  function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToStorage();
    }, 500);
  }

  // Create a row for a prompt
  function createRow(prompt = { id: '', name: '', text: '' }) {
    const row = document.createElement('div');
    row.className = 'template-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'プロンプト名';
    nameInput.value = prompt.name;
    nameInput.className = 'template-name';

    const textArea = document.createElement('textarea');
    textArea.placeholder = 'プロンプト内容';
    textArea.value = prompt.text;
    textArea.className = 'template-text';

    const delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.className = 'deleteTemplate';
    delBtn.addEventListener('click', async () => {
      if (await showConfirmDialog('削除の確認', 'このプロンプトを削除しますか？')) {
        container.removeChild(row);
        saveToStorage();
      }
    });

    // 自動保存の設定
    nameInput.addEventListener('input', autoSave);
    textArea.addEventListener('input', autoSave);

    row.appendChild(nameInput);
    row.appendChild(textArea);
    row.appendChild(delBtn);
    return row;
  }

  // Load existing prompts
  loadPrompts().then((promptsList) => {
    promptsList.forEach((p) => {
      const row = createRow(p);
      container.appendChild(row);
    });
  });

  // Add new empty prompt
  addBtn.addEventListener('click', () => {
    const row = createRow();
    container.appendChild(row);
    saveToStorage();
  });

  // すべて削除
  deleteAllBtn.addEventListener('click', async () => {
    if (await showConfirmDialog('すべて削除', '本当にすべてのプロンプトを削除しますか？')) {
      container.innerHTML = '';
      saveToStorage();
    }
  });

  // 初期化（デフォルトに戻す）
  resetBtn.addEventListener('click', async () => {
    if (await showConfirmDialog('初期化の確認', 'デフォルトのプロンプトに戻しますか？\n現在のプロンプトはすべて削除されます。')) {
      // デフォルトプロンプトを読み込み
      const response = await fetch(chrome.runtime.getURL('defaultPrompts.json'));
      const defaultPrompts = await response.json();

      // 現在の表示をクリア
      container.innerHTML = '';

      // デフォルトプロンプトを表示
      defaultPrompts.forEach((p) => {
        const row = createRow(p);
        container.appendChild(row);
      });

      // 保存
      saveToStorage();
    }
  });
});
