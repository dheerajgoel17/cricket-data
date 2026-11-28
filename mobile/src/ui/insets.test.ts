import { TAB_BAR_HEIGHT } from "@/ui/tokens";
import { useScreenInsets } from "@/ui/insets";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 12, left: 0, right: 0 }),
}));

test("a tab screen reserves room for the floating dock and bottom safe area", () => {
  expect(useScreenInsets()).toEqual({ top: 20, bottom: TAB_BAR_HEIGHT + 12 });
});

test("a detail page leaves the home indicator's room", () => {
  expect(useScreenInsets(false)).toEqual({ top: 20, bottom: 12 });
});
