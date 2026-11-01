// Entry point: the runtime polyfills must be in place before any engine module loads, so they come first.
import "./src/lib/polyfills";
import "expo-router/entry";
