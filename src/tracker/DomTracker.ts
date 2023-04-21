import {
  isTracker,
  isTrigger,
  TrackingHost,
  TrackEvent,
  TriggerEvent,
  TRACK,
  TRIGGER,
  JSONDict,
} from "./TrackerType";

export function attributeName(key: string) {
  return `data-tr-${key}`;
}

const PARAMS_KEY = attributeName("params");
const TRACKERS_KEY = attributeName("trackers");
const TRIGGERS_KEY = attributeName("triggers");
const TRACKERS_EVENT_DELIMITER = " ";
const TRACKERS_DELIMITER = "||";
const TRIGGERS_EVENT_DELIMITER = " ";
const TRIGGERS_DELIMITER = "||";

type DomTracker = TrackingHost<HTMLElement>;

function parse<T = {}>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (e) {
    return undefined;
  }
}
/*
Sorts object props so the order is the same regardless of declaration order
This is important because we are using a MutationObserver to listen to attribute changes which would be triggered if the same props were attached to the dom in a different order
*/
function deepStableObj<T extends any>(val: T): T {
  if (Array.isArray(val)) {
    return val.map(deepStableObj) as T;
  }

  if (typeof val === "object" && val !== null) {
    const keys = Object.keys(val);
    keys.sort();
    const result = {} as T;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      // @ts-ignore
      result[key] = deepStableObj(val[key]);
    }

    return result;
  }

  return val;
}

function serializeParams(obj: JSONDict) {
  return JSON.stringify(deepStableObj(obj));
}

function elPath(element: HTMLElement) {
  let path = element.tagName.toLowerCase();
  let target = element.parentElement;

  while (target && target !== document.documentElement) {
    path = `${target.tagName.toLowerCase()} > `;
    target = target.parentElement;
  }

  return path;
}
function queryForElements(root: HTMLElement, query: string) {
  const elements: HTMLElement[] = [];

  if (root.matches(query)) {
    elements.push(root);
  }

  elements.push(...root.querySelectorAll<HTMLElement>(query));

  return elements;
}
function isInput(element: HTMLElement | null): element is HTMLInputElement {
  return Boolean(element && element.tagName === "INPUT");
}
function elementValue(element: HTMLElement | null) {
  if (isInput(element)) {
    if (element.type === "checkbox") {
      return element.checked ? element.value : false;
    }
    return element.value;
  }

  return null;
}

export const getTrackers: DomTracker["getTrackers"] = (element) => {
  const attr = element.getAttribute(TRACKERS_KEY);

  if (!attr) return undefined;

  const trackers: TrackEvent[] = [];

  for (let trackerAttr of attr.split(TRACKERS_DELIMITER)) {
    const tracker = [TRACK, ...trackerAttr.split(TRACKERS_EVENT_DELIMITER)];

    if (tracker[4]) {
      tracker[4] = parse<{}>(tracker[4]) as any;
    }

    if (isTracker(tracker)) {
      trackers.push(tracker);
    } else {
      console.warn(
        "Non tracker attribute given to element at",
        elPath(element),
        element
      );
    }
  }

  return trackers;
};
export const getTriggers: DomTracker["getTriggers"] = (element) => {
  const attr = element.getAttribute(TRIGGERS_KEY);

  if (!attr) return undefined;

  const triggers: TriggerEvent[] = [];

  for (let triggerAttr of attr.split(TRIGGERS_DELIMITER)) {
    const trigger = [TRIGGER, ...triggerAttr.split(TRIGGERS_EVENT_DELIMITER)];

    if (trigger[4]) {
      trigger[4] = parse<{}>(trigger[4]) as any;
    }

    if (isTrigger(trigger)) {
      triggers.push(trigger);
    } else {
      console.warn("Non trigger attribute give to element at", elPath(element));
    }
  }

  return triggers;
};
export const getParams: DomTracker["getParams"] = (element) => {
  return parse(element.getAttribute(PARAMS_KEY));
};
export const getParamElements: DomTracker["getParamElements"] = (root) => {
  return queryForElements(root, `[${PARAMS_KEY}]`);
};
export const getTrackerElements: DomTracker["getTrackerElements"] = (root) => {
  return queryForElements(root, `[${TRACKERS_KEY}]`);
};
export const getTriggerElements: DomTracker["getTriggerElements"] = (root) => {
  return queryForElements(root, `[${TRIGGERS_KEY}]`);
};
export const getEventTargetElement: DomTracker["getEventTargetElement"] = (
  element,
  selector
) => {
  if (!selector) return element;
  let sel = selector;

  switch (sel.charAt(0)) {
    case ">":
    case "+":
    case "~":
      sel = `:scope ${sel}`;
      break;
  }
  return element.querySelector(sel) || element;
};
export const isParentOf: DomTracker["isParentOf"] = (parent, child) => {
  return parent.contains(child);
};
export const getParent: DomTracker["getParent"] = (child) => {
  return child.parentElement;
};
export const getUserPreferencesEnabled: DomTracker["getUserPreferencesEnabled"] =
  () => {
    if (window.navigator.doNotTrack && !localStorage.pleaseTrack) {
      console.log(
        "doNotTrack detected, not tracking add `localStorage.pleaseTrack = true` to continue tracking"
      );
      return false;
    }
    return true;
  };
