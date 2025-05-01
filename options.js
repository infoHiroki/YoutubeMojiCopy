import { loadPrompts, savePrompts } from './promptManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('templatesContainer');
  const addBtn = document.getElementById('addTemplate');
  const saveBtn = document.getElementById('saveTemplates');

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
    delBtn.addEventListener('click', () => {
      container.removeChild(row);
    });

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
  });

  // Save prompts to storage
  saveBtn.addEventListener('click', () => {
    const rows = container.querySelectorAll('.template-row');
    const newPrompts = [];
    rows.forEach((row, idx) => {
      const name = row.querySelector('.template-name').value.trim();
      const text = row.querySelector('.template-text').value;
      if (name && text) {
        newPrompts.push({ id: `${Date.now()}_${idx}`, name, text });
      }
    });
    savePrompts(newPrompts).then(() => {
      alert('保存しました');
    });
  });
});