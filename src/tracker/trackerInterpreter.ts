import { set } from "./getset";
import {
  attributeName,
  PARAMS_KEY,
  TRACKERS_KEY,
  TRIGGERS_KEY,
} from "./tracker";
import {
  DisposeHandler,
  isTracker,
  TrackingHost,
  TriggerEvent,
  TrackEvent,
} from "./TrackerType";

// @ts-ignore
const dataLayer = window["dataLayer"] || (window["dataLayer"] = []);
let listeners = new Set<any>();

function sendEvent(event: Record<any, any>) {
  dataLayer.push(event);
  for (let listener of listeners) {
    listener();
  }
}

export function onSendEvent(callback: (events: any[]) => any) {
  listeners.add(callback);
}

function getWithDefault<Key extends {}, T>(
  map: WeakMap<Key, T>,
  key: Key,
  defaultValue: T
) {
  let value = map.get(key);

  if (value === undefined) {
    value = defaultValue;
    map.set(key, value);
  }

  return value;
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

class ElementEngine {
  unmount?: DisposeHandler;
  ctx: {}[] = [];

  static disposers = new WeakMap<HTMLElement, Set<DisposeHandler>>();

  static getAnalyticsEventType(domEvent: DomEvent) {
    return domEvent;
  }

  /*
  When we attach listeners we want them to be removed whenever either the analytics element is removed or the
  individual element is removed
  */
  addDisposer(
    element: HTMLElement,
    targetElement: HTMLElement,
    disposer: DisposeHandler
  ) {
    const elementSet = getWithDefault(
      ElementEngine.disposers,
      element,
      new Set<DisposeHandler>()
    );
    const targetSet = getWithDefault(
      ElementEngine.disposers,
      targetElement,
      new Set<DisposeHandler>()
    );

    const wrapper = () => {
      const elementSet = getWithDefault(
        ElementEngine.disposers,
        element,
        new Set()
      );
      const targetSet = getWithDefault(
        ElementEngine.disposers,
        element,
        new Set()
      );
      disposer();
      elementSet.delete(wrapper);
      targetSet.delete(wrapper);
    };

    elementSet.add(wrapper);
    targetSet.add(wrapper);

    return wrapper;
  }

  constructor(element: HTMLElement) {
    this.ctx = this.getCtx(element);

    this.attachListeners(element, true);
  }

  attachListeners(element: HTMLElement, isFirstMount = false) {
    const trackerKey = attributeName(TRACKERS_KEY);

    if (element.hasAttribute(trackerKey)) {
      const trackers = parse(element.getAttribute(trackerKey)!) as TrackEvent[];

      if (trackers) {
        for (let tracker of trackers) {
          const [type, domEvent, analyticsEvent, target] = tracker;

          if (type !== TRACK) {
            throw new Error(
              "Invalid tracker passed to element: " +
                element.getAttribute(trackerKey)
            );
          }

          const handler = this.createSendEvent(analyticsEvent || domEvent);

          switch (domEvent) {
            case "mount": {
              if (isFirstMount) {
                handler();
              }
              continue;
            }
            case "unmount": {
              if (this.unmount) {
                ElementEngine.disposers.delete(element, this.unmount);
              }
              this.unmount = this.addDisposer(element, element, handler);
              continue;
            }
            case "change": {
              const eventElement = target
                ? element.querySelector<HTMLElement>(
                    createQuerySelector(target)
                  )
                : element;

              if (!eventElement) continue;

              let lastValue: any;

              const onFocus = () => {
                lastValue = elementValue(eventElement);
              };
              const onBlur = () => {
                if (elementValue(eventElement) !== lastValue) {
                  handler();
                }
                lastValue = undefined;
              };
              eventElement.addEventListener("focus", onFocus);
              eventElement.addEventListener("blur", onBlur);

              this.addDisposer(element, eventElement, () => {
                eventElement.removeEventListener("focus", onFocus);
                eventElement.removeEventListener("blur", onBlur);
              });
              continue;
            }
            default: {
              let handler = this.createSendEvent(analyticsEvent || domEvent);

              const eventElement = target
                ? element.querySelector<HTMLElement>(
                    createQuerySelector(target)
                  )
                : element;

              if (!eventElement) continue;

              eventElement.addEventListener(domEvent, handler);

              this.addDisposer(element, eventElement, () => {
                eventElement.removeEventListener(domEvent, handler);
              });
            }
          }
        }
      }
    }
  }

  createSendEvent(analyticsEvent: string) {
    return () => {
      const event = {
        event: analyticsEvent,
      };
      for (let ctx of this.ctx) {
        for (let prop in ctx) {
          if (Object.hasOwn(ctx, prop)) {
            // @ts-ignore
            set(event, prop.split("."), ctx[prop]);
          }
        }
      }

      console.log("test");

      sendEvent(event);
    };
  }

  getCtx(element: HTMLElement) {
    let target = element;
    let context: {}[] = [];

    const key = attributeName(PARAMS_KEY);

    while (target && element !== document.body) {
      if (target.hasAttribute(key)) {
        let parsed = parse<{}>(target.getAttribute(key)!);
        if (parsed) context.push(parsed);
      }
      target = target.parentElement as any;
    }

    context.reverse();

    return context;
  }
}

function getTrackableElements(element: HTMLElement) {
  let elements = [];
  const query = `[${attributeName(COMPONENT_KEY)}]`;

  if (element.matches(query)) {
    elements.push(element);
  }

  elements.push(...element.querySelectorAll<HTMLElement>(query));

  return elements;
}

function getTriggerableElements(element: HTMLElement) {
  let elements = [];
  const query = `[${attributeName(TRIGGERS_KEY)}]`;

  if (element.matches(query)) {
    elements.push(element);
  }

  elements.push(...element.querySelectorAll<HTMLElement>(query));

  return elements;
}

export function mountTracking<NodeType>(
  rootElement: HTMLElement,
  host: TrackingHost<NodeType>,
  onSendEvent: (event: string, ctx: {}) => {}
) {
  if (!host.getUserPreferencesEnabled()) {
    return;
  }

  interface TrackerInstance {
    unmount: Set<DisposeHandler>;
  }

  const trackerStore = new Map<NodeType, TrackerInstance>();
  const paramsStore: [NodeType, {} | undefined | null][] = [];
  const triggersStore = new Map<NodeType, any>();
  const disposersStore = new Map<NodeType, Set<DisposeHandler>>();
  const elCtx = new Map<NodeType, Set<NodeType>>();

  function addElDisposer(disposer: DisposeHandler, ...els: NodeType[]) {
    const disposeWithCleanup = () => {
      disposer();
      for (let el of els) {
        let elSet = disposersStore.get(el);

        if (elSet) {
          elSet.delete(disposer);
        }
      }
    };

    for (let el of els) {
      let elSet = disposersStore.get(el);

      if (!elSet) {
        elSet = new Set();
      }

      elSet.add(disposeWithCleanup);
    }

    return disposeWithCleanup;
  }

  function getCtx(element: NodeType) {
    let ctx = {};
    for (let store of paramsStore) {
      let [parent, state] = store;
      if (host.isParentOf(parent, element) || parent === element) {
        if (state === null) {
          state = store[1] = host.getParams(parent);
        }
        if (state) {
          for (let prop in state) {
            // @ts-ignore
            set(ctx, prop.split("."), state[prop]);
          }
        }
      }

      if (parent === element) {
        return ctx;
      }
    }

    return ctx;
  }

  function sendEvent(element: NodeType, event: TrackEvent | TriggerEvent) {
    const eventName = event[2] || event[1];
    const ctx = getCtx(element);
    if (isTracker(event)) {
      onSendEvent(eventName, ctx);
    }
  }

  // Happens on attribute change and
  function attachEvents(
    trackerEl: NodeType,
    instance: TrackerInstance,
    isFirstMount = false
  ) {
    const trackers = host.getTrackers(trackerEl);

    if (instance.unmount.size) {
      const set = disposersStore.get(trackerEl);
      if (set) {
        for (let unmounter of instance.unmount) {
          set.delete(unmounter);
        }
      }
    }

    if (trackers) {
      for (let tracker of trackers) {
        const [type, eventName, analyticsEvent, targetSelector] = tracker;

        if (eventName === "unmount") {
          instance.unmount.add(
            addElDisposer(() => {
              sendEvent(trackerEl, tracker);
            })
          );
        } else if (eventName === "mount") {
          if (isFirstMount) {
            sendEvent(trackerEl, tracker);
          }
        }
      }
    }
  }

  function onAdded(element: NodeType) {
    const trackerElements = host.getTrackerElements(element);

    for (let trackerEl of trackerElements) {
      if (trackerStore.get(trackerEl)) continue;

      const trackerInstance: TrackerInstance = {
        unmount: new Set(),
      };

      trackerStore.set(trackerEl, trackerInstance);

      attachEvents(trackerEl, trackerInstance, true);
    }
  }

  function onChanged(element: NodeType) {}

  function onRemoved(element: NodeType) {}

  function addTriggerElement(element: HTMLElement) {
    let engineElement = element;
    let engine: ElementEngine | undefined;

    while (engineElement && engineElement !== document.body) {
      engine = store.get(engineElement);

      if (engine) {
        break;
      }

      engineElement = engineElement.parentElement!;
    }

    if (!engine) {
      console.warn("Could not find tracker element for trigger", element);
      return;
    }

    let triggerers = parse<TriggerEvent[]>(
      element.getAttribute(attributeName(TRIGGERS_KEY))!
    );

    if (!triggerers) return;
    for (let trigger of triggerers) {
      const [type, domEvent, analyticsEvent] = trigger;

      if (type !== TRIGGER) {
        throw new Error(
          "Invalid trigger passed to element: " +
            element.getAttribute(attributeName(TRIGGERS_KEY))
        );
      }

      switch (domEvent) {
        case "mount":
          engine.createSendEvent(analyticsEvent || domEvent)();
          continue;
        case "unmount":
          const sender = engine.createSendEvent(analyticsEvent || domEvent);

          engine.addDisposer(engineElement, element, () => {
            sender();
          });
          continue;
        default: {
          const handler = engine.createSendEvent(analyticsEvent || domEvent);
          element.addEventListener(domEvent, handler);
          engine.addDisposer(engineElement, element, () => {
            element.removeEventListener(domEvent, handler);
          });
        }
      }
    }
  }
  function remount(element: HTMLElement) {
    console.log("remount");
    const elements = getTrackableElements(element);

    for (let element of elements) {
      if (store.has(element)) continue;

      const engine = new ElementEngine(element);
      store.set(element, engine);
    }

    const triggers = getTriggerableElements(element);

    for (let triggerer of triggers) {
      addTriggerElement(triggerer);
    }
  }

  function unmount(element: HTMLElement) {
    console.log("unmount");
    for (let trackedElement of getTrackableElements(element)) {
      store.delete(trackedElement);

      const disposers = ElementEngine.disposers.get(trackedElement);

      if (disposers) {
        for (let disposer of disposers) {
          disposer();
        }
      }

      ElementEngine.disposers.delete(trackedElement);
    }

    for (let triggerElement of getTriggerableElements(element)) {
      const disposers = ElementEngine.disposers.get(triggerElement);

      if (disposers) {
        for (let disposer of disposers) {
          disposer();
        }
      }

      ElementEngine.disposers.delete(triggerElement);
    }
  }

  const mutationObserver = new MutationObserver((entries) => {
    for (let entry of entries) {
      if (entry.type === "childList") {
        if (entry.removedNodes) {
          for (let element of entry.removedNodes) {
            unmount(element as any);
          }
        }

        if (entry.addedNodes) {
          for (let element of entry.addedNodes) {
            remount(element as any);
          }
        }
      }
    }
  });

  mutationObserver.observe(rootElement, {
    childList: true,
    subtree: true,
    attributeFilter: [
      attributeName(PARAMS_KEY),
      attributeName(TRACKERS_KEY),
      attributeName(TRIGGERS_KEY),
    ],
  });

  remount(rootElement);

  return () => {
    unmount(rootElement);
  };
}
