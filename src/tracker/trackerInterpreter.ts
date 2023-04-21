import { set } from "./getset";
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
    {} | typeof PARAM_NEEDS_RECOMPUTE | undefined
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

  function getCtx(element: NodeType) {
    let ctx = {};
    let ctxEls = ctxParents.get(element);

    if (ctxEls) {
      for (let ctxEl of ctxEls) {
        let param = paramsStore.get(ctxEl);

        if (param === null) {
          param = host.getParams(ctxEl);
          paramsStore.set(ctxEl, param);
        }
        if (param === undefined) {
          continue;
        }

        for (let prop in param) {
          if (Object.hasOwn(param, prop)) {
            // @ts-ignore
            set(ctx, prop.split("."), param[prop]);
          }
        }
      }
    }

    return ctx;
  }

  function sendEvent(element: NodeType, event: TrackEvent | TriggerEvent) {
    const eventName = event[2] || event[1];
    const ctx = getCtx(element);
    if (isTracker(event) || isTrigger(event)) {
      onSendEvent(eventName, ctx);
    }
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
              sendEvent(trackerEl, tracker);
            },
            trackerEl,
            instance
          );
        } else if (eventName === "mount") {
          if (isFirstMount) {
            sendEvent(trackerEl, tracker);
          }
        } else {
          let targetElement = targetSelector
            ? host.getEventTargetElement(trackerEl, targetSelector)
            : trackerEl;

          addInstanceDisposer(
            host.on(targetElement, eventName, () => {
              sendEvent(trackerEl, tracker);
            }),
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
    let trackerEl = host.getParent(triggerEl);

    while (
      trackerEl &&
      trackerHost !== rootElement &&
      !(trackerHost = trackerStore.get(trackerEl))
    ) {
      trackerEl = host.getParent(trackerEl);
    }

    if (!trackerHost || !trackerEl) {
      console.warn("could not find host for trigger element", triggerEl);
      return;
    }

    if (triggers) {
      for (let trigger of triggers) {
        const [_, eventName, __] = trigger;

        console.log(eventName);

        if (eventName === "unmount") {
          addInstanceDisposer(
            () => sendEvent(trackerEl!, trigger),
            triggerEl,
            trackerEl,
            instance
          );
        } else if (eventName === "mount") {
          if (isFirstMount) {
            sendEvent(trackerEl, trigger);
          }
        } else {
          let targetElement = triggerEl;

          addInstanceDisposer(
            host.on(targetElement, eventName, () => {
              sendEvent(trackerEl!, trigger);
            }),
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
    }

    const triggerElements = host.getTriggerElements(element);

    for (let triggerEl of triggerElements) {
      if (triggersStore.get(triggerEl)) continue;

      const triggerInstance: TriggerInstance = {
        type: TRIGGER,
      };

      triggersStore.set(triggerEl, triggerInstance);

      attachTriggerEvents(triggerEl, triggerInstance, true);
    }
  }

  function onChanged(element: NodeType) {
    if (paramsStore.has(element)) {
      paramsStore.set(element, null);
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
