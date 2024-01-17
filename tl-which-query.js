browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "tlWhichQuerydebugEnabled" in changes) {
    window.tlWhichQuerydebugEnabled = changes.tlWhichQuerydebugEnabled.newValue;
  }
});

browser.storage.local.get("tlWhichQuerydebugEnabled").then((store) => {
  const value = store.tlWhichQuerydebugEnabled;
  if (typeof value === "boolean") {
    window.tlWhichQuerydebugEnabled = value;
  }
});

async function getSuggestionFor(element, variant, debug) {
  if (debug === undefined) {
    debug = window.tlWhichQuerydebugEnabled;
  }

  const CLOSEST_SELECTOR = [
    "input:not([disabled])",
    "button:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([disabled])",
    "[role]",
  ].join(", ");

  if (debug) {
    element.style.cssText += "color:yellow; background-color:green;";
  }

  try {
    const elementToResolve = element.closest(CLOSEST_SELECTOR) || element;
    const suggestion = findSuggestedQuery(elementToResolve, variant, debug);
    if (suggestion) {
      navigator.clipboard.writeText(suggestion);
      console.info(suggestion);
    } else {
      console.info("No suggestion found");
    }
    return suggestion;
  } catch (e) {
    console.error(e);
  }
}

function findSuggestedQuery(element, variant, debug) {
  // we try to find a unique selector for the whole document
  const suggestionElement = getSuggestedQuery(document.body, element, variant);
  if (suggestionElement) {
    return "screen." + suggestionElement;
  }

  // we try to find a unique selector for a parent
  const suggestionParent = getUniqueParent(element, variant, debug);
  if (!suggestionParent) {
    return;
  }

  const parent = suggestionParent[0];
  const within = suggestionParent[1];
  const stackParents = suggestionParent[2];
  const suggestionElement2 = getSuggestedQuery(parent, element, "getBy");
  if (suggestionElement2) {
    return within + "\n." + suggestionElement2;
  }

  let pinnedParent = parent;
  let elParent = parent;
  const middleSelectors = Array.from(stackParents).reduce((acc, el) => {
    const res = getSuggestedQuery(elParent, el, variant);
    elParent = el;
    if (res) {
      // we only want non-unique parents
      return acc;
    }

    const elRole = byRole(el, variant, document.body);
    if (!elRole) {
      return acc;
    }

    if (debug) {
      el.style.cssText += "color:aquamarine; background-color:green;";
    }

    const children = el.parentElement.querySelectorAll(`:scope > ${elRole}`);
    const index = Array.from(children).findIndex((child) => child === el);
    acc.push(`getAllByRole('${elRole}')[${index}]`);
    pinnedParent = el;
    return acc;
  }, []);

  const path = getWithinEncapsulation(within, middleSelectors);

  const suggestionElement3 = getSuggestedQuery(pinnedParent, element, "getBy");
  if (suggestionElement3) {
    return path + "\n." + suggestionElement3;
  }

  const suggestionElement4 = getSuggestedQuery(
    pinnedParent,
    element,
    "getAllBy",
    true
  );
  if (!suggestionElement4) {
    return path;
  }

  return path + "\n." + suggestionElement4;
}

/**
 * It finds the unique parent
 * @returns [parent, within, stackParents]
 */
function getUniqueParent(element, variant, debug) {
  const stackParents = [];
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const suggestionParent = getSuggestedQuery(document.body, parent, variant);
    if (suggestionParent) {
      if (debug) {
        parent.style.cssText += "color:aqua; background-color:blue;";
      }
      return [parent, `within( screen.${suggestionParent} )`, stackParents];
    }

    stackParents.unshift(parent);
    if (debug) {
      parent.style.cssText += "color:orange; background-color:red;";
    }
  }
}

/**
 * It tries to find a selector
 * @returns selector | undefined
 */
