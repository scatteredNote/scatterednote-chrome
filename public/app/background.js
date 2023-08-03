// Called when the user clicks on the browser action
chrome.action.onClicked.addListener(async function (tab) {
  try {
    // Send a message to the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, {
      message: "clicked_browser_action",
    });
  } catch (error) {
    console.error("Error sending message:", error);
  }
});

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  if (request.message === "save_data") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const url = tabs[0].url;
      const tabId = tabs[0].id;

      if (url !== JSON.parse(request.data).url) {
        const rdata = JSON.parse(request.data);
        const index = `tab:${request.data.url}`;
        const data = await chrome.storage.sync.get([index]);
        if (data[index]) {
          chrome.storage.sync.set({ [rdata.url]: rdata });
          chrome.tabs.sendMessage(data[index], {
            message: "clicked_browser_action",
          });
          // call login state to fetch login data
          await get_login_state(data[index], rdata);
        }
      } else {
        const data = JSON.parse(request.data);
        chrome.storage.sync.set({ [url]: data });
        chrome.tabs.sendMessage(tabId, {
          message: "clicked_browser_action",
        });
        // call login state to fetch login data
        await get_login_state(tabId, data);
      }
    }
  }
  else if (request.message === "save_tab_id") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = `tab:${JSON.parse(request.data).url}`;
    chrome.storage.sync.set({
      [data]: tabs[0].id,
    });
  }
  else if (request.message === "get_login_state") {
    await get_login_state();
  }
  else if (request.message === "login_data") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      const response = await fetch('https://www.scatterednote.com/api/session/?chrome=true');
      const data = await response.json();
      chrome.storage.sync.set({ "user-scatterednote": JSON.stringify({ username: data.username, accessToken: data.accessToken }) });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          message: "login",
          status: "success",
          data: data,
        });
      }
    } catch (err) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          message: "login",
          status: "fail",
          data: null,
        });
      }
    }
  }
  else if (request.message === "youtube") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: "youtube_data",
        data: request.data,
      });
    }
  }
  else if (request.message === "PLAY_b") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: "PLAY",
        data: request.data,
      });
    }
  }
});

async function get_login_state(tabId, tabdata) {
  const data = await chrome.storage.sync.get(["user-scatterednote"]);
  if (data["user-scatterednote"]) {
    const scatterData = data["user-scatterednote"];
    if (!tabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const url = tabs[0].url;
        const id = tabs[0].id;
        const tabData = await chrome.storage.sync.get([url]);
        if (tabData[url]) {
          chrome.tabs.sendMessage(id, {
            message: "set_login_state", data: {
              userData: JSON.parse(scatterData),
              noteData: tabData[url],
            },
          });
        } else {
          chrome.tabs.sendMessage(id, {
            message: "set_login_state", data: {
              userData: JSON.parse(scatterData),
              noteData: null,
            },
          });
        }
      }
    } else {
      chrome.tabs.sendMessage(tabId, {
        message: "set_login_state", data: {
          userData: JSON.parse(scatterData),
          noteData: tabdata,
        },
      });
    }
  }
}
