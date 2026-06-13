import * as React from 'react';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';

import { ScoreRing } from '../ScoreRing';

function render(el: React.ReactElement): ReactTestRenderer {
  let root!: ReactTestRenderer;
  act(() => { root = renderer.create(el); });
  return root;
}

function findCircles(node: any): any[] {
  if (!node) return [];
  const self = node.type === 'RNSVGCircle' ? [node] : [];
  const children = Array.isArray(node.children) ? node.children : [];
  return [...self, ...children.flatMap(findCircles)];
}

const STROKE = Math.max(2, 40 * 0.06);

it('renders the score arc as rating/10 of the circumference', () => {
  const tree = render(<ScoreRing rating={7.8} size={40} />).toJSON();
  const circles = findCircles(tree);
  // Track + arc
  expect(circles).toHaveLength(2);
  const arc = circles[1];
  const radius = (40 - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const [dash, gap] = arc.props.strokeDasharray.map(Number);
  expect(dash).toBeCloseTo(circumference * 0.78);
  expect(gap).toBeCloseTo(circumference);
});

it('omits the arc entirely at rating 0', () => {
  const tree = render(<ScoreRing rating={0} size={40} />).toJSON();
  expect(findCircles(tree)).toHaveLength(1);
});

it('shows the formatted score in the center', () => {
  const tree = render(<ScoreRing rating={9.2} size={40} />);
  expect(JSON.stringify(tree.toJSON())).toContain('9.2');
});

it('locked: draws track only and shows a muted dash, no arc, no number', () => {
  const tree = render(<ScoreRing rating={8.4} size={56} locked />);
  const json = tree.toJSON();
  // Only the track circle, no score arc.
  expect(findCircles(json)).toHaveLength(1);
  const str = JSON.stringify(json);
  expect(str).toContain('–');
  expect(str).not.toContain('8.4');
});

it('selected: filled disc with white score and no svg ring', () => {
  const tree = render(<ScoreRing rating={6.1} size={30} selected />);
  const json = tree.toJSON();
  expect(findCircles(json)).toHaveLength(0);
  expect(JSON.stringify(json)).toContain('6.1');
});