function getSuggestedQuery(root, element, variant, withIndex) {
  const suggestionRole = byRole(element, variant, root, withIndex);
  if (suggestionRole) {
    return suggestionRole;
  }

  const suggestionLabelText = byLabelText(element, variant, root, withIndex);
  if (suggestionLabelText) {
    return suggestionLabelText;
  }

  const suggestionPlaceholderText = byPlaceholderText(
    element,
    variant,
    root,
    withIndex
  );
  if (suggestionPlaceholderText) {
    return suggestionPlaceholderText;
  }

  const suggestionText = byText(element, variant, root, withIndex);
  if (suggestionText) {
    return suggestionText;
  }

  const suggestionDisplayValue = byDisplayValue(
    element,
    variant,
    root,
    withIndex
  );
  if (suggestionDisplayValue) {
    return suggestionDisplayValue;
  }

  const suggestionAltText = byAltText(element, variant, root, withIndex);
  if (suggestionAltText) {
    return suggestionAltText;
  }

  const suggestionTitle = byTitle(element, variant, root, withIndex);
  if (suggestionTitle) {
    return suggestionTitle;
  }

  const suggestionTestId = byTestId(element, variant, root, withIndex);
  if (suggestionTestId) {
    return suggestionTestId;
  }

  // FIXME querySelector?

  return undefined;
}

/**
 * This can be used to query every element that is exposed in the accessibility tree.
 * With the name option you can filter the returned elements by their accessible name.
 * This should be your top preference for just about everything.
 * There's not much you can't get with this (if you can't, it's possible your UI is inaccessible).
 * Most often, this will be used with the name option like so: getByRole('button', {name: /submit/i}).
 * Check the list of roles.
 */
function byRole(element, variant, root, withIndex) {
  const role = getElementRole(element);
  if (!role) {
    return;
  }
  if (role === "generic") {
    return;
  }

  const name = element.textContent;
  const roleName = name ? `, {name: '${name}'}` : "";

  if (withIndex) {
    const index = getRoleIndex(root, role, name, element);
    if (index < 0) {
      return;
    }

    return `${variant}Role('${role}'${roleName})[${index}]`;
  }

  if (role === 'row') {
    const index = getRoleIndex(root, role, undefined, element);
    if (index >= 0) {
      const newVariant = variant.indexOf('All') > 0 ? variant : variant.replace('By', 'AllBy');
      return `${newVariant}Role('${role}')[${index}]`;
    }
  }

  if (isRoleUnique(root, role, name)) {
    return `${variant}Role('${role}'${roleName})`;
  }
}

/**
 * This method is really good for form fields.
 * When navigating through a website form, users find elements using label text.
 * This method emulates that behavior, so it should be your top preference.
 */
function byLabelText(element, variant, root, withIndex) {
  const id = element.id;
  if (!id) {
    return;
  }

  const labels = element.labels;
  if (!labels || labels.length === 0) {
    return;
  }

  // we find the first one which is a single match
  const labelsText = Array.from(labels).map((label) => label.textContent);

  if (withIndex) {
    const [labelText, index] = getLabelTextIndex(root, labelsText);
    if (index < 0) {
      return;
    }

    return `${variant}LabelText('${labelText}')[${index}]`;
  }

  const labelText = getUniqueLabelText(root, labelsText);
  if (!labelText) {
    return;
  }

  return `${variant}LabelText('${labelText}')`;
}

/**
 * A placeholder is not a substitute for a label.
 * But if that's all you have, then it's better than alternatives.
 */
function byPlaceholderText(element, variant, root, withIndex) {
  const placeholder = element.getAttribute("placeholder");
  if (!placeholder) {
    return;
  }

  const selector = `[placeholder="${placeholder}"]`;

  if (withIndex) {
    const index = getIndexBySelector(element, root, selector);
    if (index < 0) {
      return;
    }

    return `${variant}PlaceholderText('${placeholder}')[${index}]`;
  }

  if (isSelectorUnique(root, element, selector)) {
    return `${variant}PlaceholderText('${placeholder}')`;
  }
}

/**
 * Outside of forms, text content is the main way users find elements.
 * This method can be used to find non-interactive elements (like divs, spans, and paragraphs).
 */
