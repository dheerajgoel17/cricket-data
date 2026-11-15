import { useScreenInsets } from "@/ui/insets";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 12, left: 0, right: 0 }),
}));

test("a tab screen ends at the docked tab bar, which holds the bottom safe area itself", () => {
  expect(useScreenInsets()).toEqual({ top: 20, bottom: 0 });
});

test("a detail page leaves the home indicator's room", () => {
  expect(useScreenInsets(false)).toEqual({ top: 20, bottom: 12 });
});
