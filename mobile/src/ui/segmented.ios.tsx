import * as Haptics from "expo-haptics";
import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import type { SegmentedProps } from "@/ui/segmented";

/** iOS: the system segmented control (SwiftUI `Picker`), so it looks and animates like Apple's, glass included on iOS 26. */
export function Segmented<T extends string>({ items, value, onChange, label, width, height = 36 }: SegmentedProps<T>) {
  return (
    <Host style={{ width: width ?? "100%", height }}>
      <Picker
        modifiers={[pickerStyle("segmented")]}
        label={label}
        selection={value}
        onSelectionChange={(v) => { if (v !== value) { void Haptics.selectionAsync(); onChange(v as T); } }}>
        {items.map(([id, text]) => <Text key={id} modifiers={[tag(id)]}>{text}</Text>)}
      </Picker>
    </Host>
  );
}