function byText(element, variant, root, withIndex) {
  const text = element.innerText || element.textContent;
  if (!text) {
    return;
  }

  /* we only want texts in one line */
  const reEOL = /\n/;
  if (reEOL.test(text)) {
    return;
  }

  if (withIndex) {
    const index = getTextIndex(root, text, element);
    if (index < 0) {
      return;
    }

    return `${variant}Text('${text}')[${index}]`;
  }

  if (!isTextUnique(root, text)) {
    return;
  }

  return `${variant}Text('${text}')`;
}

/**
 * The current value of a input, textarea, or select element can be useful when navigating a page with filled-in values.
 */
function byDisplayValue(element, variant, root, withIndex) {
  const value = element.value;
  if (!value) {
    return;
  }

  if (withIndex) {
    const index = getDisplayValueIndex(root, selector, element);
    if (index < 0) {
      return;
    }

    return `${variant}DisplayValue('${value}')[${index}]`;
  }

  if (isDisplayValueUnique(root, value)) {
    return `${variant}DisplayValue('${value}')`;
  }
}

/**
 * If your element is one which supports alt text (img, area, input, and any custom element), then you can use this to find that element.
 */
function byAltText(element, variant, root, withIndex) {
  const alt = element.getAttribute("alt");
  if (!alt) {
    return;
  }

  const selector = `[alt="${alt}"]`;

  if (withIndex) {
    const index = getIndexBySelector(element, root, selector);
    if (index < 0) {
      return;
    }

    return `${variant}AltText('${alt}')[${index}]`;
  }

  if (isSelectorUnique(root, element, selector)) {
    return `${variant}AltText('${alt}')`;
  }
}

/**
 * The title attribute is not consistently read by screenreaders, and is not visible by default for sighted users
 */
function byTitle(element, variant, root, withIndex) {
  const title = element.getAttribute("title");
  if (!title) {
    return;
  }

  const selector = `[title="${title}"]`;

  if (withIndex) {
    const index = getIndexBySelector(element, root, selector);
    if (index < 0) {
      return;
    }

    return `${variant}Title('${title}')[${index}]`;
  }

  if (isSelectorUnique(root, element, selector)) {
    return `${variant}Title('${title}')`;
  }
}

/**
 * The user cannot see (or hear) these, so this is only recommended for cases where you can't match by role or text or it doesn't make sense (e.g. the text is dynamic).
 */
function byTestId(element, variant, root, withIndex) {
  const testId = element.dataset.testid;
  if (!testId) {
    return;
  }

  const selector = `[data-testid="${testId}"]`;

  if (withIndex) {
    const index = getIndexBySelector(element, root, selector);
    if (index < 0) {
      return;
    }

    return `${variant}PlaceholderText('${placeholder}')[${index}]`;
  }

  if (isSelectorUnique(root, element, selector)) {
    return `${variant}TestId('${testId}')`;
  }
}

function byQuerySelector(element, variant, root, withIndex) {
  // FIXME to be implemented
}

/**
 * It finds the index of elements by a selector
 * @returns number
 */
function getIndexBySelector(element, root, selector) {
  const nodes = root.querySelectorAll(selector);
  return Array.from(nodes).findIndex((el) => el === element);
}

/**
 * It checks if the selector finds only our element
 * @returns boolean
 */
function isSelectorUnique(root, element, selector) {
  const nodes = root.querySelectorAll(selector);
  if (nodes.length !== 1) {
    return false;
  }

  return nodes.item(0) === element;
}

function getElementRole(element) {
  return element.getAttribute("role") || getImplicitAriaRoles(element);
}

