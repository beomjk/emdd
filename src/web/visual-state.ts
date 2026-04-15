import {
  getGraphThemeTokens,
  getNodeColor,
  getStatusBorder,
} from './constants.js';

export type GraphTheme = 'light' | 'dark';
export type VisualElementKind = 'node' | 'edge' | 'cluster';
export type VisualStateKind =
  | 'default'
  | 'selected'
  | 'highlighted'
  | 'invalid'
  | 'grouped'
  | 'dimmed';

export interface MotionProfile {
  focusTransitionMs: number;
  selectionEmphasisMs: number;
  layoutTransitionMs: number;
  groupFocusTransitionMs: number;
}

export interface VisualStateToken {
  elementKind: VisualElementKind;
  stateKind: VisualStateKind;
  theme: GraphTheme;
  fillColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  opacity: number;
  shape: string;
  nonColorCue: string[];
}

interface NodeVisualStateInput {
  type: string;
  status: string;
  invalid?: boolean;
}

interface NodeVisualStateOptions {
  theme?: string;
  stateKind?: Exclude<VisualStateKind, 'grouped'>;
}

interface ClusterVisualStateOptions {
  theme?: string;
  isManual?: boolean;
}

export const GRAPH_MOTION_PROFILE: MotionProfile = {
  focusTransitionMs: 300,
  selectionEmphasisMs: 300,
  layoutTransitionMs: 500,
  groupFocusTransitionMs: 500,
};

export function resolveGraphTheme(theme?: string): GraphTheme {
  return theme === 'dark' ? 'dark' : 'light';
}

export function getNodeVisualState(
  node: NodeVisualStateInput,
  options: NodeVisualStateOptions = {},
): VisualStateToken {
  const theme = resolveGraphTheme(options.theme);
  const themeTokens = getGraphThemeTokens(theme);
  const baseBorder = getStatusBorder(node);
  const stateKind = node.invalid ? 'invalid' : (options.stateKind ?? 'default');
  const fillColor = getNodeColor(node.type);

  let borderWidth = baseBorder.width;
  let borderStyle = baseBorder.style;
  let borderColor = baseBorder.color;
  let opacity = 1;
  const nonColorCue = new Set<string>();

  if (stateKind === 'selected') {
    borderWidth = Math.max(borderWidth + 1, 4);
    nonColorCue.add('thick-border');
  }

  if (stateKind === 'highlighted') {
    opacity = 1;
    nonColorCue.add('full-opacity');
  }

  if (stateKind === 'dimmed') {
    opacity = 0.15;
    nonColorCue.add('reduced-opacity');
  }

  if (stateKind === 'invalid') {
    borderStyle = 'dashed';
    borderColor = '#FF9800';
    borderWidth = Math.max(borderWidth, 2);
    nonColorCue.add('dashed-border');
  }

  return {
    elementKind: 'node',
    stateKind,
    theme,
    fillColor,
    textColor: themeTokens.nodeText,
    borderColor,
    borderWidth,
    borderStyle,
    opacity,
    shape: 'ellipse',
    nonColorCue: [...nonColorCue],
  };
}

export function getClusterVisualState(
  options: ClusterVisualStateOptions = {},
): VisualStateToken {
  const theme = resolveGraphTheme(options.theme);
  const themeTokens = getGraphThemeTokens(theme);
  const isManual = options.isManual ?? false;

  return {
    elementKind: 'cluster',
    stateKind: 'grouped',
    theme,
    fillColor: themeTokens.clusterFill,
    textColor: themeTokens.nodeText,
    borderColor: themeTokens.clusterBorder,
    borderWidth: 1,
    borderStyle: isManual ? 'solid' : 'dashed',
    opacity: 1,
    shape: 'roundrectangle',
    nonColorCue: ['container-shape', isManual ? 'solid-border' : 'dashed-border'],
  };
}
