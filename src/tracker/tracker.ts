import {
  getParamElementProps,
  getTrackerElementProps,
  getTriggerElementProps,
} from "./DomTracker";
import { JSONPrimitive, TrackEvent, TriggerEvent } from "./TrackerType";

export function tracker(args: {
  name?: string;
  component?: string;
  // Package can be picked up from parent
  package?: string;
  track: TrackEvent[];
  params?: { [k: string]: JSONPrimitive };
  enabled?: boolean;
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

    if (args.enabled !== undefined) {
      paramsToAttach.selfEnabled = args.enabled;
    }

    if (params) {
      Object.assign(paramsToAttach, params);
    }
  }

  return getTrackerElementProps({
    track,
    params: paramsToAttach,
  });
}

export function trackerParams(params: Record<string, JSONPrimitive>) {
  return getParamElementProps(params);
}

// Triggers something on closest component
export function triggers(triggers: TriggerEvent[]) {
  return getTriggerElementProps(triggers);
}
