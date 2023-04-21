import { get, set } from "./getset";
import {
  DisposeHandler,
  isTracker,
  TrackingHost,
  TriggerEvent,
  TrackEvent,
  isTrigger,
  TRACK,
  TRIGGER,
} from "./TrackerType";

const PARAM_NEEDS_RECOMPUTE = null;

function hasOwn(
  obj: { [k: string]: any },
  key: string | number
): key is keyof typeof obj {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function hasFalsyAttr(value: any) {
  return (
    (hasAttr(value) && value === false) || (value === "false" && value === "0")
  );
}

function hasAttr(value: any) {
  return value !== undefined || value !== "";
}

const EMPTY_EVENT = {};

type Dict<K extends string = string, V = any> = Record<K, V>;

export function mountTracking<NodeType>(
  rootElement: NodeType,
  host: TrackingHost<NodeType>,
  onSendEvent: (event: string, ctx: {}) => any
) {
  if (!host.getUserPreferencesEnabled()) {
    return;
  }

  interface TrackerInstance {
    type: typeof TRACK;
  }

  interface TriggerInstance {
    type: typeof TRIGGER;
  }

  const trackerStore = new Map<NodeType, TrackerInstance>();
  const paramsStore = new Map<
    NodeType,
    Dict | typeof PARAM_NEEDS_RECOMPUTE | undefined
  >();
  const triggersStore = new Map<NodeType, any>();
  const disposersStore = new Map<
    NodeType | TriggerInstance | TrackerInstance,
    Set<DisposeHandler>
  >();
  const ctxParents = new Map<NodeType, NodeType[]>();

  // @ts-ignore
  window.stores = {
    trackerStore,
    paramsStore,
    triggersStore,
    disposersStore,
    ctxParents,
  };

  function isTrackerInstance(value: any): value is TrackerInstance {
    return value && value.type === TRACK;
  }

  function isTriggerInstance(value: any): value is TriggerInstance {
    return value && value.type === TRIGGER;
  }

  type DisposableInstance = NodeType | TriggerInstance | TrackerInstance;
  function addInstanceDisposer(
    disposer: DisposeHandler,
    ...els: [DisposableInstance, ...DisposableInstance[]]
  ) {
    const disposeWithCleanup = () => {
      disposer();
      for (let el of els) {
        let disposerSet = disposersStore.get(el);

        if (disposerSet) {
          disposerSet.delete(disposeWithCleanup);

          if (disposerSet.size === 0) {
            disposersStore.delete(el);
          }
        }
      }
    };

    for (let el of els) {
      let disposerSet = disposersStore.get(el);

      if (!disposerSet) {
        disposerSet = new Set();
        disposersStore.set(el, disposerSet);
      }

      disposerSet.add(disposeWithCleanup);
    }

    return disposeWithCleanup;
  }

  function getCtxParents(element: NodeType) {
    let contextElements: NodeType[] = [];
    let targetElement: NodeType | null = element;

    while (targetElement && targetElement !== rootElement) {
      if (paramsStore.has(targetElement)) {
        contextElements.push(targetElement);
      }
      targetElement = host.getParent(targetElement);
    }

    return contextElements.reverse();
  }

  function getCtx(element: NodeType, extraParams?: Dict) {
    let ctx: { [k: string]: any } = {};
    let props: { [k: string]: any } = {};
    let ctxEls = ctxParents.get(element);
    let pathsToResolve: [string[], string][] = [];
    const result = [ctx, props, pathsToResolve] as const;

    if (ctxEls) {
      for (let ctxEl of ctxEls) {
        let param = paramsStore.get(ctxEl);

        if (param === PARAM_NEEDS_RECOMPUTE) {
          param = host.getParams(ctxEl);
          paramsStore.set(ctxEl, param);
        }
        if (param === undefined) {
          continue;
        }

        for (let prop in param) {
          if (prop === "selfEnabled") {
            if (ctxEl === element && hasFalsyAttr(param[prop])) {
              props.enabled = false;
              return result;
            } else {
              continue;
            }
          }

          if (prop === "enabled") {
            if (hasFalsyAttr(param[prop])) {
              props.enabled = false;
              return result;
            } else {
              continue;
            }
          }

          if (hasOwn(param, prop)) {
            const path = prop.split(".");
            const value = param[prop];

            if (typeof value === "string" && value.charAt(0) === "$") {
              pathsToResolve.push([path, value]);
            }

            set(ctx, path, value, true);

            if (element === ctxEl) {
              set(props, path, value, true);
            }
          }
        }
      }
    }

    if (extraParams) {
      for (let prop in extraParams) {
        if (hasOwn(extraParams, prop)) {
          const path = prop.split(".");
          const value = extraParams[prop];

          if (typeof value === "string" && value.charAt(0) === "$") {
            pathsToResolve.push([path, value]);
          }

          set(ctx, path, value, true);
        }
      }
    }

    return result;
  }

  function sendEvent(
    eventType: TrackEvent | TriggerEvent,
    trackerEl: NodeType,
    triggerEl: NodeType | null,
    currentTargetEl: NodeType,
    targetEl: NodeType,
    event: { [k: string]: any }
  ) {
    const isTrackerEvent = isTracker(eventType);

    if (!isTrackerEvent && !isTrigger(eventType)) {
      return;
    }

    const eventName = eventType[2] || eventType[1];
    let [ctx, props, pathsToResolve] = getCtx(
      trackerEl,
      isTrackerEvent ? eventType[4] : eventType[3]
    );

    if (props.enabled === false) {
      return;
    }

    if (pathsToResolve) {
      for (let [path, value] of pathsToResolve) {
        let targetPath = value.split(".");
        while (targetPath.length && targetPath[0].charAt(0) === "$") {
          let prop = targetPath.shift();
          switch (prop) {
            case "$currentTarget":
              set(ctx, path, get(currentTargetEl as any, targetPath));
              break;
            case "$target":
              set(ctx, path, get(targetEl as any, targetPath));
              break;
            case "$tracker":
              set(ctx, path, get(trackerEl as any, targetPath));
              break;
            case "$trigger":
              set(ctx, path, get(triggerEl as any, targetPath));
              break;
            case "$event":
              set(ctx, path, get(event, targetPath));
              break;
            default:
              console.log("err");
              throw new Error("Invalid path: " + value);
          }
        }
      }
    }

    onSendEvent(eventName, ctx);
  }

  function dispose(element: NodeType | TrackerInstance | TriggerInstance) {
    const disposers = disposersStore.get(element);

    if (disposers) {
      for (let disposer of disposers) {
        disposer();
      }
    }

    if (isTrackerInstance(element) || isTriggerInstance(element)) return;

    const trackerInstance = trackerStore.get(element);
    if (trackerInstance) {
      dispose(trackerInstance);
    }

    const triggerInstance = triggersStore.get(element);
    if (triggerInstance) {
      dispose(triggerInstance);
    }

    disposersStore.delete(element);
    paramsStore.delete(element);
    trackerStore.delete(element);
    triggersStore.delete(element);
    ctxParents.delete(element);
  }

  // Happens on attribute change and
  function attachTrackerEvents(
    trackerEl: NodeType,
    instance: TrackerInstance,
    isFirstMount = false
  ) {
    const trackers = host.getTrackers(trackerEl);
    const disposers = disposersStore.get(trackerEl);
    const unmounters = disposersStore.get(instance);

    if (disposers) {
      // if we are reattaching events we don't want to call unmount events
      if (unmounters) {
        for (let unmounter of unmounters) {
          disposers.delete(unmounter);
        }
      }

      for (let disposer of disposers) {
        disposer();
      }
    }

    if (trackers) {
      for (let tracker of trackers) {
        const [_, eventName, __, targetSelector] = tracker;

        if (eventName === "unmount") {
          addInstanceDisposer(
            () => {
              sendEvent(
                tracker,
                trackerEl,
                null,
                trackerEl,
                trackerEl,
                EMPTY_EVENT
              );
            },
            trackerEl,
            instance
          );
        } else if (eventName === "mount") {
          if (isFirstMount) {
            sendEvent(
              tracker,
              trackerEl,
              null,
              trackerEl,
              trackerEl,
              EMPTY_EVENT
            );
          }
        } else {
          let targetElement = targetSelector
            ? host.getEventTargetElement(trackerEl, targetSelector)
            : trackerEl;

          addInstanceDisposer(
            host.attachListener(
              targetElement,
              eventName,
              (currentTarget, target, event) => {
                sendEvent(
                  tracker,
                  trackerEl,
                  null,
                  currentTarget,
                  target,
                  event
                );
              }
            ),
            targetElement,
            trackerEl
          );
        }
      }
    }
  }

  function attachTriggerEvents(
    triggerEl: NodeType,
    instance: TriggerInstance,
    isFirstMount = false
  ) {
    const triggers = host.getTriggers(triggerEl);
    const disposers = disposersStore.get(triggerEl);
    const unmounters = disposersStore.get(instance);

    if (disposers) {
      // if we are reattaching events we don't want to call unmount events
      if (unmounters) {
        for (let unmounter of unmounters) {
          disposers.delete(unmounter);
        }
      }

      for (let disposer of disposers) {
        disposer();
      }
    }

    let trackerHost;
    let trackerTarget = host.getParent(triggerEl);

    while (
      trackerTarget &&
      trackerHost !== rootElement &&
      !(trackerHost = trackerStore.get(trackerTarget))
    ) {
      trackerTarget = host.getParent(trackerTarget)!;
    }

    if (!trackerHost || !trackerTarget) {
      console.warn("could not find host for trigger element", triggerEl);
      return;
    }

    const trackerEl = trackerTarget;

    if (triggers) {
      for (let trigger of triggers) {
        const [_, eventName, __, selector] = trigger;

        const currentTarget = host.getEventTargetElement(trackerEl, selector);

        if (eventName === "unmount") {
          addInstanceDisposer(
            () =>
              sendEvent(
                trigger,
                trackerEl,
                triggerEl,
                currentTarget,
                triggerEl,
                {}
              ),
            triggerEl,
            trackerEl,
            instance
          );
        } else if (eventName === "mount") {
          if (isFirstMount) {
            sendEvent(
              trigger,
              trackerEl,
              triggerEl,
              currentTarget,
              triggerEl,
              {}
            );
          }
        } else {
          let targetElement = host.getEventTargetElement(trackerEl, selector);

          addInstanceDisposer(
            host.attachListener(
              targetElement,
              eventName,
              (currentTarget, target, event) => {
                sendEvent(
                  trigger,
                  trackerEl!,
                  triggerEl,
                  currentTarget,
                  target,
                  event
                );
              }
            ),
            targetElement,
            trackerEl,
            triggerEl
          );
        }
      }
    }
  }

  function onAdded(element: NodeType) {
    const paramElements = host.getParamElements(element);

    for (let paramEl of paramElements) {
      if (paramsStore.get(paramEl)) continue;

      paramsStore.set(paramEl, host.getParams(paramEl));
    }

    const trackerElements = host.getTrackerElements(element);

    for (let trackerEl of trackerElements) {
      if (trackerStore.get(trackerEl)) continue;

      const trackerInstance: TrackerInstance = {
        type: TRACK,
      };

      trackerStore.set(trackerEl, trackerInstance);
      ctxParents.set(trackerEl, getCtxParents(trackerEl));

      attachTrackerEvents(trackerEl, trackerInstance, true);

      addInstanceDisposer(() => {
        trackerStore.delete(trackerEl);
      }, trackerEl);
    }

    const triggerElements = host.getTriggerElements(element);

    for (let triggerEl of triggerElements) {
      if (triggersStore.get(triggerEl)) continue;

      const triggerInstance: TriggerInstance = {
        type: TRIGGER,
      };

      triggersStore.set(triggerEl, triggerInstance);

      attachTriggerEvents(triggerEl, triggerInstance, true);

      addInstanceDisposer(() => {
        triggersStore.delete(triggerEl);
      }, triggerEl);
    }
  }

  function onChanged(element: NodeType) {
    if (paramsStore.has(element)) {
      paramsStore.set(element, PARAM_NEEDS_RECOMPUTE);
    }

    if (host.isTrackerElement(element)) {
      if (trackerStore.has(element)) {
        attachTrackerEvents(element, trackerStore.get(element)!);
      } else {
        onAdded(element);
      }
    } else {
      if (trackerStore.has(element)) {
        dispose(element);
      }
    }

    if (host.isTriggerElement(element)) {
      if (triggersStore.has(element)) {
        attachTriggerEvents(element, triggersStore.get(element)!);
      } else {
        onAdded(element);
      }
    } else {
      if (triggersStore.has(element)) {
        dispose(element);
      }
    }
  }

  function onRemoved(removedElement: NodeType) {
    /*
    Keys are added in parent -> child order, so we want to remove them in child -> parent order
    */
    const childFirstKeys = [...disposersStore.keys()].reverse();

    for (let el of childFirstKeys) {
      if (isTrackerInstance(el) || isTriggerInstance(el)) continue;
      if (host.isParentOf(removedElement, el)) {
        dispose(el);
      }
    }

    dispose(removedElement);
  }

  const disconnect = host.connect(rootElement, onAdded, onChanged, onRemoved);

  return () => {
    disconnect();

    for (let disposerSet of disposersStore.values()) {
      for (let disposer of disposerSet) {
        disposer();
      }
    }
    disposersStore.clear();
  };
}
