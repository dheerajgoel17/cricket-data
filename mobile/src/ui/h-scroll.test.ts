import { edgeOpacity } from "./h-scroll";

jest.mock("react-native-reanimated", () => ({}));

test("scroll edges fade in proportion to the hidden content", () => {
  expect(edgeOpacity(-5, 14)).toBe(0);
  expect(edgeOpacity(0, 14)).toBe(0);
  expect(edgeOpacity(7, 14)).toBe(0.5);
  expect(edgeOpacity(14, 14)).toBe(1);
  expect(edgeOpacity(100, 14)).toBe(1);
});
