// デバッグ用のログ出力を追加
console.log("popup.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded");
  const button = document.getElementById("copyTranscript");
  const promptTemplate = document.getElementById("promptTemplate");
  const templateSelect = document.getElementById("templateSelect");
  const alertElement = document.getElementById("customAlert");
  const alertMessageElement = document.getElementById("alertMessage");
  const container = document.querySelector(".container");
  const loadingIndicator = document.querySelector(".loading-indicator");

  const title = document.querySelector(".title");
  const select = document.querySelector("#templateSelect");
  const textarea = document.querySelector("#promptTemplate");

  // テンプレート選択時の処理を追加
  templateSelect.addEventListener("change", () => {
    if (templateSelect.value === "") {
      promptTemplate.value = ""; // Clear the textarea for Custom
      promptTemplate.focus();
    } else {
      promptTemplate.value = templateSelect.value;
      chrome.storage.local.set({ promptTemplate: templateSelect.value });
    }
    // Add visual cue for the selected option
    templateSelect.classList.add("selected-template");
    setTimeout(() => {
      templateSelect.classList.remove("selected-template");
    }, 300);
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
  function showCustomAlert(message, isSuccess = true) {
    alertMessageElement.textContent = message;
    alertElement.classList.add("show");
    if (isSuccess) {
      // グリッチエフェクトを適用
      title.classList.add("glitch-text");
      select.classList.add("glitch-text");
      textarea.classList.add("glitch-text");
      button.classList.add("glitch-text");

      setTimeout(() => {
        title.classList.remove("glitch-text");
        select.classList.remove("glitch-text");
        textarea.classList.remove("glitch-text");
        button.classList.remove("glitch-text");
        window.close();
      }, 800);
    }
    // エラー時はアラートを自動で消去
    if (!isSuccess) {
      setTimeout(() => {
        alertElement.classList.remove("show");
      }, 1300);
    }
  }

  button.addEventListener("click", async () => {
    console.log("Button clicked");
    loadingIndicator.style.display = "block"; // ローディング開始
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        showCustomAlert("ERROR: No active tab", false);
        return;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            console.log("スクリプト実行開始");

            // 文字起こしボタンを探して自動クリック
            const transcriptButton =
              document.querySelector('button[aria-label="文字起こしを表示"]') ||
              document.querySelector('button[aria-label="字幕を表示"]') ||
              document.querySelector('button[aria-label="Show transcript"]');

            if (!transcriptButton) {
              throw new Error("Transcript button not found");
            }

            console.log("文字起こしボタン発見");
            transcriptButton.click();

            // Wait for the transcript panel to open using an interval
            await new Promise((resolve, reject) => {
              const intervalId = setInterval(() => {
                if (document.querySelector("ytd-transcript-segment-renderer")) {
                  clearInterval(intervalId);
                  resolve();
                }
              }, 100);

              // Timeout after 5 seconds
              setTimeout(() => {
                clearInterval(intervalId);
                reject(new Error("Timeout: Transcript panel did not open"));
              }, 5000);
            });

            // 文字起こしセグメントの取得
            const segments = document.querySelectorAll(
              "ytd-transcript-segment-renderer"
            );
            console.log("Found segments:", segments.length);

            if (segments.length === 0) {
              throw new Error("No transcript found");
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
              throw new Error("Transcript content is empty");
            }

            return text;
          } catch (error) {
            console.error("Content script error:", error);
            throw error;
          }
        },
      });

      if (result && result[0] && result[0].result) {
        const finalText = promptTemplate.value + result[0].result;
        await navigator.clipboard.writeText(finalText);
        showCustomAlert("COPY THAT!!");
      } else {
        showCustomAlert("ERROR: Failed to retrieve transcript", false);
      }
    } catch (error) {
      console.error("Error:", error);
      showCustomAlert("ERROR: " + error.message, false);
    } finally {
      loadingIndicator.style.display = "none"; // ローディング終了
    }
  });
  // Auto focus the textarea on load
  promptTemplate.focus();
});
