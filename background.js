if (typeof browser == "undefined") {
  // Chrome does not support the browser namespace yet.
  globalThis.browser = chrome;
}

browser.runtime.onInstalled.addListener(() => {
  function onCreated() {
    if (browser.runtime.lastError) {
      console.info(`Error: ${browser.runtime.lastError}`);
    } else {
      // console.info("Item created successfully");
    }
  }

  /* All context menu items */
  browser.menus.create(
    {
      id: "getBy",
      title: "getBy",
      contexts: ["all"],
    },
    onCreated
  );

  browser.menus.create(
    {
      id: "queryBy",
      title: "queryBy",
      contexts: ["all"],
    },
    onCreated
  );

  browser.menus.create(
    {
      id: "findBy",
      title: "findBy",
      contexts: ["all"],
    },
    onCreated
  );

  browser.menus.create(
    {
      id: "separator-1",
      type: "separator",
      contexts: ["all"],
    },
    onCreated
  );

  browser.menus.create(
    {
      id: "getAllBy",
      title: "getAllBy",
      contexts: ["all"],
    },
    onCreated
  );

  browser.menus.create(
    {
      id: "queryAllBy",
      title: "queryAllBy",
      contexts: ["all"],
    },
    onCreated
  );

  browser.menus.create(
    {
      id: "findAllBy",
      title: "findAllBy",
      contexts: ["all"],
    },
    onCreated
  );

  /* The click event listener:
     we perform the appropriate action given the ID of the menu item that was clicked */
  browser.menus.onClicked.addListener(async (info, tab) => {
    await browser.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      code: `el = browser.menus.getTargetElement(${info.targetElementId}); getSuggestionFor(el, '${info.menuItemId}');`,
    });
  });
});
