(function() {
  "use strict";
  function globalSingleton(name, create) {
    const key = Symbol.for(`@capacitor/native-islands/${name}`);
    const scope = globalThis;
    const existing = scope[key];
    if (existing !== void 0)
      return existing;
    const value = create();
    scope[key] = value;
    return value;
  }
  const contracts = globalSingleton("contracts/v1", () => /* @__PURE__ */ new Map());
  function registerIslandContract(nativeComponent, contract) {
    const existing = contracts.get(nativeComponent);
    if (!existing) {
      contracts.set(nativeComponent, contract);
      return;
    }
    if (JSON.stringify(existing) !== JSON.stringify(contract)) {
      throw new Error(`Native component "${nativeComponent}" is already registered by <${existing.tagName}>.`);
    }
  }
  function islandContract(nativeComponent) {
    return contracts.get(nativeComponent);
  }
  const PROTOCOL_VERSION = 2;
  const BRIDGE_LIMITS = {
    requestBytes: 16384,
    identifierBytes: 64,
    commandBytes: 128,
    coordinateMagnitudeCssPixels: 16777216,
    sizeCssPixels: 65536
  };
  function createEnvelope() {
    return {
      protocolVersion: PROTOCOL_VERSION
    };
  }
  function createWebTransport() {
    return {
      available: false,
      async applyLayout() {
        return void 0;
      },
      async command() {
        return void 0;
      },
      reset() {
        return void 0;
      },
      on() {
        return () => void 0;
      }
    };
  }
  function round2(value) {
    return Math.round(value * 100) / 100;
  }
  function uniformCssCornerRadius(corners) {
    if (corners.length !== 4)
      return null;
    const radii = corners.map((corner) => {
      const match = corner.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/);
      return match ? Number(match[1]) : Number.NaN;
    });
    if (!radii.every(Number.isFinite))
      return null;
    const radius = round2(radii[0]);
    return radii.every((value) => Math.abs(value - radius) < 0.01) ? radius : null;
  }
  function docRect(element) {
    const bounds = element.getBoundingClientRect();
    return {
      x: round2(bounds.left + window.scrollX),
      y: round2(bounds.top + window.scrollY),
      w: round2(bounds.width),
      h: round2(bounds.height)
    };
  }
  function isSafeBridgeRect(rect) {
    const radius = rect.r ?? 0;
    return [rect.x, rect.y, rect.w, rect.h, radius].every(Number.isFinite) && Math.abs(rect.x) <= BRIDGE_LIMITS.coordinateMagnitudeCssPixels && Math.abs(rect.y) <= BRIDGE_LIMITS.coordinateMagnitudeCssPixels && rect.w > 0 && rect.w <= BRIDGE_LIMITS.sizeCssPixels && rect.h > 0 && rect.h <= BRIDGE_LIMITS.sizeCssPixels && radius >= 0 && radius <= BRIDGE_LIMITS.sizeCssPixels;
  }
  function intersects(left, right) {
    return left.x < right.x + right.w && right.x < left.x + left.w && left.y < right.y + right.h && right.y < left.y + left.h;
  }
  const CONTAINMENT_EPSILON = 0.5;
  function contains(outer, inner) {
    return inner.x >= outer.x - CONTAINMENT_EPSILON && inner.y >= outer.y - CONTAINMENT_EPSILON && inner.x + inner.w <= outer.x + outer.w + CONTAINMENT_EPSILON && inner.y + inner.h <= outer.y + outer.h + CONTAINMENT_EPSILON;
  }
  function partialOverlap(left, right) {
    return intersects(left, right) && !contains(left, right) && !contains(right, left);
  }
  function opaqueContainsRect(outer, inner) {
    if (!contains(outer, inner))
      return false;
    const radius = Math.min(outer.r ?? 0, outer.w / 2, outer.h / 2);
    if (radius <= 0)
      return true;
    const corners = [
      [inner.x, inner.y],
      [inner.x + inner.w, inner.y],
      [inner.x, inner.y + inner.h],
      [inner.x + inner.w, inner.y + inner.h]
    ];
    return corners.every(([x, y], index) => {
      const left = index === 0 || index === 2;
      const top = index < 2;
      const centerX = left ? outer.x + radius : outer.x + outer.w - radius;
      const centerY = top ? outer.y + radius : outer.y + outer.h - radius;
      const insideCorner = (left ? x < centerX : x > centerX) && (top ? y < centerY : y > centerY);
      return !insideCorner || (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
    });
  }
  function hasComplexOpaqueShape(rect) {
    return Boolean(rect.r && rect.r > 0);
  }
  function isAxisAlignedTransform(transform) {
    if (!transform || transform === "none")
      return true;
    const match = transform.match(/^matrix(3d)?\(([^)]+)\)$/);
    if (!match)
      return false;
    const values = match[2].split(",").map((value) => Number(value.trim()));
    const nearZero = (value) => Math.abs(value) < 1e-5;
    const nearOne = (value) => Math.abs(value - 1) < 1e-5;
    if (!match[1] && values.length === 6) {
      return values.every(Number.isFinite) && nearOne(values[0]) && nearZero(values[1]) && nearZero(values[2]) && nearOne(values[3]);
    }
    if (match[1] && values.length === 16 && values.every(Number.isFinite)) {
      return nearOne(values[0]) && nearZero(values[1]) && nearZero(values[2]) && nearZero(values[3]) && nearZero(values[4]) && nearOne(values[5]) && nearZero(values[6]) && nearZero(values[7]) && nearZero(values[8]) && nearZero(values[9]) && nearOne(values[10]) && nearZero(values[11]) && nearZero(values[14]) && nearOne(values[15]);
    }
    return false;
  }
  function label(el) {
    const id = el.id ? `#${el.id}` : "";
    const classes = Array.from(el.classList).slice(0, 2).map((name) => `.${name}`).join("");
    return `${el.tagName.toLowerCase()}${id}${classes}`;
  }
  function clips(style) {
    const values = [style.overflowX, style.overflowY];
    return values.some((value) => value === "hidden" || value === "clip");
  }
  function scrolls(el, style) {
    const scrollable = (value) => value === "auto" || value === "scroll";
    return scrollable(style.overflowX) && el.scrollWidth > el.clientWidth + 1 || scrollable(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
  }
  function clipsThroughPaintContainment(style) {
    return /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(style.getPropertyValue("contain").trim());
  }
  function hasUnsupportedClipEdge(style) {
    const hasBorder = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some((value) => Number.parseFloat(value) > 0);
    const clipMargin = style.getPropertyValue("overflow-clip-margin").trim();
    return hasBorder || clipMargin !== "" && clipMargin !== "0" && clipMargin !== "0px";
  }
  function markedLayerPaintEscapes(el, style) {
    const ownOutsetPaint = style.boxShadow !== "" && style.boxShadow !== "none" || style.textShadow !== "" && style.textShadow !== "none" || style.outlineStyle !== "" && style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0 || propertyIsActive(style, "filter");
    const visibleOverflow = style.overflowX === "visible" && el.scrollWidth > el.clientWidth + 1 || style.overflowY === "visible" && el.scrollHeight > el.clientHeight + 1;
    return ownOutsetPaint || visibleOverflow;
  }
  function clipOpaqueShapeContains(node, style, islandRect) {
    const bounds = node.getBoundingClientRect();
    const radius = uniformCssCornerRadius([
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius
    ]);
    if (radius === null)
      return false;
    const outer = {
      x: bounds.left,
      y: bounds.top,
      w: bounds.right - bounds.left,
      h: bounds.bottom - bounds.top,
      r: radius
    };
    const inner = {
      x: islandRect.left,
      y: islandRect.top,
      w: islandRect.right - islandRect.left,
      h: islandRect.bottom - islandRect.top
    };
    return opaqueContainsRect(outer, inner);
  }
  function composedParentElement(element) {
    if (typeof HTMLElement !== "undefined" && element instanceof HTMLElement && element.assignedSlot) {
      return element.assignedSlot;
    }
    if (element.parentElement)
      return element.parentElement;
    if (typeof element.getRootNode !== "function")
      return null;
    const root = element.getRootNode();
    return typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot && typeof HTMLElement !== "undefined" && root.host instanceof HTMLElement ? root.host : null;
  }
  function propertyIsActive(style, name, initial = "none") {
    const value = style.getPropertyValue(name).trim();
    return value !== "" && value !== initial;
  }
  function isSupportedIndividualTranslate(style) {
    const value = style.getPropertyValue("translate").trim();
    if (value === "" || value === "none")
      return true;
    const parts = value.split(/\s+/);
    if (parts.length <= 2)
      return true;
    return parts.length === 3 && /^[+-]?(?:0+(?:\.0*)?|\.(?:0+))(?:px)?$/i.test(parts[2]);
  }
  function hasMotionPath(style) {
    const offsetRotate = style.getPropertyValue("offset-rotate").trim();
    const defaultOffsetRotate = offsetRotate === "" || offsetRotate === "auto" || offsetRotate === "auto 0deg";
    return propertyIsActive(style, "offset-path") || !defaultOffsetRotate;
  }
  function colorAlpha(value) {
    const color = value.trim().toLowerCase();
    if (color === "transparent")
      return 0;
    const body = color.match(/^[a-z]+\((.*)\)$/)?.[1];
    if (!body)
      return null;
    const slashAlpha = body.match(/\/\s*([+-]?(?:\d+\.?\d*|\.\d+)%?)(?:\s|$)/)?.[1];
    const commaParts = body.split(",").map((part) => part.trim());
    const alpha = slashAlpha ?? (commaParts.length === 4 ? commaParts[3] : null);
    if (alpha === null)
      return 1;
    const parsed = Number.parseFloat(alpha);
    if (!Number.isFinite(parsed))
      return null;
    return Math.min(1, Math.max(0, alpha.endsWith("%") ? parsed / 100 : parsed));
  }
  function backgroundColorClip(style) {
    const clips2 = style.backgroundClip.split(",").map((value) => value.trim()).filter(Boolean);
    return clips2[clips2.length - 1] ?? "border-box";
  }
  function hasSparsePaint(el, style) {
    const paintedElementNames = /* @__PURE__ */ new Set(["BUTTON", "CANVAS", "IFRAME", "IMG", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);
    if (paintedElementNames.has(el.tagName))
      return true;
    if (Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent?.trim().length ?? 0) > 0) && (colorAlpha(style.color) ?? 0) > 0) {
      return true;
    }
    if (Array.from(el.children).some((child) => ["CANVAS", "IFRAME", "IMG", "SVG", "VIDEO"].includes(child.tagName))) {
      return true;
    }
    const hasBorder = [
      [style.borderTopWidth, style.borderTopColor],
      [style.borderRightWidth, style.borderRightColor],
      [style.borderBottomWidth, style.borderBottomColor],
      [style.borderLeftWidth, style.borderLeftColor]
    ].some(([width, color]) => Number.parseFloat(width) > 0 && (colorAlpha(color) ?? 0) > 0);
    return hasBorder || style.boxShadow !== "" && style.boxShadow !== "none" || style.textShadow !== "" && style.textShadow !== "none" || style.outlineStyle !== "" && style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
  }
  function automaticWebLayerCutoutIssue(el) {
    const style = getComputedStyle(el);
    const alpha = colorAlpha(style.backgroundColor);
    const hasImage = style.backgroundImage !== "" && style.backgroundImage !== "none";
    if ((alpha === 0 || alpha === null) && !hasImage && !hasSparsePaint(el, style))
      return void 0;
    if (alpha !== 1 || backgroundColorClip(style) !== "border-box") {
      return {
        reason: "sparse, translucent, or partially painted web content cannot use a box-shaped native cutout",
        mayMoveWithoutRefresh: false
      };
    }
    return auditWebLayerCutoutComposition(el);
  }
  function auditWebLayerCutoutComposition(el) {
    const layerRect = el.getBoundingClientRect();
    let node = el;
    while (node) {
      const style = getComputedStyle(node);
      const isViewportRoot = node === document.body || node === document.documentElement;
      const zoom = style.getPropertyValue("zoom").trim();
      if (style.position === "fixed" || style.position === "sticky") {
        return {
          reason: "fixed and sticky web layers cannot use document-space native cutouts",
          mayMoveWithoutRefresh: true
        };
      }
      if (Number.parseFloat(style.opacity) !== 1 || propertyIsActive(style, "filter") || propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter") || (style.getPropertyValue("mix-blend-mode").trim() || "normal") !== "normal" || propertyIsActive(style, "clip-path") || propertyIsActive(style, "mask-image") || propertyIsActive(style, "-webkit-mask-image")) {
        return {
          reason: "translucent, filtered, blended, clipped, or masked web layers cannot use box-shaped native cutouts",
          mayMoveWithoutRefresh: false
        };
      }
      if (!isAxisAlignedTransform(style.transform) || !isSupportedIndividualTranslate(style) || propertyIsActive(style, "scale") || propertyIsActive(style, "rotate") || propertyIsActive(style, "perspective") || hasMotionPath(style) || zoom !== "" && zoom !== "1" && zoom !== "normal") {
        return {
          reason: "opaque web surface coordinates are unsafe under 3D translation, scale, rotation, skew, perspective, motion paths, or zoom",
          mayMoveWithoutRefresh: false
        };
      }
      if (node === el && markedLayerPaintEscapes(el, style)) {
        return {
          reason: "web surfaces with out-of-bounds paint or visible overflow cannot use a box-bounded cutout",
          mayMoveWithoutRefresh: false
        };
      }
      if (!isViewportRoot && scrolls(node, style)) {
        return {
          reason: "opaque web surface coordinates are unsafe inside an independent web scroll container",
          mayMoveWithoutRefresh: true
        };
      }
      const overflowClips = clips(style);
      const paintContains = clipsThroughPaintContainment(style);
      if (node !== el && !isViewportRoot && (overflowClips || paintContains) && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, layerRect))) {
        return {
          reason: `opaque web surface coordinates are unsafe under a partially clipping ${paintContains ? "paint-containment" : "overflow"} ancestor`,
          mayMoveWithoutRefresh: false
        };
      }
      node = composedParentElement(node);
    }
    return null;
  }
  function auditIslandComposition(island, el) {
    const issues = [];
    const islandRect = el.getBoundingClientRect();
    let node = el;
    while (node) {
      const style = getComputedStyle(node);
      const element = label(node);
      const isViewportRoot = node === document.body || node === document.documentElement;
      if (!isAxisAlignedTransform(style.transform)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element,
          message: "scale, rotation, skew, or perspective cannot be replayed by the native host"
        });
        break;
      }
      if (!isSupportedIndividualTranslate(style)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element,
          message: "three-dimensional CSS translation cannot be replayed by the native host"
        });
        break;
      }
      if (propertyIsActive(style, "scale") || propertyIsActive(style, "rotate")) {
        issues.push({
          code: "non_axis_transform",
          island,
          element,
          message: "CSS scale and rotation cannot be replayed by the native host"
        });
        break;
      }
      if (hasMotionPath(style)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element,
          message: "CSS motion paths cannot be replayed by the native host"
        });
        break;
      }
      const zoom = style.getPropertyValue("zoom").trim();
      if (zoom !== "" && zoom !== "1" && zoom !== "normal") {
        issues.push({
          code: "non_axis_transform",
          island,
          element,
          message: "CSS zoom cannot be replayed by the native host"
        });
        break;
      }
      const opacity = Number.parseFloat(style.opacity);
      if (opacity === 0) {
        issues.push({
          code: "zero_opacity",
          island,
          element,
          message: "zero-opacity content is not visible"
        });
        break;
      }
      if (Number.isFinite(opacity) && opacity < 1 || propertyIsActive(style, "filter") || propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter") || propertyIsActive(style, "mix-blend-mode", "normal") || propertyIsActive(style, "perspective")) {
        issues.push({
          code: "unsupported_visual_effect",
          island,
          element,
          message: "opacity, filters, blending, and perspective cannot be inherited by the detached native host"
        });
        break;
      }
      const mask = style.maskImage || style.getPropertyValue("-webkit-mask-image");
      if (style.clipPath !== "none" || mask && mask !== "none") {
        issues.push({
          code: "css_clip_or_mask",
          island,
          element,
          message: "CSS clip-path and masks are not supported for a native island"
        });
        break;
      }
      if (node !== el && !isViewportRoot && scrolls(node, style)) {
        issues.push({
          code: "independent_scroll_container",
          island,
          element,
          message: "independent web scroll containers are not supported; use document scrolling or the web fallback"
        });
        break;
      }
      const overflowClips = clips(style);
      const paintContains = clipsThroughPaintContainment(style);
      if (node !== el && !isViewportRoot && (overflowClips || paintContains) && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, islandRect))) {
        issues.push({
          code: "overflow_clip",
          island,
          element,
          message: `native host cannot inherit a partially clipping ${paintContains ? "paint-containment" : "overflow"} ancestor`
        });
        break;
      }
      node = composedParentElement(node);
    }
    return issues;
  }
  class NativeIslandError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "NativeIslandError";
    }
  }
  const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9._:-]*$/;
  const COMMAND = /^[A-Za-z][A-Za-z0-9._-]*$/;
  const encoder = new TextEncoder();
  const MAX_JSON_DEPTH = 32;
  function byteLength(value) {
    return encoder.encode(value).length;
  }
  function hasSupportedDepth(value, depth = 0) {
    if (depth > MAX_JSON_DEPTH)
      return false;
    if (value === null || typeof value !== "object")
      return true;
    if (Array.isArray(value)) {
      return value.every((child) => hasSupportedDepth(child, depth + 1));
    }
    return Object.values(value).every((child) => hasSupportedDepth(child, depth + 1));
  }
  function validateCommand(island, nativeComponent, command, properties) {
    if (!IDENTIFIER.test(island) || byteLength(island) > BRIDGE_LIMITS.identifierBytes) {
      throw new NativeIslandError("invalid_request", "Invalid native island id.");
    }
    if (!IDENTIFIER.test(nativeComponent) || byteLength(nativeComponent) > BRIDGE_LIMITS.identifierBytes) {
      throw new NativeIslandError("invalid_request", "Invalid native component name.");
    }
    if (!COMMAND.test(command) || byteLength(command) > BRIDGE_LIMITS.commandBytes) {
      throw new NativeIslandError("invalid_request", "Invalid native command.");
    }
    const contract = islandContract(nativeComponent);
    if (contract && !contract.commands.includes(command)) {
      throw new NativeIslandError("unknown_command", `Command "${command}" is not registered for "${nativeComponent}".`);
    }
    if (properties === void 0)
      return;
    if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
      throw new NativeIslandError("invalid_request", "Native island properties must be a JSON object.");
    }
    let json;
    let wireValue;
    try {
      json = JSON.stringify(properties);
      wireValue = json === void 0 ? void 0 : JSON.parse(json);
    } catch {
      throw new NativeIslandError("invalid_request", "Native island properties must be JSON-compatible.");
    }
    if (json === void 0 || !hasSupportedDepth(wireValue)) {
      throw new NativeIslandError("invalid_request", "Native island properties must be JSON-compatible at depth 32 or less.");
    }
    if (byteLength(json) > BRIDGE_LIMITS.requestBytes) {
      throw new NativeIslandError("payload_too_large", `Native island properties exceed ${BRIDGE_LIMITS.requestBytes} bytes.`);
    }
  }
  const HYDRATION_PROBE_FRAMES = 120;
  function isCustomElement(element) {
    return element.localName.includes("-");
  }
  class CompositionObserver {
    constructor(invalidate, ignoreMutation = () => false, onOpenRoot = () => void 0) {
      this.invalidate = invalidate;
      this.ignoreMutation = ignoreMutation;
      this.onOpenRoot = onOpenRoot;
      this.ancestors = /* @__PURE__ */ new Set();
      this.roots = /* @__PURE__ */ new Map();
      this.hydrationWatches = /* @__PURE__ */ new Map();
      this.pendingDefinitions = /* @__PURE__ */ new Map();
      this.hydrationFrameScheduled = false;
    }
    sync(elements) {
      const ancestors = /* @__PURE__ */ new Set();
      const desiredRoots = /* @__PURE__ */ new Set();
      for (const element of elements) {
        let ancestor = composedParentElement(element);
        const visited = /* @__PURE__ */ new Set();
        while (ancestor && !visited.has(ancestor)) {
          visited.add(ancestor);
          if (isCustomElement(ancestor)) {
            ancestors.add(ancestor);
            if (ancestor.shadowRoot)
              desiredRoots.add(ancestor.shadowRoot);
          }
          ancestor = composedParentElement(ancestor);
        }
      }
      this.ancestors = ancestors;
      for (const element of Array.from(this.hydrationWatches.keys())) {
        if (!ancestors.has(element))
          this.hydrationWatches.delete(element);
      }
      for (const [root, observation] of this.roots) {
        if (desiredRoots.has(root))
          continue;
        observation.observer.disconnect();
        root.removeEventListener("slotchange", observation.slotChange, true);
        this.roots.delete(root);
      }
      for (const root of desiredRoots)
        this.observeRoot(root);
      for (const ancestor of ancestors) {
        if (ancestor.shadowRoot) {
          this.hydrationWatches.delete(ancestor);
          continue;
        }
        this.watchAfterUpgrade(ancestor);
      }
    }
    observeRoot(root) {
      if (this.roots.has(root))
        return;
      const observer = new MutationObserver((records) => {
        if (records.length > 0 && records.every((record) => this.ignoreMutation(record)))
          return;
        this.invalidate();
      });
      observer.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      const slotChange = () => this.invalidate();
      root.addEventListener("slotchange", slotChange, true);
      this.roots.set(root, { observer, slotChange });
      this.onOpenRoot(root);
    }
    watchAfterUpgrade(element) {
      if (typeof customElements === "undefined")
        return;
      const name = element.localName;
      if (customElements.get(name)) {
        this.armHydrationWatch(element);
        return;
      }
      let definition = this.pendingDefinitions.get(name);
      if (!definition) {
        definition = customElements.whenDefined(name);
        this.pendingDefinitions.set(name, definition);
      }
      void definition.then(() => {
        this.pendingDefinitions.delete(name);
        let upgradedAncestor = false;
        for (const ancestor of this.ancestors) {
          if (ancestor.localName !== name)
            continue;
          upgradedAncestor = true;
          if (ancestor.shadowRoot)
            this.observeRoot(ancestor.shadowRoot);
          else
            this.armHydrationWatch(ancestor);
        }
        if (upgradedAncestor)
          this.invalidate();
      });
    }
    armHydrationWatch(element) {
      if (!this.ancestors.has(element) || this.hydrationWatches.has(element))
        return;
      this.hydrationWatches.set(element, HYDRATION_PROBE_FRAMES);
      this.scheduleHydrationFrame();
    }
    scheduleHydrationFrame() {
      if (this.hydrationFrameScheduled || this.hydrationWatches.size === 0)
        return;
      this.hydrationFrameScheduled = true;
      requestAnimationFrame(() => {
        this.hydrationFrameScheduled = false;
        let discoveredRoot = false;
        for (const [element, remaining] of this.hydrationWatches) {
          if (!this.ancestors.has(element) || !element.isConnected) {
            this.hydrationWatches.delete(element);
            continue;
          }
          if (element.shadowRoot) {
            this.hydrationWatches.delete(element);
            this.observeRoot(element.shadowRoot);
            discoveredRoot = true;
            continue;
          }
          if (remaining <= 1)
            this.hydrationWatches.delete(element);
          else
            this.hydrationWatches.set(element, remaining - 1);
        }
        if (discoveredRoot)
          this.invalidate();
        this.scheduleHydrationFrame();
      });
    }
  }
  let contextMemo = /* @__PURE__ */ new WeakMap();
  let nscMemo = /* @__PURE__ */ new WeakMap();
  function resetPaintOrderCache() {
    contextMemo = /* @__PURE__ */ new WeakMap();
    nscMemo = /* @__PURE__ */ new WeakMap();
  }
  function isFlexOrGridItem(el) {
    const parent = composedParentElement(el);
    if (!parent)
      return false;
    const display = getComputedStyle(parent).display;
    return display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid";
  }
  function hasEffectiveZIndex(el, style) {
    return style.zIndex !== "auto" && (style.position !== "static" || isFlexOrGridItem(el));
  }
  function establishesContext(el) {
    const cached = contextMemo.get(el);
    if (cached !== void 0)
      return cached;
    let result = false;
    if (el === document.documentElement) {
      result = true;
    } else {
      const cs = getComputedStyle(el);
      result = hasEffectiveZIndex(el, cs) || cs.position === "fixed" || cs.position === "sticky" || parseFloat(cs.opacity) < 1 || cs.transform !== "none" || cs.translate !== void 0 && cs.translate !== "none" && cs.translate !== "" || cs.perspective !== "none" || cs.filter !== "none" || cs.backdropFilter !== void 0 && cs.backdropFilter !== "none" && cs.backdropFilter !== "" || cs.mixBlendMode !== "normal" || cs.isolation === "isolate" || cs.clipPath !== void 0 && cs.clipPath !== "none" && cs.clipPath !== "" || /transform|opacity|filter|perspective|clip-path/.test(cs.willChange || "") || /paint|layout|strict|content/.test(cs.contain || "") || cs.containerType === "size" || cs.containerType === "inline-size";
    }
    contextMemo.set(el, result);
    return result;
  }
  function nearestContext(el) {
    const cached = nscMemo.get(el);
    if (cached !== void 0)
      return cached;
    let p = composedParentElement(el);
    while (p && !establishesContext(p))
      p = composedParentElement(p);
    nscMemo.set(el, p);
    return p;
  }
  function participationChain(el) {
    const chain = [el];
    let c = nearestContext(el);
    while (c) {
      chain.push(c);
      c = nearestContext(c);
    }
    return chain;
  }
  function stackLevel(el) {
    const cs = getComputedStyle(el);
    if (hasEffectiveZIndex(el, cs)) {
      const z = parseInt(cs.zIndex, 10);
      if (!Number.isNaN(z))
        return z;
    }
    return 0;
  }
  function paintPhase(el) {
    const cs = getComputedStyle(el);
    const level = stackLevel(el);
    if (level < 0)
      return 0;
    if (level > 0)
      return 5;
    if (establishesContext(el) || cs.position !== "static")
      return 4;
    if (cs.float !== void 0 && cs.float !== "none")
      return 2;
    if (/^(inline|inline-block|inline-flex|inline-grid|ruby)/.test(cs.display))
      return 3;
    return 1;
  }
  function compareComposedTreeOrder(a, b) {
    const chainA = [];
    const chainB = [];
    let current = a;
    while (current) {
      chainA.push(current);
      current = composedParentElement(current);
    }
    current = b;
    while (current) {
      chainB.push(current);
      current = composedParentElement(current);
    }
    const positionsB = new Map(chainB.map((element, index) => [element, index]));
    const commonIndexA = chainA.findIndex((element) => positionsB.has(element));
    if (commonIndexA < 0)
      return 0;
    const common = chainA[commonIndexA];
    const commonIndexB = positionsB.get(common);
    if (commonIndexB === void 0)
      return 0;
    if (commonIndexA === 0)
      return -1;
    if (commonIndexB === 0)
      return 1;
    const branchA = chainA[commonIndexA - 1];
    const branchB = chainB[commonIndexB - 1];
    if (branchA === branchB)
      return 0;
    const commonDisplay = getComputedStyle(common).display;
    if (/^(?:inline-)?(?:flex|grid)$/.test(commonDisplay)) {
      const orderA = Number.parseInt(getComputedStyle(branchA).order, 10) || 0;
      const orderB = Number.parseInt(getComputedStyle(branchB).order, 10) || 0;
      if (orderA !== orderB)
        return orderA - orderB;
    }
    const position = branchA.compareDocumentPosition(branchB);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING)
      return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING)
      return 1;
    return 0;
  }
  function comparePaintOrder(a, b) {
    if (a === b)
      return 0;
    const chainA = participationChain(a);
    const chainB = participationChain(b);
    const setB = new Set(chainB);
    let common = null;
    for (const e of chainA) {
      if (setB.has(e)) {
        common = e;
        break;
      }
    }
    if (!common)
      return 0;
    if (common === a)
      return -1;
    if (common === b)
      return 1;
    const repA = chainA[chainA.indexOf(common) - 1];
    const repB = chainB[chainB.indexOf(common) - 1];
    if (repA === repB)
      return 0;
    const la = stackLevel(repA);
    const lb = stackLevel(repB);
    if (la !== lb)
      return la - lb;
    const phaseA = paintPhase(repA);
    const phaseB = paintPhase(repB);
    if (phaseA !== phaseB)
      return phaseA - phaseB;
    return compareComposedTreeOrder(repA, repB);
  }
  const above = (a, b) => {
    const paintOrder = comparePaintOrder(a.el, b.el);
    if (paintOrder !== 0)
      return paintOrder > 0;
    return a.z !== b.z ? a.z > b.z : a.dom > b.dom;
  };
  function zIndex(el) {
    const value = Number.parseInt(getComputedStyle(el).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }
  function isElementVisible(el) {
    if (!el.isConnected || el.hidden || el.getClientRects().length === 0)
      return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.visibility !== "collapse" && Number.parseFloat(style.opacity) !== 0;
  }
  function fixedOrStickyAncestor(el) {
    let current = el;
    while (current) {
      const position = getComputedStyle(current).position;
      if (position === "fixed" || position === "sticky")
        return current;
      current = composedParentElement(current);
    }
    return null;
  }
  function inertAncestor(el) {
    let current = el;
    while (current) {
      if (current.inert || current.hasAttribute("inert"))
        return current;
      current = composedParentElement(current);
    }
    return null;
  }
  function effectImpactForProperty(propertyName) {
    if (/^(visibility|transform|transform-origin|transform-style|translate|scale|rotate|perspective|opacity|filter|backdrop-filter|mix-blend-mode|isolation|will-change|clip|clip-path|mask(?:-.+)?|offset-.+|border(?:-.+)?-radius|border-radius|z-index)$/i.test(propertyName)) {
      return "local-composition";
    }
    if (/^(color|accent-color|caret-color|background-color|border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?-color|outline-color|column-rule-color|text-decoration-color|text-emphasis-color)$/i.test(propertyName)) {
      return "none";
    }
    return "global-layout";
  }
  function normalizedCssPropertyName(propertyName) {
    return propertyName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
  function animationImpact(animation) {
    const transitionProperty = animation.transitionProperty;
    if (typeof transitionProperty === "string") {
      return effectImpactForProperty(transitionProperty);
    }
    const effect = animation.effect;
    if (typeof effect?.getKeyframes !== "function")
      return "global-layout";
    try {
      let impact = "none";
      for (const keyframe of effect.getKeyframes()) {
        for (const propertyName of Object.keys(keyframe)) {
          if (propertyName === "offset" || propertyName === "computedOffset" || propertyName === "easing" || propertyName === "composite") {
            continue;
          }
          const propertyImpact = effectImpactForProperty(normalizedCssPropertyName(propertyName));
          if (propertyImpact === "global-layout")
            return propertyImpact;
          if (propertyImpact === "local-composition")
            impact = propertyImpact;
        }
      }
      return impact;
    } catch {
      return "global-layout";
    }
  }
  function animationTarget(animation) {
    const target = animation.effect?.target;
    if (target instanceof Element)
      return target;
    const originatingElement = target?.element;
    return originatingElement instanceof Element ? originatingElement : null;
  }
  function isComposedAncestor(ancestor, element) {
    let current = element;
    const visited = /* @__PURE__ */ new Set();
    while (current && !visited.has(current)) {
      if (current === ancestor)
        return true;
      visited.add(current);
      current = composedParentElement(current);
    }
    return false;
  }
  class StackingService {
    constructor(onOpenRoot = () => void 0, automaticLayerCandidates = () => []) {
      this.automaticLayerCandidates = automaticLayerCandidates;
      this.compositionEnabled = false;
      this.natives = [];
      this.layers = [];
      this.onChange = null;
      this.mutationObserver = null;
      this.resizeObserver = null;
      this.scheduled = false;
      this.acknowledgedSignature = "";
      this.pendingSignature = null;
      this.planGeneration = 0;
      this.activeEffects = /* @__PURE__ */ new Map();
      this.watchedAnimations = /* @__PURE__ */ new WeakSet();
      this.effectRootDisposers = /* @__PURE__ */ new Map();
      this.automaticLayerClassifications = /* @__PURE__ */ new WeakMap();
      this.refresh = () => {
        if (this.scheduled)
          return;
        this.scheduled = true;
        requestAnimationFrame(() => {
          this.scheduled = false;
          const payload = this.resolve();
          const signature = JSON.stringify(payload);
          if (this.pendingSignature === null && signature === this.acknowledgedSignature) {
            return;
          }
          if (signature === this.pendingSignature)
            return;
          const generation = ++this.planGeneration;
          this.pendingSignature = signature;
          const apply = this.onChange?.(payload) ?? Promise.resolve();
          void apply.then(() => {
            if (generation !== this.planGeneration)
              return;
            this.pendingSignature = null;
            this.acknowledgedSignature = signature;
          }).catch(() => {
            if (generation === this.planGeneration)
              this.pendingSignature = null;
          });
        });
      };
      this.compositionObserver = new CompositionObserver(() => this.refresh(), void 0, onOpenRoot);
    }
    registerNative(handle) {
      if (this.natives.some((candidate) => candidate.el === handle.el))
        return;
      this.invalidatePendingPlan();
      this.natives.push(handle);
      this.resizeObserver?.observe(handle.el);
    }
    registerLayer(handle) {
      if (this.layers.some((candidate) => candidate.el === handle.el))
        return;
      this.invalidatePendingPlan();
      this.layers.push(handle);
      this.resizeObserver?.observe(handle.el);
      this.refresh();
    }
    findNative(id) {
      return this.natives.find((native) => native.islandId === id);
    }
    notifyTransportAvailable() {
      for (const handle of this.natives)
        handle.onTransportAvailable();
    }
    invalidateAutomaticLayers(root) {
      if (!root) {
        this.automaticLayerClassifications = /* @__PURE__ */ new WeakMap();
        return;
      }
      if (root instanceof HTMLElement)
        this.automaticLayerClassifications.delete(root);
      for (const element of root.querySelectorAll("*")) {
        this.automaticLayerClassifications.delete(element);
      }
    }
    unregister(el) {
      const nativeIndex = this.natives.findIndex((candidate) => candidate.el === el);
      if (nativeIndex >= 0) {
        this.invalidatePendingPlan();
        this.natives.splice(nativeIndex, 1);
      }
      const layerIndex = this.layers.findIndex((candidate) => candidate.el === el);
      if (layerIndex >= 0) {
        this.invalidatePendingPlan();
        this.layers.splice(layerIndex, 1);
      }
      this.resizeObserver?.unobserve(el);
      this.refresh();
    }
    start(onChange) {
      if (this.onChange)
        return;
      this.onChange = onChange;
      this.mutationObserver = new MutationObserver((records) => {
        let changed = false;
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (!target)
            continue;
          changed = true;
          if (target instanceof HTMLStyleElement || target instanceof HTMLLinkElement || target.closest("style") !== null) {
            this.invalidateAutomaticLayers();
          } else if (record.type !== "characterData") {
            this.invalidateAutomaticLayers(target);
          }
        }
        if (changed)
          this.refresh();
      });
      this.mutationObserver.observe(document.documentElement, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      this.resizeObserver = new ResizeObserver(() => this.refresh());
      this.resizeObserver.observe(document.documentElement);
      for (const native of this.natives)
        this.resizeObserver.observe(native.el);
      for (const layer of this.layers)
        this.resizeObserver.observe(layer.el);
      this.observeEffectRoot(document);
      this.refresh();
    }
    observeEffectRoot(root) {
      if (this.effectRootDisposers.has(root))
        return;
      const target = root;
      const onTransitionRun = (event) => {
        if (event instanceof TransitionEvent) {
          this.beginEffect(event.target, `transition:${event.propertyName}`, effectImpactForProperty(event.propertyName));
        }
      };
      const onTransitionEnd = (event) => {
        if (event instanceof TransitionEvent) {
          this.endEffect(event.target, `transition:${event.propertyName}`);
        }
      };
      const onAnimationStart = (event) => {
        if (!(event instanceof AnimationEvent) || !(event.target instanceof Element))
          return;
        const animation = event.target.getAnimations().find((candidate) => candidate.animationName === event.animationName && (candidate.playState === "running" || candidate.pending));
        this.beginEffect(event.target, `animation:${event.animationName}`, animation ? animationImpact(animation) : "global-layout");
      };
      const onAnimationEnd = (event) => {
        if (event instanceof AnimationEvent) {
          this.endEffect(event.target, `animation:${event.animationName}`);
        }
      };
      const onLoad = (event) => {
        if (event.target instanceof HTMLLinkElement || event.target instanceof HTMLStyleElement) {
          this.invalidateAutomaticLayers();
        }
        this.refresh();
      };
      const onStyleStateChange = () => {
        this.invalidateAutomaticLayers();
        this.refresh();
      };
      const styleStateEvents = [
        "pointerover",
        "pointerout",
        "pointerdown",
        "pointerup",
        "pointercancel",
        "focusin",
        "focusout",
        "input",
        "change",
        "beforetoggle",
        "toggle"
      ];
      target.addEventListener("transitionrun", onTransitionRun, true);
      target.addEventListener("transitionend", onTransitionEnd, true);
      target.addEventListener("transitioncancel", onTransitionEnd, true);
      target.addEventListener("animationstart", onAnimationStart, true);
      target.addEventListener("animationend", onAnimationEnd, true);
      target.addEventListener("animationcancel", onAnimationEnd, true);
      target.addEventListener("load", onLoad, true);
      for (const eventName of styleStateEvents) {
        target.addEventListener(eventName, onStyleStateChange, true);
      }
      this.effectRootDisposers.set(root, () => {
        target.removeEventListener("transitionrun", onTransitionRun, true);
        target.removeEventListener("transitionend", onTransitionEnd, true);
        target.removeEventListener("transitioncancel", onTransitionEnd, true);
        target.removeEventListener("animationstart", onAnimationStart, true);
        target.removeEventListener("animationend", onAnimationEnd, true);
        target.removeEventListener("animationcancel", onAnimationEnd, true);
        target.removeEventListener("load", onLoad, true);
        for (const eventName of styleStateEvents) {
          target.removeEventListener(eventName, onStyleStateChange, true);
        }
      });
    }
    unobserveEffectRoot(root) {
      this.effectRootDisposers.get(root)?.();
      this.effectRootDisposers.delete(root);
    }
    beginEffect(target, key, impact) {
      if (!(target instanceof Element) || impact === "none")
        return;
      const effects = this.activeEffects.get(target) ?? /* @__PURE__ */ new Map();
      effects.set(key, impact);
      this.activeEffects.set(target, effects);
      this.refresh();
    }
    endEffect(target, key) {
      if (!(target instanceof Element))
        return;
      const effects = this.activeEffects.get(target);
      if (effects) {
        effects.delete(key);
        if (effects.size === 0)
          this.activeEffects.delete(target);
      }
      this.refresh();
    }
    watchAnimation(animation) {
      if (this.watchedAnimations.has(animation))
        return;
      this.watchedAnimations.add(animation);
      void animation.finished.then(this.refresh, this.refresh);
    }
    pruneDetachedEffects() {
      for (const element of this.activeEffects.keys()) {
        if (!element.isConnected)
          this.activeEffects.delete(element);
      }
    }
    collectRunningEffects() {
      const running = [];
      const seen = /* @__PURE__ */ new Set();
      const append = (animation) => {
        if (seen.has(animation) || animation.playState !== "running" && !animation.pending)
          return;
        seen.add(animation);
        const impact = animationImpact(animation);
        const target = animationTarget(animation);
        if (!target || impact === "none")
          return;
        this.watchAnimation(animation);
        running.push({ target, impact });
      };
      for (const animation of document.getAnimations())
        append(animation);
      const roots = /* @__PURE__ */ new Set();
      for (const handle of [...this.natives, ...this.layers]) {
        let current = handle.el;
        while (current) {
          const root = current.getRootNode();
          if (root instanceof ShadowRoot)
            roots.add(root);
          current = composedParentElement(current);
        }
      }
      for (const root of roots) {
        const getAnimations = root.getAnimations;
        if (typeof getAnimations === "function") {
          for (const animation of getAnimations.call(root))
            append(animation);
        }
      }
      for (const [target, effects] of this.activeEffects) {
        for (const impact of effects.values())
          running.push({ target, impact });
      }
      return running;
    }
    assessMotionSafety(layers) {
      const safety = {
        globalLayout: false,
        movingMarkedLayer: false,
        localCompositionTargets: /* @__PURE__ */ new Set()
      };
      for (const effect of this.collectRunningEffects()) {
        if (effect.impact === "global-layout")
          safety.globalLayout = true;
        else
          safety.localCompositionTargets.add(effect.target);
        if (layers.some((layer) => isComposedAncestor(effect.target, layer.el))) {
          safety.movingMarkedLayer = true;
        }
      }
      return safety;
    }
    invalidatePendingPlan() {
      if (this.pendingSignature !== null)
        this.acknowledgedSignature = "";
      this.planGeneration++;
      this.pendingSignature = null;
    }
    buildNatives(motion) {
      const states = this.natives.map((handle, dom) => {
        handle.reconcileObservedStyles();
        const composition = auditIslandComposition(handle.islandId, handle.el);
        let fallbackReason = null;
        let active = handle.canAttemptNative() && isElementVisible(handle.el);
        const fixedAncestor = handle.canAttemptNative() ? fixedOrStickyAncestor(handle.el) : null;
        if (fixedAncestor) {
          fallbackReason = "fixed and sticky ancestors cannot participate in document-layer composition";
          active = false;
        }
        const animatedAncestor = handle.canAttemptNative() && Array.from(motion.localCompositionTargets).some((target) => isComposedAncestor(target, handle.el));
        if (!fallbackReason && (motion.globalLayout || motion.movingMarkedLayer || animatedAncestor)) {
          fallbackReason = motion.globalLayout ? "active layout-affecting CSS transitions and animations use the web fallback until their final frame" : motion.movingMarkedLayer ? "active marked-layer CSS transitions and animations use the web fallback until their final frame" : "active island composition transitions and animations use the web fallback until their final frame";
          active = false;
        }
        const structuralIssue = composition[0];
        if (active && structuralIssue?.code === "zero_opacity") {
          active = false;
        } else if (active && structuralIssue) {
          fallbackReason = structuralIssue.message;
          active = false;
        }
        let rect = null;
        if (active) {
          const bounds = docRect(handle.el);
          const style = getComputedStyle(handle.el);
          const cssRadius = uniformCssCornerRadius([
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius
          ]);
          if (cssRadius === null) {
            fallbackReason = "native islands require a uniform pixel border-radius";
            active = false;
          } else {
            rect = { ...bounds, r: cssRadius ?? 0 };
            if (!isSafeBridgeRect(rect)) {
              fallbackReason = "native island geometry exceeds the shared safe coordinate or size range";
              active = false;
              rect = null;
            }
          }
        }
        return {
          handle,
          el: handle.el,
          z: zIndex(handle.el),
          dom,
          active,
          interactive: handle.interactive && getComputedStyle(handle.el).pointerEvents !== "none" && inertAncestor(handle.el) === null,
          rect,
          fallbackReason
        };
      });
      this.degradeUnsupportedOverlaps(states);
      return states;
    }
    degradeUnsupportedOverlaps(states) {
      for (let leftIndex = 0; leftIndex < states.length; leftIndex++) {
        const left = states[leftIndex];
        if (!left.active || !left.rect)
          continue;
        for (let rightIndex = leftIndex + 1; rightIndex < states.length; rightIndex++) {
          const right = states[rightIndex];
          if (!right.active || !right.rect)
            continue;
          const unsupportedPartialOverlap = partialOverlap(left.rect, right.rect) && (hasComplexOpaqueShape(left.rect) || hasComplexOpaqueShape(right.rect));
          const unsupportedRoundedContainment = hasComplexOpaqueShape(left.rect) && contains(left.rect, right.rect) && !opaqueContainsRect(left.rect, right.rect) || hasComplexOpaqueShape(right.rect) && contains(right.rect, left.rect) && !opaqueContainsRect(right.rect, left.rect);
          const unsupported = unsupportedPartialOverlap || unsupportedRoundedContainment;
          if (!unsupported)
            continue;
          const area = (state) => (state.rect?.w ?? 0) * (state.rect?.h ?? 0);
          const fallback = area(left) <= area(right) ? left : right;
          fallback.fallbackReason = "partially overlapping complex opaque regions require native path boolean support";
          fallback.active = false;
          fallback.rect = null;
        }
      }
    }
    buildLayers() {
      const explicitElements = new Set(this.layers.map((layer) => layer.el));
      const layers = this.layers.filter((layer) => layer.el.isConnected).map((layer, dom2) => {
        const style = getComputedStyle(layer.el);
        const radius = uniformCssCornerRadius([
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]);
        return {
          el: layer.el,
          z: zIndex(layer.el),
          dom: dom2,
          rect: { ...docRect(layer.el), r: radius ?? 0 },
          cutoutIssue: radius === null ? {
            reason: "declared opaque surfaces require a uniform pixel border-radius",
            mayMoveWithoutRefresh: false
          } : auditWebLayerCutoutComposition(layer.el)
        };
      });
      if (!this.compositionEnabled || this.natives.length === 0)
        return layers;
      const nativeElements = new Set(this.natives.map((native) => native.el));
      const nativeBounds = this.natives.filter((native) => native.el.isConnected).map((native) => ({
        el: native.el,
        z: zIndex(native.el),
        dom: 0,
        rect: docRect(native.el)
      }));
      let dom = layers.length;
      for (const element of this.automaticLayerCandidates()) {
        if (!element.isConnected || explicitElements.has(element) || nativeElements.has(element) || this.natives.some((native) => isComposedAncestor(element, native.el) || isComposedAncestor(native.el, element))) {
          continue;
        }
        const cached = this.automaticLayerClassifications.get(element);
        const issue = cached === void 0 ? automaticWebLayerCutoutIssue(element) : cached === false ? void 0 : cached;
        if (cached === void 0)
          this.automaticLayerClassifications.set(element, issue === void 0 ? false : issue);
        if (issue === void 0 || !isElementVisible(element))
          continue;
        const rect = docRect(element);
        const layer = {
          el: element,
          z: zIndex(element),
          dom: dom++,
          rect
        };
        if (!nativeBounds.some((native) => intersects(rect, native.rect) && above(layer, native)))
          continue;
        const style = getComputedStyle(element);
        const radius = uniformCssCornerRadius([
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]);
        layers.push({
          ...layer,
          rect: { ...rect, r: radius ?? 0 },
          cutoutIssue: radius === null ? {
            reason: "automatically detected web surfaces require a uniform pixel border-radius",
            mayMoveWithoutRefresh: false
          } : issue
        });
      }
      return layers;
    }
    detectLayerCoordinateConflicts(natives, layers) {
      if (!this.compositionEnabled)
        return;
      for (const layer of layers) {
        const issue = layer.cutoutIssue ?? (!isSafeBridgeRect(layer.rect) ? {
          reason: "opaque web surface geometry exceeds the shared safe coordinate or size range",
          mayMoveWithoutRefresh: false
        } : null);
        if (!issue)
          continue;
        for (const native of natives) {
          if (!native.active || !native.rect || !issue.mayMoveWithoutRefresh && !intersects(native.rect, layer.rect)) {
            continue;
          }
          const covered = layers.some((cover) => cover !== layer && cover.cutoutIssue === null && isElementVisible(cover.el) && above(cover, native) && opaqueContainsRect(cover.rect, layer.rect));
          if (covered)
            continue;
          native.fallbackReason = issue.reason;
          native.active = false;
          native.rect = null;
        }
      }
    }
    degradeOverlappingRoundedCutouts(natives, layers) {
      for (const native of natives) {
        if (!native.active || !native.rect)
          continue;
        const nativeRect = native.rect;
        const cutouts = layers.filter((layer) => layer.cutoutIssue === null && isElementVisible(layer.el) && above(layer, native) && intersects(layer.rect, nativeRect));
        const unsupported = cutouts.some((left, index) => cutouts.slice(index + 1).some((right) => intersects(left.rect, right.rect) && ((left.rect.r ?? 0) > 0 || (right.rect.r ?? 0) > 0)));
        if (!unsupported)
          continue;
        native.fallbackReason = "overlapping rounded web layers require native path union support";
        native.active = false;
        native.rect = null;
      }
    }
    syncCompositionFallbacks(natives) {
      for (const native of natives)
        native.handle.setCompositionFallback(native.fallbackReason);
    }
    resolve() {
      this.pruneDetachedEffects();
      resetPaintOrderCache();
      this.compositionObserver.sync([
        ...this.natives.map((handle) => handle.el),
        ...this.layers.map((handle) => handle.el)
      ]);
      const layers = this.buildLayers();
      const motion = this.assessMotionSafety(layers);
      const natives = this.buildNatives(motion);
      this.detectLayerCoordinateConflicts(natives, layers);
      this.degradeOverlappingRoundedCutouts(natives, layers);
      this.syncCompositionFallbacks(natives);
      const order = natives.filter((native) => native.active).slice().sort((a, b) => {
        if (above(a, b))
          return 1;
        if (above(b, a))
          return -1;
        return 0;
      }).map((native) => native.handle.islandId);
      const touchable = (layer) => {
        const style = getComputedStyle(layer.el);
        return style.visibility === "visible" && style.pointerEvents !== "none" && inertAncestor(layer.el) === null;
      };
      const cutouts = {};
      const exclusions = {};
      for (const native of natives) {
        if (!native.active || !native.rect)
          continue;
        const nativeRect = native.rect;
        cutouts[native.handle.islandId] = layers.filter((layer) => layer.cutoutIssue === null && isElementVisible(layer.el) && above(layer, native) && intersects(layer.rect, nativeRect)).map((layer) => layer.rect);
        const rects = layers.filter((layer) => touchable(layer) && above(layer, native) && intersects(layer.rect, nativeRect)).map((layer) => layer.rect);
        for (const other of natives) {
          if (other !== native && other.active && other.rect && above(other, native) && intersects(other.rect, native.rect)) {
            rects.push(other.rect);
          }
        }
        exclusions[native.handle.islandId] = rects;
      }
      const components = natives.filter((native) => !native.handle.degraded).map((native) => ({
        id: native.handle.islandId,
        type: native.handle.type,
        rect: native.rect === null ? null : {
          x: native.rect.x,
          y: native.rect.y,
          w: native.rect.w,
          h: native.rect.h,
          r: native.rect.r
        },
        interactive: native.interactive,
        active: native.active
      }));
      return {
        ...createEnvelope(),
        components,
        order,
        cutouts,
        exclusions
      };
    }
  }
  const LAYER_SELECTOR = "[data-native-islands-opaque-surface]";
  const NATIVE_ISLANDS_TRANSPORT_PRIORITY = {
    unavailable: 0,
    carrier: 10
  };
  const DEFAULT_INITIALIZATION = {
    identity: "custom",
    priority: NATIVE_ISLANDS_TRANSPORT_PRIORITY.carrier
  };
  class NativeIslandsRuntime {
    constructor() {
      this.transport = createWebTransport();
      this.stacking = new StackingService((root) => this.observeShadowRoot(root), () => this.knownElements);
      this.transportDisposers = [];
      this.knownLayers = /* @__PURE__ */ new WeakSet();
      this.knownElements = /* @__PURE__ */ new Set();
      this.transportPriority = Number.NEGATIVE_INFINITY;
      this.started = false;
      this.domObserver = null;
      this.shadowObservers = /* @__PURE__ */ new Map();
    }
    get available() {
      return this.transport.available;
    }
    initialize(transport, options = DEFAULT_INITIALIZATION) {
      const priority = transport.available ? options.priority : NATIVE_ISLANDS_TRANSPORT_PRIORITY.unavailable;
      if (this.transportIdentity !== void 0 && (options.identity === this.transportIdentity || this.transport.available || priority <= this.transportPriority)) {
        return false;
      }
      this.disposeTransportListeners();
      this.transport = transport;
      this.transportIdentity = options.identity;
      this.transportPriority = priority;
      this.stacking.compositionEnabled = transport.available;
      if (transport.available) {
        transport.reset(createEnvelope());
        this.transportDisposers.push(transport.on("islandError", createEnvelope(), (event) => {
          if (event.island) {
            this.degradeIsland(event.island, typeof event.reason === "string" ? event.reason : "Native component failed.");
          }
        }));
        if (typeof window !== "undefined") {
          const resetOnPageHide = (event) => {
            if (!event.persisted)
              transport.reset(createEnvelope());
          };
          const reconcileOnPageShow = (event) => {
            if (event.persisted)
              this.stacking.refresh();
          };
          window.addEventListener("pagehide", resetOnPageHide);
          window.addEventListener("pageshow", reconcileOnPageShow);
          this.transportDisposers.push(() => window.removeEventListener("pagehide", resetOnPageHide));
          this.transportDisposers.push(() => window.removeEventListener("pageshow", reconcileOnPageShow));
        }
      }
      this.autostart();
      if (transport.available)
        this.stacking.notifyTransportAvailable();
      return true;
    }
    registerIsland(handle) {
      this.scanComposedRoots(handle.el);
      this.stacking.registerNative(handle);
      if (this.started)
        this.stacking.refresh();
    }
    unregister(el) {
      this.stacking.unregister(el);
    }
    refresh() {
      this.stacking.refresh();
    }
    command(island, nativeComponent, method, properties) {
      try {
        validateCommand(island, nativeComponent, method, properties);
      } catch (error) {
        return Promise.reject(error);
      }
      return this.transport.command({
        ...createEnvelope(),
        island,
        islandType: nativeComponent,
        method,
        params: properties
      });
    }
    listen(eventName, listener) {
      return this.transport.on(eventName, createEnvelope(), listener);
    }
    degradeIsland(id, reason) {
      this.stacking.findNative(id)?.degradeToFallback(reason);
    }
    autostart() {
      if (typeof document === "undefined")
        return;
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.start(), {
          once: true
        });
      } else {
        this.start();
      }
    }
    start() {
      if (this.started || !document.body)
        return;
      this.started = true;
      this.scan(document.body);
      this.domObserver = new MutationObserver((records) => this.handleDomMutations(records));
      this.domObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-native-islands-opaque-surface"],
        childList: true,
        subtree: true
      });
      this.stacking.start((payload) => {
        return this.transport.applyLayout(payload).catch((error) => {
          const reason = error instanceof Error && error.message ? `Native layout rejected: ${error.message}` : "Native layout rejected by the platform bridge.";
          for (const component of payload.components) {
            this.degradeIsland(component.id, reason);
          }
          throw error;
        });
      });
      window.addEventListener("resize", () => this.refresh(), {
        passive: true
      });
      window.addEventListener("load", () => {
        this.stacking.invalidateAutomaticLayers();
        this.refresh();
      }, { once: true });
      window.addEventListener("hashchange", () => {
        this.stacking.invalidateAutomaticLayers();
        this.refresh();
      });
      document.addEventListener("fullscreenchange", () => {
        this.stacking.invalidateAutomaticLayers();
        this.refresh();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
          this.refresh();
      });
      void document.fonts?.ready?.then(() => this.refresh()).catch(() => void 0);
      document.fonts?.addEventListener("loadingdone", () => this.refresh());
      document.fonts?.addEventListener("loadingerror", () => this.refresh());
      for (const query of ["(prefers-color-scheme: dark)", "(prefers-contrast: more)", "(forced-colors: active)"]) {
        window.matchMedia(query).addEventListener("change", () => {
          this.stacking.invalidateAutomaticLayers();
          this.refresh();
        });
      }
    }
    handleDomMutations(records) {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLElement) {
          if (record.target.matches(LAYER_SELECTOR)) {
            this.registerLayer(record.target);
          } else if (this.knownLayers.delete(record.target)) {
            this.stacking.unregister(record.target);
          }
          continue;
        }
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement)
            this.scan(node);
        }
        for (const node of record.removedNodes) {
          if (!(node instanceof HTMLElement))
            continue;
          this.unregisterTree(node);
          this.disconnectShadowTrees(node);
        }
      }
    }
    scan(root) {
      if (root instanceof HTMLElement && root.matches(LAYER_SELECTOR))
        this.registerLayer(root);
      for (const layer of root.querySelectorAll(LAYER_SELECTOR)) {
        this.registerLayer(layer);
      }
      const elements = root instanceof HTMLElement ? [root, ...root.querySelectorAll("*")] : Array.from(root.querySelectorAll("*"));
      for (const element of elements) {
        this.knownElements.add(element);
        if (element.shadowRoot)
          this.observeShadowRoot(element.shadowRoot);
      }
    }
    observeShadowRoot(root) {
      if (this.shadowObservers.has(root))
        return;
      this.stacking.observeEffectRoot(root);
      this.scan(root);
      const observer = new MutationObserver((records) => {
        this.handleDomMutations(records);
        this.stacking.refresh();
      });
      observer.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      this.shadowObservers.set(root, observer);
    }
    scanComposedRoots(element) {
      if (typeof ShadowRoot === "undefined" || typeof element.getRootNode !== "function")
        return;
      const visited = /* @__PURE__ */ new Set();
      let current = element;
      while (current) {
        const root = current.getRootNode();
        if (root instanceof ShadowRoot && !visited.has(root)) {
          visited.add(root);
          this.observeShadowRoot(root);
        }
        current = composedParentElement(current);
      }
    }
    registerLayer(el) {
      if (this.knownLayers.has(el))
        return;
      this.knownLayers.add(el);
      this.stacking.registerLayer({
        el
      });
    }
    unregisterTree(root) {
      this.visitOpenTree(root, (tree) => {
        const elements = tree instanceof HTMLElement ? [tree, ...tree.querySelectorAll("*")] : Array.from(tree.querySelectorAll("*"));
        for (const element of elements) {
          this.knownElements.delete(element);
          if (element.matches(LAYER_SELECTOR))
            this.unregisterLayer(element);
        }
      });
    }
    disconnectShadowTrees(root) {
      this.visitOpenTree(root, (tree) => {
        if (!(tree instanceof ShadowRoot))
          return;
        this.shadowObservers.get(tree)?.disconnect();
        this.shadowObservers.delete(tree);
        this.stacking.unobserveEffectRoot(tree);
      });
    }
    unregisterLayer(layer) {
      this.knownLayers.delete(layer);
      this.stacking.unregister(layer);
    }
    visitOpenTree(root, visit) {
      visit(root);
      const elements = root instanceof HTMLElement ? [root, ...root.querySelectorAll("*")] : Array.from(root.querySelectorAll("*"));
      for (const element of elements) {
        if (element.shadowRoot)
          this.visitOpenTree(element.shadowRoot, visit);
      }
    }
    disposeTransportListeners() {
      for (const dispose of this.transportDisposers.splice(0))
        dispose();
    }
  }
  const nativeIslandsRuntime = globalSingleton("runtime/v1", () => new NativeIslandsRuntime());
  function initializeNativeIslands(transport, options) {
    return nativeIslandsRuntime.initialize(transport, options);
  }
  const definitionState = globalSingleton("definitions/v1", () => ({
    islandSequence: 0,
    definitions: /* @__PURE__ */ new Map()
  }));
  function defineNativeIsland(options) {
    if (!options.tagName.includes("-")) {
      throw new TypeError("tagName must be a valid custom-element name.");
    }
    if (!options.nativeComponent.trim()) {
      throw new TypeError("nativeComponent must not be empty.");
    }
    const existingDefinition = definitionState.definitions.get(options.tagName);
    if (existingDefinition) {
      if (existingDefinition.nativeComponent === options.nativeComponent) {
        return existingDefinition.constructor;
      }
      throw new Error(`<${options.tagName}> is already registered for "${existingDefinition.nativeComponent}".`);
    }
    if (customElements.get(options.tagName)) {
      throw new Error(`<${options.tagName}> was defined outside Native Islands.`);
    }
    const observedAttributes = [...new Set(options.observedAttributes ?? [])];
    const observedStyles = [
      ...new Set((options.observedStyles ?? []).map((property) => property.trim()).filter(Boolean))
    ];
    const reflectedAttributes = /* @__PURE__ */ new Set();
    const contract = {
      tagName: options.tagName,
      commands: ["create", "update"],
      observedAttributes
    };
    registerIslandContract(options.nativeComponent, contract);
    class DefinedNativeIsland extends HTMLElement {
      constructor() {
        super();
        this.islandId = `native-island-${++definitionState.islandSequence}`;
        this.type = options.nativeComponent;
        this.interactive = options.isInteractive ?? false;
        this.degraded = false;
        this.connected = false;
        this.mountGeneration = 0;
        this.nativeCreated = false;
        this.compositionFallbackReason = null;
        this.disconnectGeneration = 0;
        this.eventDisposers = [];
        this.accessibilityFace = null;
        this.updateScheduled = false;
        this.observedStyleSnapshot = null;
        this.fallbackAttributeChanges = /* @__PURE__ */ new Map();
        this.fallbackOnClick = null;
        const properties = this;
        for (const attribute of reflectedAttributes) {
          if (!Object.prototype.hasOwnProperty.call(this, attribute))
            continue;
          const value = properties[attribute];
          delete properties[attribute];
          properties[attribute] = value;
        }
      }
      static get observedAttributes() {
        return observedAttributes;
      }
      get el() {
        return this;
      }
      isActive() {
        return this.canAttemptNative() && this.compositionFallbackReason === null;
      }
      canAttemptNative() {
        return this.connected && !this.degraded && nativeIslandsRuntime.available;
      }
      connectedCallback() {
        this.disconnectGeneration += 1;
        if (this.connected)
          return;
        this.mountGeneration += 1;
        this.connected = true;
        nativeIslandsRuntime.registerIsland(this);
        if (!nativeIslandsRuntime.available) {
          this.renderFallback();
          return;
        }
        this.activateNative();
      }
      onTransportAvailable() {
        if (!this.connected || this.degraded || this.nativeCreated)
          return;
        this.activateNative();
        nativeIslandsRuntime.refresh();
      }
      activateNative() {
        if (!this.connected || this.degraded || this.nativeCreated || !nativeIslandsRuntime.available)
          return;
        this.nativeCreated = true;
        this.restoreFallbackPresentation();
        if ((options.accessibility ?? "web") === "web") {
          this.renderAccessibilityFace();
        }
        for (const [nativeEvent, domEvent] of Object.entries(options.events ?? {})) {
          this.eventDisposers.push(nativeIslandsRuntime.listen(nativeEvent, (event) => {
            if (event.island !== this.islandId)
              return;
            const detail = { ...event };
            delete detail.island;
            this.dispatchEvent(new CustomEvent(domEvent, {
              bubbles: true,
              composed: true,
              detail
            }));
          }));
        }
        void this.send("create");
      }
      disconnectedCallback() {
        if (!this.connected)
          return;
        const generation = ++this.disconnectGeneration;
        queueMicrotask(() => {
          if (generation !== this.disconnectGeneration || this.isConnected)
            return;
          this.mountGeneration += 1;
          this.connected = false;
          this.degraded = false;
          this.nativeCreated = false;
          this.compositionFallbackReason = null;
          this.observedStyleSnapshot = null;
          for (const dispose of this.eventDisposers.splice(0))
            dispose();
          nativeIslandsRuntime.unregister(this);
        });
      }
      attributeChangedCallback(_name, oldValue, newValue) {
        if (!this.connected || oldValue === newValue)
          return;
        nativeIslandsRuntime.refresh();
        if (this.nativeCreated && !this.degraded && this.compositionFallbackReason === null) {
          this.scheduleUpdate();
        } else {
          this.renderFallback();
        }
      }
      degradeToFallback(reason) {
        if (this.degraded)
          return;
        this.degraded = true;
        this.nativeCreated = false;
        this.compositionFallbackReason = null;
        for (const dispose of this.eventDisposers.splice(0))
          dispose();
        this.accessibilityFace?.remove();
        this.accessibilityFace = null;
        this.setAttribute("data-native-islands-fallback", "");
        this.renderFallback();
        nativeIslandsRuntime.refresh();
        this.dispatchEvent(new CustomEvent("nativeislanderror", {
          bubbles: true,
          composed: true,
          detail: { reason }
        }));
      }
      setCompositionFallback(reason) {
        if (this.degraded || this.compositionFallbackReason === reason)
          return;
        const wasFallback = this.compositionFallbackReason !== null;
        this.compositionFallbackReason = reason;
        if (reason !== null) {
          if (!wasFallback)
            this.renderFallback();
          this.setAttribute("data-native-islands-composition-fallback", "");
        } else {
          this.restoreFallbackPresentation();
          if ((options.accessibility ?? "web") === "web")
            this.renderAccessibilityFace();
          if (this.nativeCreated)
            this.scheduleUpdate();
        }
      }
      reconcileObservedStyles() {
        if (!this.connected || observedStyles.length === 0)
          return;
        const next = this.readObservedStyleSnapshot();
        if (this.observedStyleSnapshot === null) {
          this.observedStyleSnapshot = next;
          return;
        }
        if (next === this.observedStyleSnapshot)
          return;
        this.observedStyleSnapshot = next;
        if (this.nativeCreated && !this.degraded && this.compositionFallbackReason === null) {
          this.scheduleUpdate();
        } else {
          this.renderFallback();
        }
      }
      readObservedStyleSnapshot() {
        const style = getComputedStyle(this);
        return JSON.stringify(observedStyles.map((property) => style.getPropertyValue(property)));
      }
      properties() {
        if (observedStyles.length > 0) {
          this.observedStyleSnapshot = this.readObservedStyleSnapshot();
        }
        return options.getProperties?.(this);
      }
      async send(method) {
        const generation = this.mountGeneration;
        try {
          await nativeIslandsRuntime.command(this.islandId, options.nativeComponent, method, this.properties());
        } catch (error) {
          if (!this.connected || generation !== this.mountGeneration)
            return;
          this.degradeToFallback(error instanceof Error ? error.message : "Native command failed.");
        }
      }
      scheduleUpdate() {
        if (this.updateScheduled)
          return;
        this.updateScheduled = true;
        queueMicrotask(() => {
          this.updateScheduled = false;
          if (!this.connected || this.degraded || !nativeIslandsRuntime.available)
            return;
          if ((options.accessibility ?? "web") === "web") {
            this.renderAccessibilityFace();
          }
          void this.send("update");
        });
      }
      renderFallback() {
        this.restoreFallbackPresentation();
        this.accessibilityFace = null;
        this.replaceChildren();
        const beforeAttributes = new Map(this.getAttributeNames().map((name) => [name, this.getAttribute(name)]));
        const beforeOnClick = this.onclick;
        options.renderFallback(this);
        const names = /* @__PURE__ */ new Set([...beforeAttributes.keys(), ...this.getAttributeNames()]);
        for (const name of names) {
          if (name === "data-native-islands-fallback" || name === "data-native-islands-composition-fallback")
            continue;
          const before = beforeAttributes.get(name) ?? null;
          const after = this.getAttribute(name);
          if (before !== after)
            this.fallbackAttributeChanges.set(name, { before, after });
        }
        if (beforeOnClick !== this.onclick) {
          this.fallbackOnClick = { before: beforeOnClick, after: this.onclick };
        }
        this.setAttribute("data-native-islands-fallback", "");
      }
      restoreFallbackPresentation() {
        this.removeAttribute("data-native-islands-fallback");
        this.removeAttribute("data-native-islands-composition-fallback");
        for (const [name, change] of this.fallbackAttributeChanges) {
          if (this.getAttribute(name) !== change.after)
            continue;
          if (change.before === null)
            this.removeAttribute(name);
          else
            this.setAttribute(name, change.before);
        }
        this.fallbackAttributeChanges.clear();
        if (this.fallbackOnClick && this.onclick === this.fallbackOnClick.after) {
          this.onclick = this.fallbackOnClick.before;
        }
        this.fallbackOnClick = null;
        this.replaceChildren();
      }
      renderAccessibilityFace() {
        this.accessibilityFace?.remove();
        const face = document.createElement("div");
        for (const name of this.getAttributeNames()) {
          if (name === "id" || name === "style" || name === "data-native-islands-fallback")
            continue;
          const value = this.getAttribute(name);
          if (value !== null)
            face.setAttribute(name, value);
        }
        options.renderFallback(face);
        face.setAttribute("data-native-islands-accessibility-face", "");
        face.style.setProperty("position", "absolute", "important");
        face.style.setProperty("width", "1px", "important");
        face.style.setProperty("height", "1px", "important");
        face.style.setProperty("padding", "0", "important");
        face.style.setProperty("margin", "-1px", "important");
        face.style.setProperty("overflow", "hidden", "important");
        face.style.setProperty("clip", "rect(0, 0, 0, 0)", "important");
        face.style.setProperty("clip-path", "inset(50%)", "important");
        face.style.setProperty("white-space", "nowrap", "important");
        face.style.setProperty("border", "0", "important");
        face.style.setProperty("pointer-events", "none", "important");
        this.append(face);
        this.accessibilityFace = face;
      }
    }
    for (const attribute of observedAttributes) {
      if (attribute in DefinedNativeIsland.prototype)
        continue;
      reflectedAttributes.add(attribute);
      Object.defineProperty(DefinedNativeIsland.prototype, attribute, {
        configurable: true,
        enumerable: true,
        get() {
          return this.getAttribute(attribute);
        },
        set(value) {
          if (value === null || value === void 0)
            this.removeAttribute(attribute);
          else
            this.setAttribute(attribute, String(value));
        }
      });
    }
    customElements.define(options.tagName, DefinedNativeIsland);
    definitionState.definitions.set(options.tagName, {
      nativeComponent: options.nativeComponent,
      constructor: DefinedNativeIsland
    });
    return DefinedNativeIsland;
  }
  const SERVICE = "OSGeolocationIslands";
  const eventListeners = /* @__PURE__ */ new Map();
  let eventChannelOpen = false;
  let runtimeInitialized = false;
  function cordovaWindow() {
    return typeof window === "undefined" ? void 0 : window;
  }
  function platform() {
    const id = cordovaWindow()?.cordova?.platformId?.toLowerCase();
    if (id === "android" || id === "ios") return id;
    return "web";
  }
  function bridgeError(value) {
    if (value instanceof Error) return value;
    const payload = typeof value === "object" && value !== null ? value : void 0;
    const error = new Error(
      typeof payload?.message === "string" ? payload.message : typeof value === "string" ? value : "Native component command failed."
    );
    if (typeof payload?.code === "string") error.code = payload.code;
    return error;
  }
  function call(action, payload) {
    const exec = cordovaWindow()?.cordova?.exec;
    if (!exec) {
      return Promise.reject(
        Object.assign(new Error("Cordova is not available."), {
          code: "unavailable"
        })
      );
    }
    return new Promise((resolve, reject) => {
      exec(
        () => resolve(),
        (error) => reject(bridgeError(error)),
        SERVICE,
        action,
        [payload]
      );
    });
  }
  function createCordovaTransport() {
    const exec = cordovaWindow()?.cordova?.exec;
    return {
      available: Boolean(exec),
      applyLayout(payload) {
        return call("applyLayout", payload);
      },
      async command(request) {
        await call("command", request);
      },
      reset(envelope) {
        void call("reset", envelope).catch(() => void 0);
      },
      on(eventName, envelope, listener) {
        const listeners = eventListeners.get(eventName) ?? /* @__PURE__ */ new Set();
        listeners.add(listener);
        eventListeners.set(eventName, listeners);
        if (!eventChannelOpen && exec) {
          eventChannelOpen = true;
          exec(
            (value) => {
              const message = value;
              if (!message?.event || !message.data) return;
              for (const handler of eventListeners.get(message.event) ?? []) {
                handler(message.data);
              }
            },
            () => {
              eventChannelOpen = false;
            },
            SERVICE,
            "events",
            [envelope]
          );
        }
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) eventListeners.delete(eventName);
        };
      }
    };
  }
  function initializeCordovaRuntime() {
    if (runtimeInitialized || platform() !== "android") return;
    const transport = createCordovaTransport();
    if (!transport.available) return;
    runtimeInitialized = true;
    initializeNativeIslands(transport, {
      identity: "com.outsystems.plugins.geolocation/location-button",
      priority: NATIVE_ISLANDS_TRANSPORT_PRIORITY.carrier
    });
  }
  const TEXT_LABELS = {
    "use-precise-location": "Use precise location",
    "share-precise-location": "Share precise location",
    "near-my-precise-location": "Near my precise location",
    "near-your-precise-location": "Near your precise location",
    "precise-location": "Precise location",
    none: "Share location"
  };
  const STYLE_PROPERTIES = {
    backgroundColor: "background-color",
    textColor: "color",
    iconTint: "--os-location-button-icon-color",
    strokeColor: "border-top-color",
    strokeWidth: "border-top-width"
  };
  const OBSERVED_ATTRIBUTES = ["text-type"];
  const OBSERVED_STYLES = [
    STYLE_PROPERTIES.backgroundColor,
    STYLE_PROPERTIES.textColor,
    STYLE_PROPERTIES.iconTint,
    STYLE_PROPERTIES.strokeColor,
    STYLE_PROPERTIES.strokeWidth,
    "border-top-left-radius"
  ];
  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
  const RGB_COLOR = /^rgba?\((.+)\)$/;
  function textType(element) {
    const value = element.getAttribute("text-type") ?? "precise-location";
    return value in TEXT_LABELS ? value : "precise-location";
  }
  function colorStyle(style, name, fallback) {
    const value = style.getPropertyValue(name).trim();
    if (HEX_COLOR.test(value)) return value.toUpperCase();
    const match = value.match(RGB_COLOR);
    if (!match) return fallback;
    const channels = match[1].match(/\d+(?:\.\d+)?/g)?.map(Number);
    if (!channels || channels.length < 3 || channels.slice(0, 3).some((channel) => channel < 0 || channel > 255)) {
      return fallback;
    }
    if (channels.length > 3 && channels[3] < 1) return fallback;
    return `#${channels.slice(0, 3).map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }
  function pixelStyle(style, name, minimum, maximum, fallback) {
    const value = style.getPropertyValue(name).trim();
    if (!value.endsWith("px")) return fallback;
    const number = Number.parseFloat(value);
    return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
  }
  function dispatch(element, type, detail) {
    element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
  function renderFallback(element) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "os-location-button-fallback";
    const normalizedTextType = textType(element);
    const label2 = TEXT_LABELS[normalizedTextType];
    const icon = document.createElement("span");
    icon.className = "os-location-button-fallback__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌖";
    const text = document.createElement("span");
    text.className = normalizedTextType === "none" ? "os-location-button-fallback__visually-hidden" : "";
    text.textContent = label2;
    button.append(icon, text);
    button.setAttribute("aria-label", label2);
    button.addEventListener("click", () => {
      const currentPlatform = platform();
      if (currentPlatform !== "web") {
        dispatch(element, "location-error", {
          reason: `Location Button is unavailable on ${currentPlatform}`
        });
        return;
      }
      if (!navigator.geolocation) {
        dispatch(element, "location-error", {
          reason: "Browser geolocation is unavailable"
        });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          dispatch(element, "location-grant", {
            granted: true
          });
          dispatch(element, "location-position", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            dispatch(element, "location-grant", {
              granted: false
            });
          }
          dispatch(element, "location-error", {
            reason: error.message || "Browser location request failed"
          });
        },
        { enableHighAccuracy: true }
      );
    });
    element.replaceChildren(button);
  }
  function installFallbackStyles() {
    if (document.querySelector("style[data-os-location-button]")) return;
    const style = document.createElement("style");
    style.dataset.osLocationButton = "";
    style.textContent = `
    :where(os-location-button) {
      display: inline-block;
      inline-size: min(100%, 22rem);
      min-inline-size: 3rem;
      block-size: 3.25rem;
      min-block-size: 3rem;
      max-block-size: 136px;
      box-sizing: border-box;
      overflow: hidden;
      border: 0 solid #000000;
      border-radius: 22px;
      background-color: #0b57d0;
      color: #ffffff;
    }

    .os-location-button-fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      inline-size: 100%;
      block-size: 100%;
      min-inline-size: 3rem;
      min-block-size: 3rem;
      padding-inline: 1rem;
      border: 0;
      border-radius: inherit;
      background: transparent;
      color: inherit;
      font: 600 1rem/1 system-ui, sans-serif;
    }

    .os-location-button-fallback__icon {
      color: var(--os-location-button-icon-color, currentColor);
      font-size: 1.25rem;
      line-height: 1;
    }

    .os-location-button-fallback__visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  `;
    document.head.append(style);
  }
  function registerLocationButton() {
    if (typeof document === "undefined" || typeof HTMLElement === "undefined" || typeof customElements === "undefined" || customElements.get("os-location-button")) {
      return;
    }
    installFallbackStyles();
    if (platform() === "ios") {
      class OsLocationButtonFallback extends HTMLElement {
        constructor() {
          super(...arguments);
          this.connected = false;
        }
        static get observedAttributes() {
          return OBSERVED_ATTRIBUTES;
        }
        connectedCallback() {
          if (this.connected) return;
          this.connected = true;
          renderFallback(this);
        }
        attributeChangedCallback(_name, oldValue, newValue) {
          if (this.connected && oldValue !== newValue) renderFallback(this);
        }
      }
      customElements.define("os-location-button", OsLocationButtonFallback);
      return;
    }
    defineNativeIsland({
      tagName: "os-location-button",
      nativeComponent: "os.locationButton",
      isInteractive: true,
      accessibility: "native",
      observedAttributes: OBSERVED_ATTRIBUTES,
      observedStyles: OBSERVED_STYLES,
      getProperties: (element) => {
        const style = getComputedStyle(element);
        const cornerRadius = pixelStyle(style, "border-top-left-radius", 0, 68, 22);
        const textColor = colorStyle(style, STYLE_PROPERTIES.textColor, "#FFFFFF");
        return {
          textType: textType(element),
          backgroundColor: colorStyle(style, STYLE_PROPERTIES.backgroundColor, "#0B57D0"),
          textColor,
          iconTint: colorStyle(style, STYLE_PROPERTIES.iconTint, textColor),
          strokeColor: colorStyle(style, STYLE_PROPERTIES.strokeColor, "#000000"),
          cornerRadius,
          pressedCornerRadius: Math.min(cornerRadius, 12),
          strokeWidth: pixelStyle(style, STYLE_PROPERTIES.strokeWidth, 0, 3, 0)
        };
      },
      renderFallback,
      events: {
        grant: "location-grant",
        position: "location-position",
        buttonError: "location-error"
      }
    });
  }
  function boot() {
    initializeCordovaRuntime();
    registerLocationButton();
  }
  if (cordovaWindow()?.cordova && !cordovaWindow()?.cordova?.platformId) {
    document.addEventListener("deviceready", boot, { once: true });
  } else {
    boot();
  }
})();
