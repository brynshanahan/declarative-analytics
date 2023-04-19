import {
  AnalyticsEvent,
  DomEvent,
  isTracker,
  isTrigger,
  JSONPrimitive,
  TrackingHost,
  TrackEvent,
  TRIGGER,
  TriggerEvent,
} from "./TrackerType";

export function attributeName(key: string) {
  return `data-tr-${key}`;
}

export const PARAMS_KEY = attributeName("params");
export const TRACKERS_KEY = attributeName("trackers");
export const TRIGGERS_KEY = attributeName("triggers");

function parse<T>(value: string | null): T | undefined {
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
      // @ts-ignore
      let value = deepStableObj(obj[keys[i]]);
    }

    return result;
  }

  return val;
}

const TRACKERS_EVENT_DELIMITER = " ";
const TRACKERS_DELIMITER = ",";
const TRIGGER_EVENT_DELIMITER = " ";
const TRIGGERS_DELIMITER = ",";

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

export const DomTracker: TrackingHost<HTMLElement> = {
  getTrackers(element) {
    const attr = element.getAttribute(TRACKERS_KEY);

    if (!attr) return undefined;

    const trackers: TrackEvent[] = [];

    for (let trackerAttr of attr.split(TRACKERS_DELIMITER)) {
      const tracker = trackerAttr.split(TRACKERS_DELIMITER);

      if (isTracker(tracker)) {
        trackers.push(tracker);
      } else {
        console.warn(
          "Non tracker attribute given to element at",
          elPath(element)
        );
      }
    }

    return trackers;
  },
  getTriggers(element) {
    const attr = element.getAttribute(TRIGGERS_KEY);

    if (!attr) return undefined;

    const triggers: TriggerEvent[] = [];

    for (let triggerAttr of attr.split(TRIGGERS_DELIMITER)) {
      const trigger = triggerAttr.split(TRIGGERS_DELIMITER);

      if (isTrigger(trigger)) {
        triggers.push(trigger);
      } else {
        console.warn(
          "Non trigger attribute give to element at",
          elPath(element)
        );
      }
    }

    return triggers;
  },
  getParams(element) {
    return parse(element.getAttribute(PARAMS_KEY));
  },
  getParamElements(root) {
    return queryForElements(root, `[${PARAMS_KEY}]`);
  },
  getTrackerElements(root) {
    return queryForElements(root, `[${TRACKERS_KEY}]`);
  },
  getTriggerElements(root) {
    return queryForElements(root, `[${TRIGGERS_KEY}]`);
  },
  getEventTargetElement(element, selector) {
    let sel = selector;
    switch (sel.charAt(0)) {
      case ">":
      case "+":
      case "~":
        sel = `:scope ${sel}`;
        break;
    }
    return element.querySelector(sel) || element;
  },
  isParentOf(parent, child) {
    return parent.contains(child);
  },
  getParent(child) {
    return child.parentElement;
  },
  getUserPreferencesEnabled() {
    if (window.navigator.doNotTrack && !localStorage.pleaseTrack) {
      console.log(
        "doNotTrack detected, not tracking add `localStorage.pleaseTrack = true` to continue tracking"
      );
      return false;
    }
    return true;
  },
  connect(root, onAdded, onChanged, onRemoved) {
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
          onChanged(entry.target as HTMLElement);
        }
      }
    });

    mo.observe(root, {
      childList: true,
      subtree: true,
      attributeFilter: [PARAMS_KEY, TRACKERS_KEY, TRIGGERS_KEY],
    });

    return () => {
      mo.disconnect();
    };
  },
  getTrackerElementProps(config) {
    let trackers: string[] = [];

    for (let tracker of config.track) {
      const [type, domEvent, analyticsEvent, targetSelector] = tracker;

      if (targetSelector?.includes(TRACKERS_DELIMITER)) {
        throw new Error(
          `Tracker selector can't contain '${TRACKERS_DELIMITER}'`
        );
      }

      let trackerAttr: string = `${type}${TRACKERS_EVENT_DELIMITER}${domEvent}`;

      if (analyticsEvent) {
        trackerAttr += `${TRACKERS_EVENT_DELIMITER}${analyticsEvent}`;
      }

      if (targetSelector) {
        if (!analyticsEvent) {
          trackerAttr += TRACKERS_EVENT_DELIMITER;
        }

        trackerAttr += `${TRACKERS_EVENT_DELIMITER}${targetSelector.replaceAll(
          TRACKERS_EVENT_DELIMITER,
          ""
        )}`;
      }

      trackers.push(trackerAttr);
    }

    const result = {
      [TRACKERS_KEY]: trackers.sort().join(TRACKERS_DELIMITER),
    };

    if (config.params) {
      Object.assign(result, this.getParamElementProps(config.params));
    }

    return result;
  },
  getParamElementProps(params) {
    return {
      [PARAMS_KEY]: JSON.stringify(deepStableObj(params)),
    };
  },
  getTriggerElementProps(triggers) {
    let triggerAttrs: string[] = [];

    for (let [type, domEvent, analyticsEvent] of triggers) {
      let triggerAttr = `${type}${TRIGGER_EVENT_DELIMITER}${domEvent}`;

      if (analyticsEvent) {
        triggerAttr += `${TRIGGER_EVENT_DELIMITER}${analyticsEvent}`;
      }

      triggerAttrs.push(triggerAttr);
    }

    return {
      [TRIGGERS_KEY]: triggerAttrs.sort().join(TRIGGERS_DELIMITER),
    };
  },
  on(element, event, callback) {
    element.addEventListener(event, callback);
    return () => {
      element.removeEventListener(event, callback);
    };
  },
};

export function tracker(args: {
  name?: string;
  component?: string;
  // Package can be picked up from parent
  package?: string;
  track: TrackEvent[];
  params?: { [k: string]: JSONPrimitive };
}) {
  const { name, component, package: pkg, track, params } = args;
  let paramsToAttach: any = undefined;

  if (name || component || pkg || params) {
    paramsToAttach = {};

    if (name) {
      paramsToAttach.name = name;
    }

    if (component && pkg) {
      paramsToAttach.component_id = `${pkg}|${component}`;
    } else {
      if (pkg) {
        paramsToAttach.package = pkg;
      }
      if (component) {
        paramsToAttach.component = component;
      }
    }

    if (params) {
      Object.assign(paramsToAttach, params);
    }
  }

  return DomTracker.getTrackerElementProps({
    track,
    params: paramsToAttach,
  });
}

export function params(params: Record<string, JSONPrimitive>) {
  return DomTracker.getParamElementProps(params);
}

// Triggers something on closest component
export function triggers(triggers: TriggerEvent[]) {
  return DomTracker.getTriggerElementProps(triggers);
}