// https://www.w3.org/TR/html-aria/#docconformance
function getImplicitAriaRoles(element) {
  const tag = element.tagName;
  switch (tag) {
    case "A":
      const hrefA = element.getAttribute("href");
      return hrefA ? "link" : "generic";
    case "ADDRESS":
      return "group";
    case "AREA":
      const hrefArea = element.getAttribute("href");
      return hrefArea ? "link" : "generic";
    case "ARTICLE":
      return "article";
    case "ASIDE":
      return "complementary";
    case "B":
      return "generic";
    case "BDI":
      return "generic";
    case "BDO":
      return "generic";
    case "BLOCKQUOTE":
      return "blockquote";
    case "BODY":
      return "generic";
    case "BUTTON":
      return "button";
    case "CAPTION":
      return "caption";
    case "CODE":
      return "code";
    case "DATA":
      return "generic";
    case "DATALIST":
      return "listbox";
    case "DEL":
      return "deletion";
    case "DETAILS":
      return "group";
    case "DFN":
      return "term";
    case "DIALOG":
      return "dialog";
    case "DIV":
      return "generic";
    case "EM":
      return "emphasis";
    case "FIELDSET":
      return "group";
    case "FIGURE":
      return "figure";
    case "FOOTER":
      return "generic";
    case "FORM":
      return "form";
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6":
      return "heading";
    case "HEADER":
      return "generic";
    case "HGROUP":
      return "group";
    case "HR":
      return "separator";
    case "HTML":
      return "document";
    case "I":
      return "generic";
    case "IMG":
      const altImg = element.getAttribute("alt");
      return altImg ? "img" : "presentation";
    case "INPUT":
      return getImplicitAriaRolesInput(element);
    case "INS":
      return "insertion";
    case "LI":
      return "listitem";
    case "MAIN":
      return "main";
    case "MATH":
      return "math";
    case "MENU":
      return "list";
    case "METER":
      return "meter";
    case "NAV":
      return "navigation";
    case "OL":
      return "list";
    case "OPTGROUP":
      return "group";
    case "OPTION":
      return "option";
    case "OUTPUT":
      return "status";
    case "P":
      return "paragraph";
    case "PRE":
      return "generic";
    case "PROGRESS":
      return "progressbar";
    case "Q":
      return "generic";
    case "S":
      return "deletion";
    case "SAMP":
      return "generic";
    case "SEARCH":
      return "search";
    case "SECTION":
      return "region";
    case "SELECT ":
      return getImplicitAriaRolesSelect(element);
    case "SMALL":
      return "generic";
    case "SPAN":
      return "generic";
    case "STRONG":
      return "strong";
    case "SUB":
      return "subscript";
    case "SUP":
      return "superscript";
    case "TABLE":
      return "table";
    case "TBODY":
      return "rowgroup";
    case "TD":
      return getImplicitAriaRolesTd(element);
    case "TEXTAREA":
      return "textbox";
    case "TFOOT":
      return "rowgroup";
    case "TH":
      return getImplicitAriaRolesTh(element);
    case "THEAD":
      return "rowgroup";
    case "TIME":
      return "time";
    case "TR":
      return "row";
    case "U":
      return "generic";
    case "UL":
      return "list";
  }
}

function getImplicitAriaRolesInput(element) {
  const type = element.getAttribute("type");
  switch (type) {
    case undefined:
      const listImpliciteText = element.getAttribute("list");
      return listImpliciteText ? "combobox" : "textbox";
    case "button":
      return "button";
    case "checkbox":
      return "checkbox";
    case "email":
      const listEmail = element.getAttribute("list");
      return listEmail ? "combobox" : "textbox";
    case "image":
      return "button";
    case "number":
      return "spinbutton";
    case "radio":
      return "radio";
    case "range":
      return "slider";
    case "reset":
      return "button";
    case "search":
      const listSearch = element.getAttribute("list");
      return listSearch ? "combobox" : "searchbox";
    case "submit":
      return "button";
    case "tel":
      const listTel = element.getAttribute("list");
      return listTel ? "combobox" : "textbox";
    case "text":
      const listText = element.getAttribute("list");
      return listText ? "combobox" : "textbox";
    case "url":
      const listUrl = element.getAttribute("list");
      return listUrl ? "combobox" : "textbox";
  }
}

function getImplicitAriaRolesSelect(element) {
  const multiple = element.getAttribute("multiple");
  const size = element.getAttribute("size");
  if (!multiple && (!size || parseInt(size) <= 1)) {
    return "combobox";
  }
  if (multiple || (size && parseInt(size) > 1)) {
    return "listbox";
  }
}

