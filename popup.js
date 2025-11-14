import { loadPrompts } from './promptManager.js';

document.addEventListener("DOMContentLoaded", () => {
  const templateSelect = document.getElementById("templateSelect");
  const manageButton = document.getElementById("manageTemplates");
  const promptTemplate = document.getElementById("promptTemplate");
  const button = document.getElementById("copyTranscript");
  const alertElement = document.getElementById("customAlert");
  const alertMessageElement = document.getElementById("alertMessage");
  const loadingIndicator = document.querySelector(".loading-indicator");

  // プロンプト管理ページへ
  manageButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // プレースホルダーと視覚的フィードバックを更新
  function updateUIState() {
    if (templateSelect.value === "__free__") {
      promptTemplate.placeholder = "メモ・下書き用（自動保存、内容は保持されます）";
      promptTemplate.classList.add("free-input-mode");
    } else if (templateSelect.value === "") {
      promptTemplate.placeholder = "プロンプトを選択するか、自由編集を選んでください";
      promptTemplate.classList.remove("free-input-mode");
    } else {
      promptTemplate.placeholder = "プロンプトを入力してください...";
      promptTemplate.classList.remove("free-input-mode");
    }
  }

  // プロンプトを読み込んでセレクトに追加
  loadPrompts()
    .then((prompts) => {
      templateSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "プロンプト選択";
      templateSelect.appendChild(placeholder);

      // フリー入力オプションを追加
      const freeOption = document.createElement("option");
      freeOption.value = "__free__";
      freeOption.textContent = "✏️ 自由編集";
      templateSelect.appendChild(freeOption);

      prompts.forEach((p) => {
        const option = document.createElement("option");
        option.value = p.text;
        option.textContent = p.name;
        templateSelect.appendChild(option);
      });

      // 前回選択したプロンプトを復元
      chrome.storage.local.get(["selectedPromptName", "freeInputPrompt"], (result) => {
        if (result.selectedPromptName === "✏️ 自由編集" || result.selectedPromptName === "フリー入力") {
          // フリー入力を復元（旧名前も互換性のため対応）
          templateSelect.value = "__free__";
          promptTemplate.value = result.freeInputPrompt || "";
        } else if (result.selectedPromptName) {
          // 保存済みプロンプトを復元
          const options = templateSelect.options;
          for (let i = 0; i < options.length; i++) {
            if (options[i].textContent === result.selectedPromptName) {
              templateSelect.selectedIndex = i;
              promptTemplate.value = options[i].value;
              break;
            }
          }
        }
        updateUIState();
      });
    })
    .catch((err) => console.error("Failed to load prompts:", err));

  // プロンプト選択時の処理
  templateSelect.addEventListener("change", () => {
    if (templateSelect.value === "") {
      promptTemplate.value = "";
      promptTemplate.focus();
      chrome.storage.local.set({ selectedPromptName: "" });
    } else if (templateSelect.value === "__free__") {
      // フリー入力を選択
      chrome.storage.local.get(["freeInputPrompt"], (result) => {
        promptTemplate.value = result.freeInputPrompt || "";
        chrome.storage.local.set({ selectedPromptName: "✏️ 自由編集" });
      });
    } else {
      // 保存済みプロンプトを選択
      promptTemplate.value = templateSelect.value;
      const selectedOption = templateSelect.options[templateSelect.selectedIndex];
      chrome.storage.local.set({
        promptTemplate: templateSelect.value,
        selectedPromptName: selectedOption.textContent
      });
    }
    updateUIState();
  });

  // プロンプトをローカルストレージから読み込む
  chrome.storage.local.get(["promptTemplate"], (result) => {
    if (result.promptTemplate) {
      promptTemplate.value = result.promptTemplate;
    }
  });

  // プロンプトの変更を保存
  promptTemplate.addEventListener("input", () => {
    if (templateSelect.value === "__free__") {
      // フリー入力中は専用のキーに保存
      chrome.storage.local.set({ freeInputPrompt: promptTemplate.value });
    } else {
      // その他の場合は従来通り
      chrome.storage.local.set({ promptTemplate: promptTemplate.value });
    }
  });

  // アラート表示用の関数
  function showAlert(message, isSuccess = true) {
    alertMessageElement.textContent = message;
    alertElement.classList.add("show");

    if (isSuccess) {
      setTimeout(() => {
        window.close();
      }, 1300);
    } else {
      setTimeout(() => {
        alertElement.classList.remove("show");
      }, 1300);
    }
  }

  button.addEventListener("click", async () => {
    loadingIndicator.style.display = "block"; // ローディング開始
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        showAlert("エラー: タブが見つかりません", false);
        return;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            // 複数言語の文字起こしボタンを探して自動クリック
            const transcriptButton =
              document.querySelector('button[aria-label="文字起こしを表示"]') ||
              document.querySelector('button[aria-label="字幕を表示"]') ||
              document.querySelector('button[aria-label="Show transcript"]') ||
              document.querySelector(
                'ytd-menu-service-item-renderer[role="menuitem"]'
              );

            if (!transcriptButton) {
              throw new Error("文字起こしボタンが見つかりません");
            }

            transcriptButton.click();

            // 文字起こしパネルが開くまで待機
            await new Promise((resolve, reject) => {
              const intervalId = setInterval(() => {
                if (document.querySelector("ytd-transcript-segment-renderer")) {
                  clearInterval(intervalId);
                  resolve();
                }
              }, 100);

              // 5秒後にタイムアウト
              setTimeout(() => {
                clearInterval(intervalId);
                reject(
                  new Error("タイムアウト: 文字起こしパネルが開きませんでした")
                );
              }, 5000);
            });

            // 文字起こしセグメントの取得
            const segments = document.querySelectorAll(
              "ytd-transcript-segment-renderer"
            );

            if (segments.length === 0) {
              throw new Error("文字起こしが見つかりません");
            }

            let text = "";
            segments.forEach((segment) => {
              const timestamp =
                segment
                  .querySelector(".segment-timestamp")
                  ?.textContent?.trim() || "";
              const content =
                segment.querySelector(".segment-text")?.textContent?.trim() ||
                "";
              if (timestamp && content) {
                text += `${timestamp} ${content}\n`;
              }
            });

            if (!text.trim()) {
              throw new Error("文字起こしの内容が空です");
            }

            return text;
          } catch (error) {
            throw error;
          }
        },
      });

      if (result && result[0] && result[0].result) {
        const finalText = promptTemplate.value + "\n\n" + result[0].result;
        await navigator.clipboard.writeText(finalText);
        showAlert("コピーしました！");
      } else {
        showAlert("エラー: 文字起こしの取得に失敗しました", false);
      }
    } catch (error) {
      showAlert("エラー: " + error.message, false);
    } finally {
      loadingIndicator.style.display = "none"; // ローディング終了
    }
  });

  // 起動時にテキストエリアにフォーカス
  promptTemplate.focus();
});
