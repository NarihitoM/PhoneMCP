export interface Device {
  serial: string;
  state: string;
  model?: string;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface UiElement {
  index: number;
  text: string;
  description: string;
  resourceId: string;
  className: string;
  clickable: boolean;
  scrollable: boolean;
  focused: boolean;
  bounds: Bounds;
  center: { x: number; y: number };
}

export interface MdnsService {
  name: string;
  type: string;
  address: string;
}
