const STORAGE_KEY = 'startdock';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'startdock-add',
    title: 'Add to StartDock',
    contexts: ['page', 'link'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'startdock-add') return;
  const url   = encodeURIComponent(info.linkUrl || info.pageUrl || '');
  const title = encodeURIComponent(tab?.title || '');
  chrome.tabs.create({
    url: chrome.runtime.getURL(`options.html?add=1&url=${url}&title=${title}`),
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});
