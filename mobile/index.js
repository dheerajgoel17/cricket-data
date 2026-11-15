// Entry point: the runtime polyfills must be in place before any engine module loads, so they come first.
import "./src/lib/perf";
import "./src/lib/polyfills";
import { setImgCdn } from "@cricket/engine/photos.js";
import { IMG_CDN } from "./src/lib/config";
setImgCdn(IMG_CDN);
import "expo-router/entry";