function getImplicitAriaRolesTd(element) {
  const table = element.closest("table");
  if (!table) {
    return;
  }

  const roleTable = table.getAttribute("role");
  switch (roleTable) {
    case null:
    case "table":
      return "cell";
    case "grid":
    case "treegrid":
      return "gridcell";
  }
}

function getImplicitAriaRolesTh(element) {
  return getImplicitAriaRolesTd(element);
}

/**
 * It findthe index of a element by role
 * @returns number
 */
function getRoleIndex(root, role, name, element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

  let node;
  let index = -1;
  while ((node = walker.nextNode())) {
    if (getElementRole(node) === role && (!name || node.textContent === name)) {
      index++;
    }
    if (node === element) {
      return index;
    }
  }
  return -1;
}

function isRoleUnique(root, role, name) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

  let node;
  let counter = 0;
  while ((node = walker.nextNode())) {
    if (getElementRole(node) === role && node.textContent === name) {
      counter++;
    }
    if (counter === 2) {
      return false;
    }
  }
  return true;
}

/**
 * It find the index of a text node
 * @returns number
 */
function getTextIndex(root, text, element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  let node;
  let index = -1;
  while ((node = walker.nextNode())) {
    if (node.nodeValue === text) {
      index++;
    }
    if (node === element) {
      return index;
    }
  }
  return -1;
}

function isTextUnique(root, text) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  let node;
  let counter = 0;
  while ((node = walker.nextNode())) {
    if (node.nodeValue === text) {
      counter++;
    }
    if (counter === 2) {
      return false;
    }
  }
  return true;
}

/**
 * It find a label and its index
 * @returns [label, index]
 */
function getLabelTextIndex(root, labelsText) {
  let index = -1;
  const labelText = labelsText.find((labelText) => {
    const elements = Array.from(root.getElementsByTagName("label"));
    const labelIndex = elements.findIndex((el) => el.textContent === labelText);
    if (labelIndex < 0) {
      return false;
    }

    index = labelIndex;
    return true;
  });
  return [labelText, index];
}

/**
 * It find a unique label
 * @returns string | undefined
 */
function getUniqueLabelText(root, labelsText) {
  const labelText = labelsText.filter((labelText) => {
    const elements = Array.from(root.getElementsByTagName("label"));
    return elements.filter((el) => el.textContent === labelText).length === 1;
  });
  return labelText[0];
}

/**
 * It returns the index of first form field matching a value
 * @returns number
 */
function getDisplayValueIndex(root, value, element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

  let node;
  let index = -1;
  while ((node = walker.nextNode())) {
    if (isFormField(node) && node.value === value) {
      index++;
    }
    if (node === element) {
      return index;
    }
  }
  return -1;
}

function isFormField(node) {
  const tag = node.tagName;
  switch (tag) {
    case "INPUT":
    case "TEXTAREA":
    case "SELECT":
      return true;
    default:
      return false;
  }
}

/**
 * It check if the display value is unique
 * @returns boolean
 */
function isDisplayValueUnique(root, value) {
  // we check if there is only one form element with this value
  let elements = Array.from(root.getElementsByTagName("input"));
  const countInput = elements.filter((el) => el.value === value).length;
  elements = Array.from(root.getElementsByTagName("textarea"));
  const countTextarea = elements.filter((el) => el.value === value).length;
  elements = Array.from(root.getElementsByTagName("select"));
  const countSelect = elements.filter((el) => el.value === value).length;
  // elements = Array.from(root.getElementsByTagName("option"));
  // const countOption = elements.filter((el) => el.value === value).length;

  return countInput + countTextarea + countSelect === 1;
}

/**
 * It encapsulate the within in within
 * @returns string
 */
function getWithinEncapsulation(within, middleSelectors) {
  if (middleSelectors.length === 0) {
    return within;
  }

  let encapsulation = within;
  middleSelectors.forEach((selector) => {
    encapsulation = `within( ${encapsulation}\n.${selector} )`;
  });
  return encapsulation;
}