chrome.action.onClicked.addListener((tab) => {
  if (!tab.url || tab.url.startsWith('chrome://')) return;
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).catch(err => console.error('Failed to inject script:', err));
});
