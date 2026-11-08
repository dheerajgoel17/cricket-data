import { Platform } from "react-native";
import { useScreenInsets } from "@/ui/insets";
import { TAB_BAR_HEIGHT } from "@/ui/tokens";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 12, left: 0, right: 0 }),
}));

const originalPlatform = Platform.OS;
afterEach(() => { Platform.OS = originalPlatform; });

test.each(["android", "web"] as const)("%s reserves room for the floating tabs only on tab screens", (os) => {
  Platform.OS = os;
  expect(useScreenInsets()).toEqual({ top: 20, bottom: 12 + TAB_BAR_HEIGHT + 24 });
  expect(useScreenInsets(false)).toEqual({ top: 20, bottom: 12 });
});

test("iOS uses the system-provided bottom inset", () => {
  Platform.OS = "ios";
  expect(useScreenInsets()).toEqual({ top: 20, bottom: 12 });
});
