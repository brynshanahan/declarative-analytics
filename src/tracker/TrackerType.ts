export const TRACK = "T" as const;
export const TRIGGER = "R" as const;
export const PARAM = "P" as const;

export type DomEvent = string & {};
export type AnalyticsEvent = string & {};
export type TargetSelector = string & {};

export type JSONPrimitive =
  | string
  | boolean
  | number
  | null
  | { [k: string]: JSONPrimitive }
  | JSONPrimitive[];

export type TriggerEvent = [typeof TRIGGER, DomEvent, AnalyticsEvent?];
export type TrackEvent = [
  typeof TRACK,
  DomEvent,
  AnalyticsEvent?,
  TargetSelector?
];

export interface DisposeHandler {
  (): void;
}

export interface TrackingHost<NodeType> {
  getTrackers(element: NodeType): undefined | TrackEvent[];

  getTriggers(element: NodeType): undefined | TriggerEvent[];

  getParams(element: NodeType): undefined | { [k: string]: JSONPrimitive };

  getTrackerElementProps(config: {
    track: TrackEvent[];
    params?: { [k: string]: JSONPrimitive };
  }): { [k: string]: string };

  getParamElementProps(params: { [k: string]: JSONPrimitive }): {
    [k: string]: string;
  };

  getTrackerElements(root: NodeType): Iterable<NodeType>;

  getTriggerElements(root: NodeType): Iterable<NodeType>;

  getParamElements(root: NodeType): Iterable<NodeType>;

  getEventTargetElement(element: NodeType, selector: string): NodeType;

  getTriggerElementProps(triggers: TriggerEvent[]): { [k: string]: string };

  on(element: NodeType, event: DomEvent, callback: () => any): DisposeHandler;

  isParentOf(parent: NodeType, child: NodeType): boolean;

  getParent(element: NodeType): NodeType | null;

  getUserPreferencesEnabled(): boolean;

  connect(
    node: NodeType,
    onAdded: (element: NodeType) => any,
    onChanged: (element: NodeType, attribute: string | null) => any,
    onRemoved: (element: NodeType) => any
  ): DisposeHandler;

  isTrackerElement(element: NodeType): boolean;
  isTriggerElement(element: NodeType): boolean;
}

export function isTracker(value: any): value is TrackEvent {
  return Array.isArray(value) && value[0] === TRACK;
}

export function isTrigger(value: any): value is TriggerEvent {
  return Array.isArray(value) && value[0] === TRIGGER;
}

export function trigger(domEvent: DomEvent, analyticsEvent: AnalyticsEvent) {
  return [TRIGGER, domEvent, analyticsEvent] as TriggerEvent;
}
export function track(
  domEvent: DomEvent,
  target?: TargetSelector | null,
  analyticsEvent?: AnalyticsEvent | null
) {
  return [TRACK, domEvent, analyticsEvent, target] as TrackEvent;
}
