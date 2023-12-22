const input = document.body.querySelector("#checkbox");
input.addEventListener("change", (e) => {
  setValue(e.target.checked);
});

async function setValue(value) {
  await browser.storage.local.set({ tlWhichQuerydebugEnabled: value });
}

async function init() {
  let { tlWhichQuerydebugEnabled } = await browser.storage.local.get(
    "tlWhichQuerydebugEnabled"
  );
  if (typeof tlWhichQuerydebugEnabled !== "boolean") {
    tlWhichQuerydebugEnabled = false;
    setValue(tlWhichQuerydebugEnabled);
  }

  input.checked = tlWhichQuerydebugEnabled;
}

init().catch((e) => console.error(e));