export const connect: DomTracker["connect"] = (
  root,
  onAdded,
  onChanged,
  onRemoved
) => {
  let mo = new MutationObserver((entries) => {
    for (let entry of entries) {
      if (entry.type === "childList") {
        for (let element of entry.removedNodes) {
          onRemoved(element as HTMLElement);
        }

        if (entry.addedNodes) {
          for (let element of entry.addedNodes) {
            onAdded(element as HTMLElement);
          }
        }
      }
      if (entry.type === "attributes") {
        onChanged(entry.target as HTMLElement, entry.attributeName);
      }
    }
  });

  mo.observe(root, {
    childList: true,
    subtree: true,
    attributeFilter: [PARAMS_KEY, TRACKERS_KEY, TRIGGERS_KEY],
  });

  onAdded(root);

  return () => {
    mo.disconnect();
  };
};

export const getTrackerElementProps: DomTracker["getTrackerElementProps"] = (
  config
) => {
  let trackers: string[] = [];

  for (let tracker of config.track) {
    const [_type, domEvent, analyticsEvent, targetSelector, params] = tracker;

    if (targetSelector?.includes(TRACKERS_DELIMITER)) {
      throw new Error(`Tracker selector can't contain '${TRACKERS_DELIMITER}'`);
    }

    let trackerAttr: string = `${domEvent}`;

    if (analyticsEvent) {
      trackerAttr += `${TRACKERS_EVENT_DELIMITER}${analyticsEvent}`;
    } else if (targetSelector || params) {
      trackerAttr += TRACKERS_EVENT_DELIMITER;
    }

    if (targetSelector) {
      trackerAttr += `${TRACKERS_EVENT_DELIMITER}${targetSelector.replaceAll(
        TRACKERS_EVENT_DELIMITER,
        ""
      )}`;
    } else if (params) {
      trackerAttr += TRACKERS_EVENT_DELIMITER;
    }

    if (params) {
      trackerAttr += `${TRACKERS_EVENT_DELIMITER}${serializeParams(params)}`;
    }

    trackers.push(trackerAttr);
  }

  const result = {
    [TRACKERS_KEY]: trackers.sort().join(TRACKERS_DELIMITER),
  };

  if (config.params) {
    Object.assign(result, getParamElementProps(config.params));
  }

  return result;
};
export const getParamElementProps: DomTracker["getParamElementProps"] = (
  params
) => {
  return {
    [PARAMS_KEY]: serializeParams(params),
  };
};
export const getTriggerElementProps: DomTracker["getTriggerElementProps"] = (
  triggers
) => {
  let triggerAttrs: string[] = [];

  for (let [
    _type,
    domEvent,
    analyticsEvent,
    targetSelector,
    params,
  ] of triggers) {
    let triggerAttr = `${domEvent}`;

    if (analyticsEvent) {
      triggerAttr += `${TRIGGERS_EVENT_DELIMITER}${analyticsEvent}`;
    } else if (params || targetSelector) {
      triggerAttr += `${TRIGGERS_EVENT_DELIMITER}`;
    }

    if (targetSelector) {
      triggerAttr += `${TRIGGERS_EVENT_DELIMITER}${targetSelector.replaceAll(
        TRIGGERS_EVENT_DELIMITER,
        ""
      )}`;
    } else {
      triggerAttr += `${TRIGGERS_EVENT_DELIMITER}`;
    }

    if (params) {
      triggerAttr += `${TRIGGERS_EVENT_DELIMITER}${serializeParams(params)}`;
    }

    triggerAttrs.push(triggerAttr);
  }

  return {
    [TRIGGERS_KEY]: triggerAttrs.sort().join(TRIGGERS_DELIMITER),
  };
};

export const attachListener: DomTracker["attachListener"] = (
  element,
  event,
  callback
) => {
  if (event === "change") {
    let value: any;

    const offFocus = attachListener(element, "focus", () => {
      value = elementValue(element);
    });
    const offBlur = attachListener(element, "blur", (...args) => {
      if (value !== elementValue(element)) {
        callback(...args);
      }
    });

    return () => {
      offFocus();
      offBlur();
    };
  }

  const listener = (e: Event) => {
    callback(e.currentTarget as any, e.target as any, e);
  };

  element.addEventListener(event, listener);
  return () => {
    element.removeEventListener(event, listener);
  };
};

export const isTrackerElement: DomTracker["isTrackerElement"] = (element) => {
  return !!element.getAttribute(TRACKERS_KEY);
};
export const isTriggerElement: DomTracker["isTrackerElement"] = (element) => {
  return !!element.getAttribute(TRIGGERS_KEY);
};
