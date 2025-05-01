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

  // プロンプトを読み込んでセレクトに追加
  loadPrompts()
    .then((prompts) => {
      templateSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "プロンプト選択";
      templateSelect.appendChild(placeholder);
      prompts.forEach((p) => {
        const option = document.createElement("option");
        option.value = p.text;
        option.textContent = p.name;
        templateSelect.appendChild(option);
      });
    })
    .catch((err) => console.error("Failed to load prompts:", err));

  // プロンプト選択時の処理
  templateSelect.addEventListener("change", () => {
    if (templateSelect.value === "") {
      promptTemplate.value = "";
      promptTemplate.focus();
    } else {
      promptTemplate.value = templateSelect.value;
      chrome.storage.local.set({ promptTemplate: templateSelect.value });
    }
  });

  // プロンプトをローカルストレージから読み込む
  chrome.storage.local.get(["promptTemplate"], (result) => {
    if (result.promptTemplate) {
      promptTemplate.value = result.promptTemplate;
    }
  });

  // プロンプトの変更を保存
  promptTemplate.addEventListener("input", () => {
    chrome.storage.local.set({ promptTemplate: promptTemplate.value });
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
