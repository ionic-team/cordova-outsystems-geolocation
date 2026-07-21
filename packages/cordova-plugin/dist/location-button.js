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
  const PROTOCOL_VERSION = 6;
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
      innerScrollMode: "unsupported",
      async applyLayout() {
        return void 0;
      },
      async applyScrollOffsets() {
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
  function viewportRect(element) {
    const bounds = element.getBoundingClientRect();
    return {
      x: round2(bounds.left),
      y: round2(bounds.top),
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
  function intersection(left, right) {
    const x = Math.max(left.x, right.x);
    const y = Math.max(left.y, right.y);
    const rightEdge = Math.min(left.x + left.w, right.x + right.w);
    const bottomEdge = Math.min(left.y + left.h, right.y + right.h);
    if (rightEdge <= x || bottomEdge <= y)
      return null;
    return {
      x: round2(x),
      y: round2(y),
      w: round2(rightEdge - x),
      h: round2(bottomEdge - y)
    };
  }
  const CONTAINMENT_EPSILON = 0.5;
  function contains(outer, inner) {
    return inner.x >= outer.x - CONTAINMENT_EPSILON && inner.y >= outer.y - CONTAINMENT_EPSILON && inner.x + inner.w <= outer.x + outer.w + CONTAINMENT_EPSILON && inner.y + inner.h <= outer.y + outer.h + CONTAINMENT_EPSILON;
  }
  function partialOverlap(left, right) {
    return intersects(left, right) && !contains(left, right) && !contains(right, left);
  }
  function disjointHoles(holes) {
    const area = (rect) => rect.w * rect.h;
    const survivors = holes.filter((hole, index) => !holes.some((other, otherIndex) => {
      if (otherIndex === index || !contains(other, hole))
        return false;
      const otherArea = area(other);
      const holeArea = area(hole);
      return otherArea > holeArea || otherArea === holeArea && otherIndex < index;
    }));
    const remaining = new Set(survivors.map((_, index) => index));
    const output = [];
    while (remaining.size > 0) {
      const seed = remaining.values().next().value;
      const component = [seed];
      remaining.delete(seed);
      for (const current of component) {
        for (const candidate of Array.from(remaining)) {
          if (!intersects(survivors[current], survivors[candidate]))
            continue;
          component.push(candidate);
          remaining.delete(candidate);
        }
      }
      const rects = component.map((index) => survivors[index]);
      if (rects.length === 1 || rects.some((rect) => (rect.r ?? 0) > 0)) {
        output.push(...rects);
        continue;
      }
      const xs = Array.from(new Set(rects.flatMap((rect) => [rect.x, rect.x + rect.w]))).sort((a, b) => a - b);
      const ys = Array.from(new Set(rects.flatMap((rect) => [rect.y, rect.y + rect.h]))).sort((a, b) => a - b);
      const union = [];
      for (let yIndex = 0; yIndex < ys.length - 1; yIndex++) {
        const y = ys[yIndex];
        const height = ys[yIndex + 1] - y;
        let runStart = null;
        for (let xIndex = 0; xIndex < xs.length - 1; xIndex++) {
          const x = xs[xIndex];
          const covered = rects.some((rect) => x >= rect.x && xs[xIndex + 1] <= rect.x + rect.w && y >= rect.y && ys[yIndex + 1] <= rect.y + rect.h);
          if (covered && runStart === null)
            runStart = x;
          const closes = runStart !== null && (!covered || xIndex === xs.length - 2);
          if (!closes)
            continue;
          const left = runStart;
          const right = covered && xIndex === xs.length - 2 ? xs[xIndex + 1] : x;
          const width = right - left;
          const previous = union.find((rect) => rect.x === left && rect.w === width && rect.y + rect.h === y);
          if (previous)
            previous.h += height;
          else
            union.push({ x: left, y, w: width, h: height });
          runStart = null;
        }
      }
      output.push(...union);
    }
    return output.sort((left, right) => left.y - right.y || left.x - right.x || left.w - right.w || left.h - right.h);
  }
  function complementRects(layer, holes) {
    const clipped = holes.flatMap((hole) => {
      const value = intersection(layer, hole);
      return value ? [value] : [];
    });
    if (clipped.length === 0)
      return [{ ...layer, r: 0 }];
    const xs = Array.from(/* @__PURE__ */ new Set([layer.x, layer.x + layer.w, ...clipped.flatMap((rect) => [rect.x, rect.x + rect.w])])).sort((a, b) => a - b);
    const ys = Array.from(/* @__PURE__ */ new Set([layer.y, layer.y + layer.h, ...clipped.flatMap((rect) => [rect.y, rect.y + rect.h])])).sort((a, b) => a - b);
    const output = [];
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex++) {
      const y = ys[yIndex];
      const height = ys[yIndex + 1] - y;
      let runStart = null;
      for (let xIndex = 0; xIndex < xs.length - 1; xIndex++) {
        const x = xs[xIndex];
        const covered = clipped.some((hole) => x >= hole.x && xs[xIndex + 1] <= hole.x + hole.w && y >= hole.y && ys[yIndex + 1] <= hole.y + hole.h);
        if (!covered && runStart === null)
          runStart = x;
        const closes = runStart !== null && (covered || xIndex === xs.length - 2);
        if (!closes)
          continue;
        const left = runStart;
        const right = !covered && xIndex === xs.length - 2 ? xs[xIndex + 1] : x;
        const width = right - left;
        const previous = output.find((rect) => rect.x === left && rect.w === width && rect.y + rect.h === y);
        if (previous)
          previous.h += height;
        else
          output.push({ x: left, y, w: width, h: height, r: 0 });
        runStart = null;
      }
    }
    return output;
  }
  function opaqueContainsRect(outer, inner) {
    if (!contains(outer, inner))
      return false;
    if (Math.abs(outer.x - inner.x) <= CONTAINMENT_EPSILON && Math.abs(outer.y - inner.y) <= CONTAINMENT_EPSILON && Math.abs(outer.w - inner.w) <= CONTAINMENT_EPSILON && Math.abs(outer.h - inner.h) <= CONTAINMENT_EPSILON && Math.abs((outer.r ?? 0) - (inner.r ?? 0)) <= CONTAINMENT_EPSILON) {
      return true;
    }
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
  function knockoutPathData(layer, holes) {
    const width = round2(layer.w);
    const height = round2(layer.h);
    let path = `M0 0 H${width} V${height} H0 Z`;
    for (const hole of holes) {
      const x = round2(hole.x - layer.x);
      const y = round2(hole.y - layer.y);
      const radius = Math.min(hole.r ?? 0, hole.w / 2, hole.h / 2);
      path += ` M${round2(x + radius)} ${y} A${radius} ${radius} 0 0 0 ${x} ${round2(y + radius)} L${x} ${round2(y + hole.h - radius)} A${radius} ${radius} 0 0 0 ${round2(x + radius)} ${round2(y + hole.h)} L${round2(x + hole.w - radius)} ${round2(y + hole.h)} A${radius} ${radius} 0 0 0 ${round2(x + hole.w)} ${round2(y + hole.h - radius)} L${round2(x + hole.w)} ${round2(y + radius)} A${radius} ${radius} 0 0 0 ${round2(x + hole.w - radius)} ${y} Z`;
    }
    return path;
  }
  function knockoutPath(layer, holes) {
    return `path("${knockoutPathData(layer, holes)}")`;
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
  function runtimeOwnsClip(el, style) {
    if (!el.hasAttribute("data-ni-runtime-clip"))
      return false;
    const inline = el.style.getPropertyValue("clip-path");
    return inline !== "" && el.style.getPropertyPriority("clip-path") === "" && style.clipPath === inline;
  }
  function independentScrollContainers(element) {
    const containers = [];
    let node = composedParentElement(element);
    while (node) {
      if (node !== document.body && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (scrolls(node, style))
          containers.push(node);
      }
      node = composedParentElement(node);
    }
    return containers;
  }
  function clipsThroughPaintContainment(style) {
    return /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(style.getPropertyValue("contain").trim());
  }
  function hasUnsupportedClipEdge(style) {
    const clipMargin = style.getPropertyValue("overflow-clip-margin").trim();
    return clipMargin !== "" && clipMargin !== "0" && clipMargin !== "0px";
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
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const innerRadius = Math.max(0, radius - Math.min(borderTop, borderRight, borderBottom, borderLeft));
    const outer = {
      x: bounds.left + borderLeft,
      y: bounds.top + borderTop,
      w: Math.max(0, bounds.right - bounds.left - borderLeft - borderRight),
      h: Math.max(0, bounds.bottom - bounds.top - borderTop - borderBottom),
      r: innerRadius
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
  function separableBackgroundPaint(style) {
    const image = style.backgroundImage.trim() || "none";
    const alpha = colorAlpha(style.backgroundColor);
    if ((alpha === null || alpha === 0) && image === "none")
      return null;
    const imageIsPortable = image === "none" || !/(?:url|image-set|cross-fade|element|paint)\s*\(/i.test(image) && /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(image);
    const clips2 = style.backgroundClip.split(",").map((value) => value.trim());
    const origins = style.backgroundOrigin.split(",").map((value) => value.trim());
    const attachments = style.backgroundAttachment.split(",").map((value) => value.trim());
    const blendModes = style.backgroundBlendMode.split(",").map((value) => value.trim() || "normal");
    if (!imageIsPortable || clips2.some((value) => value !== "border-box") || origins.some((value) => value !== "padding-box") || attachments.some((value) => value !== "scroll") || blendModes.some((value) => value !== "normal")) {
      return null;
    }
    return {
      color: style.backgroundColor,
      image,
      size: style.backgroundSize,
      position: style.backgroundPosition,
      repeat: style.backgroundRepeat,
      origin: style.backgroundOrigin,
      clip: style.backgroundClip,
      attachment: style.backgroundAttachment,
      blendMode: style.backgroundBlendMode,
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
    };
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
  function hasPaintOutsideBorderBox(el, style) {
    const hasVisiblePseudo = (pseudo) => {
      const pseudoStyle = getComputedStyle(el, pseudo);
      const content = (pseudoStyle.content ?? "").trim();
      if (content === "" || content === "none" || content === "normal")
        return false;
      return pseudoStyle.display !== "none" && pseudoStyle.visibility !== "hidden" && Number.parseFloat(pseudoStyle.opacity) !== 0;
    };
    return style.boxShadow !== "" && style.boxShadow !== "none" || style.textShadow !== "" && style.textShadow !== "none" || style.outlineStyle !== "" && style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0 || hasVisiblePseudo("::before") || hasVisiblePseudo("::after");
  }
  function automaticWebLayerCutoutIssue(el, modeledScrollContainer = null, allowViewportPosition = false, requireOpaqueBox = false) {
    const style = getComputedStyle(el);
    const alpha = colorAlpha(style.backgroundColor);
    const hasImage = style.backgroundImage !== "" && style.backgroundImage !== "none";
    const sparsePaint = hasSparsePaint(el, style);
    if ((alpha === 0 || alpha === null) && !hasImage && !sparsePaint)
      return void 0;
    const opaqueBorderBox = alpha === 1 && backgroundColorClip(style) === "border-box";
    if (requireOpaqueBox && (!opaqueBorderBox || hasPaintOutsideBorderBox(el, style))) {
      return {
        reason: "web paint above an overlay island must be fully opaque across its bounded box",
        mayMoveWithoutRefresh: false
      };
    }
    if (el.children.length === 0) {
      return auditWebLayerCutoutComposition(el, modeledScrollContainer, false, allowViewportPosition);
    }
    if (alpha !== 1 || backgroundColorClip(style) !== "border-box" || hasImage || sparsePaint) {
      return {
        reason: "sparse, translucent, or partially painted web content cannot use a box-shaped native cutout",
        mayMoveWithoutRefresh: false
      };
    }
    return auditWebLayerCutoutComposition(el, modeledScrollContainer, false, allowViewportPosition);
  }
  function auditWebLayerCutoutComposition(el, modeledScrollContainers = null, backgroundOnly = false, allowViewportPosition = false) {
    const modeledScrollContainerSet = new Set(modeledScrollContainers === null ? [] : Array.isArray(modeledScrollContainers) ? modeledScrollContainers : [modeledScrollContainers]);
    const layerRect = el.getBoundingClientRect();
    let node = el;
    while (node) {
      const style = getComputedStyle(node);
      const isViewportRoot = node === document.body || node === document.documentElement;
      const runtimeClip = runtimeOwnsClip(node, style);
      const zoom = style.getPropertyValue("zoom").trim();
      if (style.position === "sticky" || !allowViewportPosition && style.position === "fixed") {
        return {
          reason: "fixed and sticky web layers cannot use document-space native cutouts",
          mayMoveWithoutRefresh: true
        };
      }
      if (Number.parseFloat(style.opacity) !== 1 || propertyIsActive(style, "filter") || propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter") || (style.getPropertyValue("mix-blend-mode").trim() || "normal") !== "normal" || !runtimeClip && propertyIsActive(style, "clip-path") || propertyIsActive(style, "mask-image") || propertyIsActive(style, "-webkit-mask-image")) {
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
      if (node === el && !isViewportRoot && !backgroundOnly && markedLayerPaintEscapes(el, style)) {
        return {
          reason: "web surfaces with out-of-bounds paint or visible overflow cannot use a box-bounded cutout",
          mayMoveWithoutRefresh: false
        };
      }
      const overflowClips = clips(style);
      const paintContains = clipsThroughPaintContainment(style);
      const modeledScrollClip = modeledScrollContainerSet.has(node) && overflowClips && !paintContains && ["", "0", "0px"].includes(style.getPropertyValue("overflow-clip-margin").trim());
      if (node !== el && !isViewportRoot && (overflowClips || paintContains) && !modeledScrollClip && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, layerRect))) {
        return {
          reason: `opaque web surface coordinates are unsafe under a partially clipping ${paintContains ? "paint-containment" : "overflow"} ancestor`,
          mayMoveWithoutRefresh: false
        };
      }
      node = composedParentElement(node);
    }
    return null;
  }
  function auditIslandComposition(island, el, modeledScrollContainers = null) {
    const modeledScrollContainerSet = new Set(modeledScrollContainers === null ? [] : Array.isArray(modeledScrollContainers) ? modeledScrollContainers : [modeledScrollContainers]);
    const issues = [];
    const islandRect = el.getBoundingClientRect();
    let node = el;
    while (node) {
      const style = getComputedStyle(node);
      const element = label(node);
      const isViewportRoot = node === document.body || node === document.documentElement;
      const runtimeClip = runtimeOwnsClip(node, style);
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
      if (!runtimeClip && style.clipPath !== "none" || mask && mask !== "none") {
        issues.push({
          code: "css_clip_or_mask",
          island,
          element,
          message: "CSS clip-path and masks are not supported for a native island"
        });
        break;
      }
      const overflowClips = clips(style);
      const paintContains = clipsThroughPaintContainment(style);
      const modeledScrollClip = modeledScrollContainerSet.has(node) && overflowClips && !paintContains && ["", "0", "0px"].includes(style.getPropertyValue("overflow-clip-margin").trim());
      if (node !== el && !isViewportRoot && (overflowClips || paintContains) && !modeledScrollClip && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, islandRect))) {
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
  const IDENTIFIER$1 = /^[A-Za-z_][A-Za-z0-9._:-]*$/;
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
    if (!IDENTIFIER$1.test(island) || byteLength(island) > BRIDGE_LIMITS.identifierBytes) {
      throw new NativeIslandError("invalid_request", "Invalid native island id.");
    }
    if (!IDENTIFIER$1.test(nativeComponent) || byteLength(nativeComponent) > BRIDGE_LIMITS.identifierBytes) {
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
  let topLayerSequence = 0;
  const topLayerOrder = /* @__PURE__ */ new WeakMap();
  function matchesState(element, selector) {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  }
  function activeTopLayerAncestor(element) {
    let current = element;
    while (current) {
      if (current === document.fullscreenElement || matchesState(current, ":modal") || matchesState(current, ":popover-open")) {
        return current;
      }
      current = composedParentElement(current);
    }
    return null;
  }
  function noteTopLayerState(element, active) {
    if (active) {
      if (!topLayerOrder.has(element))
        topLayerOrder.set(element, ++topLayerSequence);
    } else {
      topLayerOrder.delete(element);
    }
  }
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
  function establishesStackingContext(el) {
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
    while (p && !establishesStackingContext(p))
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
    if (establishesStackingContext(el) || cs.position !== "static")
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
    const topA = activeTopLayerAncestor(a);
    const topB = activeTopLayerAncestor(b);
    if (topA !== topB) {
      if (topA && !topB)
        return 1;
      if (topB && !topA)
        return -1;
      if (topA && topB) {
        const orderA = topLayerOrder.get(topA) ?? 0;
        const orderB = topLayerOrder.get(topB) ?? 0;
        if (orderA !== orderB)
          return orderA - orderB;
        return compareComposedTreeOrder(topA, topB);
      }
    }
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
  function usesMotionPresentation(mode) {
    return mode === "presentation" || mode === "native-presentation";
  }
  const SCROLL_PRESENTATION_PREPARE$1 = "__CAPACITOR_NATIVE_ISLANDS_SCROLL_PREPARE__";
  const scrollPreflightState = globalSingleton("scroll-preflight/v1", () => ({
    containers: /* @__PURE__ */ new Map(),
    dispose: null
  }));
  function invokeScrollPresentationPrepare(containers, sequence) {
    try {
      const topWindow = window.top ?? window;
      const helper = topWindow[SCROLL_PRESENTATION_PREPARE$1];
      return typeof helper === "function" && helper(containers, sequence) === true;
    } catch {
      return false;
    }
  }
  const BACKGROUND_PROPERTIES = [
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "background-origin",
    "background-clip",
    "background-attachment",
    "background-blend-mode"
  ];
  const MAX_SCROLL_PATH_DEPTH = 16;
  const MAX_MOTION_DEPENDENCIES = 256;
  const MAX_REGIONS_PER_COMPONENT = 256;
  const above = (a, b) => {
    const paintOrder = comparePaintOrder(a.el, b.el);
    if (paintOrder !== 0)
      return paintOrder > 0;
    return a.z !== b.z ? a.z > b.z : a.dom > b.dom;
  };
  function directTextIntersects(element, rect) {
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const bounds of range.getClientRects()) {
        if (intersects(rect, {
          x: bounds.left + window.scrollX,
          y: bounds.top + window.scrollY,
          w: bounds.width,
          h: bounds.height
        })) {
          range.detach();
          return true;
        }
      }
      range.detach();
    }
    return false;
  }
  function hasVisiblePseudoElement(element) {
    return ["::before", "::after"].some((pseudo) => {
      const style = getComputedStyle(element, pseudo);
      return style.display !== "none" && style.visibility !== "hidden" && style.content !== "" && style.content !== "none" && style.content !== "normal" && Number.parseFloat(style.opacity) > 0;
    });
  }
  function borderContains(element, rect) {
    const style = getComputedStyle(element);
    const bounds = docRect(element);
    const widths = [
      Number.parseFloat(style.borderTopWidth),
      Number.parseFloat(style.borderRightWidth),
      Number.parseFloat(style.borderBottomWidth),
      Number.parseFloat(style.borderLeftWidth)
    ];
    const painted = [
      [style.borderTopStyle, style.borderTopColor, widths[0]],
      [style.borderRightStyle, style.borderRightColor, widths[1]],
      [style.borderBottomStyle, style.borderBottomColor, widths[2]],
      [style.borderLeftStyle, style.borderLeftColor, widths[3]]
    ].some(([borderStyle, color, width]) => borderStyle !== "none" && color !== "transparent" && color !== "rgba(0, 0, 0, 0)" && Number(width) > 0);
    if (!painted)
      return true;
    const [top, right, bottom, left] = widths;
    return contains({
      x: bounds.x + left,
      y: bounds.y + top,
      w: Math.max(0, bounds.w - left - right),
      h: Math.max(0, bounds.h - top - bottom)
    }, rect);
  }
  function zIndex(el) {
    const value = Number.parseInt(getComputedStyle(el).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }
  function physicalScrollOffset(element) {
    const style = getComputedStyle(element);
    const horizontalReversed = style.direction === "rtl" || style.flexDirection === "row-reverse";
    const verticalReversed = style.flexDirection === "column-reverse";
    return {
      x: round2(horizontalReversed ? element.scrollWidth - element.clientWidth + element.scrollLeft : element.scrollLeft),
      y: round2(verticalReversed ? element.scrollHeight - element.clientHeight + element.scrollTop : element.scrollTop)
    };
  }
  function scrollPath(element) {
    return independentScrollContainers(element).reverse();
  }
  function sameScrollPath(left, right) {
    return left.length === right.length && left.every((element, index) => element === right[index]);
  }
  function sameCoordinatePath(left, right) {
    return left.coordinateSpace === right.coordinateSpace && sameScrollPath(left.scrollPath, right.scrollPath);
  }
  function scrollPathOffset(path) {
    return path.reduce((total, element) => {
      const offset = physicalScrollOffset(element);
      total.x += offset.x;
      total.y += offset.y;
      return total;
    }, { x: 0, y: 0 });
  }
  function rectInsideScrollPath(element, path) {
    const rect = docRect(element);
    const offset = scrollPathOffset(path);
    return {
      ...rect,
      x: round2(rect.x + offset.x),
      y: round2(rect.y + offset.y)
    };
  }
  function rectInScrollPathCoordinates(rect, path) {
    const offset = scrollPathOffset(path);
    return {
      ...rect,
      x: round2(rect.x + offset.x),
      y: round2(rect.y + offset.y)
    };
  }
  function visibleRectInsideScrollPath(rect, path) {
    let visible = rect;
    for (const container of path) {
      const scrollport = scrollContainerRect(container);
      if (!scrollport || !visible)
        return null;
      visible = intersection(visible, scrollport);
    }
    return visible;
  }
  function scrollPathViewport(path) {
    if (path.length === 0)
      return null;
    let viewport = scrollContainerRect(path[0]);
    for (let index = 1; index < path.length; index++) {
      const scrollport = scrollContainerRect(path[index]);
      if (!viewport || !scrollport)
        return null;
      viewport = intersection(viewport, scrollport);
    }
    return viewport;
  }
  function pathsMayCross(leftRect, leftPath, rightRect, rightPath) {
    if (intersects(leftRect, rightRect))
      return true;
    const leftViewport = scrollPathViewport(leftPath);
    const rightViewport = scrollPathViewport(rightPath);
    return leftViewport !== null && intersects(leftViewport, rightRect) || rightViewport !== null && intersects(leftRect, rightViewport) || leftViewport !== null && rightViewport !== null && intersects(leftViewport, rightViewport);
  }
  function fullyVisibleInsideScrollPath(rect, path) {
    return path.every((container) => {
      const scrollport = scrollContainerRect(container);
      return scrollport !== null && opaqueContainsRect(scrollport, rect);
    });
  }
  function addSymmetricPathDifference(target, left, right) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    for (const element of left) {
      if (!rightSet.has(element))
        target.add(element);
    }
    for (const element of right) {
      if (!leftSet.has(element))
        target.add(element);
    }
  }
  function scrollContainerRect(element) {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const radius = uniformCssCornerRadius([
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius
    ]);
    if (radius === null)
      return null;
    const borderLeft = element.clientLeft;
    const borderTop = element.clientTop;
    const borderRight = Math.max(0, bounds.width - element.clientWidth - borderLeft);
    const borderBottom = Math.max(0, bounds.height - element.clientHeight - borderTop);
    const innerRadius = Math.max(0, radius - Math.max(borderLeft, borderTop, borderRight, borderBottom));
    return {
      x: round2(bounds.left + window.scrollX + borderLeft),
      y: round2(bounds.top + window.scrollY + borderTop),
      w: round2(element.clientWidth),
      h: round2(element.clientHeight),
      r: round2(innerRadius)
    };
  }
  function documentCanvasRect() {
    const root = document.documentElement;
    const body = document.body;
    return {
      x: 0,
      y: 0,
      w: round2(Math.max(window.innerWidth, root.scrollWidth, body?.scrollWidth ?? 0)),
      h: round2(Math.max(window.innerHeight, root.scrollHeight, body?.scrollHeight ?? 0))
    };
  }
  function hasVisibleBackground(style) {
    const image = style.backgroundImage.trim();
    const color = style.backgroundColor.replace(/\s+/g, "").toLowerCase();
    return image !== "" && image !== "none" || color !== "" && color !== "transparent" && color !== "rgba(0,0,0,0)" && !color.endsWith("/0)");
  }
  function isElementVisible(el) {
    if (!el.isConnected || el.hidden || el.getClientRects().length === 0)
      return false;
    let hasAutomaticContentVisibility = false;
    let current = el;
    while (current) {
      if (current.hidden)
        return false;
      const style = getComputedStyle(current);
      if (style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden" || Number.parseFloat(style.opacity) === 0) {
        return false;
      }
      if (style.contentVisibility === "auto")
        hasAutomaticContentVisibility = true;
      current = composedParentElement(current);
    }
    if (hasAutomaticContentVisibility) {
      const probe = el.checkVisibility;
      if (typeof probe !== "function")
        return false;
      try {
        if (!probe.call(el, { contentVisibilityAuto: true }))
          return false;
      } catch {
        return false;
      }
    }
    return true;
  }
  function establishesFixedContainingBlock(element) {
    const style = getComputedStyle(element);
    const active = (value) => value !== void 0 && value !== "" && value !== "none";
    const contain = new Set(style.contain.split(/\s+/).filter(Boolean));
    const willChange = new Set(style.willChange.split(",").map((value) => value.trim()).filter(Boolean));
    const individualTransform = ["translate", "scale", "rotate"].some((property) => {
      const value = style.getPropertyValue(property).trim();
      return value !== "" && value !== "none";
    }) || willChange.has("transform");
    return active(style.transform) || individualTransform || active(style.perspective) || active(style.filter) || active(style.getPropertyValue("backdrop-filter")) || contain.has("layout") || contain.has("paint") || contain.has("strict") || contain.has("content") || style.contentVisibility === "auto" || style.contentVisibility === "hidden" || willChange.has("perspective") || willChange.has("filter");
  }
  function isViewportFixed(element) {
    let ancestor = composedParentElement(element);
    while (ancestor && ancestor !== document.documentElement) {
      if (establishesFixedContainingBlock(ancestor))
        return false;
      ancestor = composedParentElement(ancestor);
    }
    return true;
  }
  function fixedOrStickyAncestor(el) {
    let current = el;
    while (current) {
      const position = getComputedStyle(current).position;
      if (position === "fixed" || position === "sticky") {
        return {
          element: current,
          position,
          viewportFixed: position === "fixed" && isViewportFixed(current)
        };
      }
      current = composedParentElement(current);
    }
    return null;
  }
  function rootScrollCanCross(documentRect, viewportRect2) {
    const root = document.documentElement;
    const body = document.body;
    const maxX = Math.max(0, Math.max(root.scrollWidth, body?.scrollWidth ?? 0) - window.innerWidth);
    const maxY = Math.max(0, Math.max(root.scrollHeight, body?.scrollHeight ?? 0) - window.innerHeight);
    const axisCanCross = (documentStart, documentSize, viewportStart, viewportSize, maximumOffset) => {
      const lowerOffset = documentStart - (viewportStart + viewportSize);
      const upperOffset = documentStart + documentSize - viewportStart;
      return Math.max(0, lowerOffset) < Math.min(maximumOffset, upperOffset) || maximumOffset === 0 && lowerOffset < 0 && upperOffset > 0;
    };
    return axisCanCross(documentRect.x, documentRect.w, viewportRect2.x, viewportRect2.w, maxX) && axisCanCross(documentRect.y, documentRect.h, viewportRect2.y, viewportRect2.h, maxY);
  }
  function canMoveIntoIntersection(left, right) {
    if (intersects(left.visualRect, right.visualRect))
      return true;
    if (left.coordinateSpace === right.coordinateSpace)
      return false;
    const documentSide = left.coordinateSpace === "document" ? left : right;
    const viewportSide = left.coordinateSpace === "viewport" ? left : right;
    if (documentSide.scrollPath.length > 0 || viewportSide.scrollPath.length > 0)
      return false;
    return rootScrollCanCross(documentSide.rect, viewportSide.rect);
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
    if (/^(visibility|transform|transform-origin|transform-style|translate|scale|rotate|perspective|opacity|filter|backdrop-filter|mix-blend-mode|isolation|will-change|clip|clip-path|mask(?:-.+)?|offset-.+|background(?:-.+)?|border(?:-.+)?-radius|border-radius|z-index)$/i.test(propertyName)) {
      return "local-composition";
    }
    if (/^(color|accent-color|caret-color|border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?-color|outline-color|column-rule-color|text-decoration-color|text-emphasis-color)$/i.test(propertyName)) {
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
  function canClipLayerAsUnit(layer, native) {
    return establishesStackingContext(layer) && !isComposedAncestor(layer, native);
  }
  function activeModalDialogs() {
    return Array.from(document.querySelectorAll("dialog")).filter((dialog) => {
      try {
        return dialog.matches(":modal");
      } catch {
        return false;
      }
    });
  }
  function propertyDescriptor(target, property) {
    let current = target;
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, property);
      if (descriptor)
        return descriptor;
      current = Object.getPrototypeOf(current);
    }
    return void 0;
  }
  function prepareForElement(element) {
    for (const [container, callbacks] of scrollPreflightState.containers) {
      if (!isComposedAncestor(container, element))
        continue;
      for (const callback of callbacks)
        callback();
    }
  }
  function installGlobalProgrammaticPreflight() {
    const restores = [];
    const wrap = (prototype, name, before) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (!descriptor || typeof descriptor.value !== "function" || descriptor.configurable === false)
        return;
      const original = descriptor.value;
      const wrapped = function(...args) {
        before(this, args);
        return Reflect.apply(original, this, args);
      };
      try {
        Object.defineProperty(prototype, name, { ...descriptor, value: wrapped });
        restores.push(() => {
          if (Object.getOwnPropertyDescriptor(prototype, name)?.value === wrapped) {
            Object.defineProperty(prototype, name, descriptor);
          }
        });
      } catch {
      }
    };
    if (typeof Element !== "undefined") {
      wrap(Element.prototype, "scrollIntoView", (receiver) => {
        if (receiver instanceof Element)
          prepareForElement(receiver);
      });
    }
    if (typeof HTMLElement !== "undefined") {
      wrap(HTMLElement.prototype, "focus", (receiver) => {
        if (receiver instanceof Element)
          prepareForElement(receiver);
      });
    }
    const onClick = (event) => {
      if (!(event.target instanceof Element))
        return;
      const anchor = event.target.closest("a[href]");
      const href = anchor?.getAttribute("href");
      if (!href?.includes("#"))
        return;
      let url;
      try {
        url = new URL(href, document.baseURI);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash) {
        return;
      }
      const id = decodeURIComponent(url.hash.slice(1));
      const target = document.getElementById(id) ?? document.getElementsByName(id)[0];
      if (target)
        prepareForElement(target);
    };
    const onInvalid = (event) => {
      if (event.target instanceof Element)
        prepareForElement(event.target);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("click", onClick, true);
      document.addEventListener("invalid", onInvalid, true);
      restores.push(() => {
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("invalid", onInvalid, true);
      });
    }
    return () => {
      for (const restore of restores.reverse())
        restore();
    };
  }
  function installProgrammaticScrollPreflight(element, prepare) {
    const restores = [];
    const preflight = () => {
      try {
        prepare();
      } catch {
      }
    };
    for (const name of ["scroll", "scrollTo", "scrollBy"]) {
      if (Object.prototype.hasOwnProperty.call(element, name))
        continue;
      const original = element[name];
      if (typeof original !== "function")
        continue;
      const descriptor = propertyDescriptor(element, name);
      try {
        Object.defineProperty(element, name, {
          configurable: true,
          enumerable: descriptor?.enumerable ?? false,
          writable: true,
          value: function(...args) {
            if (this === element)
              preflight();
            return Reflect.apply(original, this, args);
          }
        });
        restores.push(() => {
          delete element[name];
        });
      } catch {
      }
    }
    for (const name of ["scrollTop", "scrollLeft"]) {
      if (Object.prototype.hasOwnProperty.call(element, name))
        continue;
      const descriptor = propertyDescriptor(element, name);
      if (typeof descriptor?.get !== "function" || typeof descriptor.set !== "function")
        continue;
      try {
        Object.defineProperty(element, name, {
          configurable: true,
          enumerable: descriptor.enumerable ?? false,
          get() {
            return Reflect.apply(descriptor.get, this, []);
          },
          set(value) {
            if (this === element)
              preflight();
            Reflect.apply(descriptor.set, this, [value]);
          }
        });
        restores.push(() => {
          delete element[name];
        });
      } catch {
      }
    }
    let callbacks = scrollPreflightState.containers.get(element);
    if (!callbacks) {
      callbacks = /* @__PURE__ */ new Set();
      scrollPreflightState.containers.set(element, callbacks);
    }
    callbacks.add(preflight);
    if (!scrollPreflightState.dispose) {
      scrollPreflightState.dispose = installGlobalProgrammaticPreflight();
    }
    let resizeObserver = null;
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement))
            continue;
          let root = node;
          while (root.parentElement && root.parentElement !== element) {
            root = root.parentElement;
          }
          if (root.parentElement === element)
            resizeObserver?.observe(root);
        }
      }
      const relevant = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target?.closest("[data-native-islands-presentation-face]"))
          return false;
        if (record.type !== "childList")
          return true;
        return [...record.addedNodes, ...record.removedNodes].some((node) => !(node instanceof Element) || !node.matches("[data-native-islands-presentation-face]"));
      });
      if (relevant)
        preflight();
    });
    mutationObserver?.observe(element, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    let resizeReady = false;
    resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!resizeReady) {
        resizeReady = true;
        return;
      }
      preflight();
    });
    resizeObserver?.observe(element);
    for (const child of Array.from(element.children ?? [])) {
      if (child instanceof HTMLElement)
        resizeObserver?.observe(child);
    }
    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      for (const restore of restores.reverse())
        restore();
      const current = scrollPreflightState.containers.get(element);
      current?.delete(preflight);
      if (current?.size === 0)
        scrollPreflightState.containers.delete(element);
      if (scrollPreflightState.containers.size === 0) {
        scrollPreflightState.dispose?.();
        scrollPreflightState.dispose = null;
      }
    };
  }
  class StackingService {
    constructor(onOpenRoot = () => void 0, automaticLayerCandidates = () => []) {
      this.automaticLayerCandidates = automaticLayerCandidates;
      this.compositionEnabled = false;
      this.innerScrollMode = "unsupported";
      this.natives = [];
      this.layers = [];
      this.onChange = null;
      this.onScroll = null;
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
      this.scrollIds = /* @__PURE__ */ new WeakMap();
      this.trackedScrollContainers = /* @__PURE__ */ new Map();
      this.scrollDisposers = /* @__PURE__ */ new Map();
      this.nextScrollId = 1;
      this.scrollSequence = 0;
      this.scrollPresentationSequence = 0;
      this.scrollScheduled = false;
      this.scrollSettledPending = false;
      this.scrollEndTimer = null;
      this.presentationPending = false;
      this.presentationActive = false;
      this.presentedScrollContainers = /* @__PURE__ */ new Set();
      this.movingScrollContainers = /* @__PURE__ */ new Set();
      this.lastNatives = [];
      this.lastLayers = [];
      this.runtimeClips = /* @__PURE__ */ new Map();
      this.runtimeBackgrounds = /* @__PURE__ */ new Map();
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
    degradeScrollContainers(ids, reason) {
      const failed = new Set(ids);
      for (const handle of this.natives) {
        const affected = independentScrollContainers(handle.el).some((container) => failed.has(this.idForScrollContainer(container)));
        if (affected) {
          handle.degradeToFallback(reason);
        }
      }
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
      this.releaseRuntimeClip(el);
      this.releaseRuntimeBackground(el);
      this.resizeObserver?.unobserve(el);
      this.refresh();
    }
    start(onChange, onScroll) {
      if (this.onChange)
        return;
      this.onChange = onChange;
      this.onScroll = onScroll ?? null;
      this.mutationObserver = new MutationObserver((records) => {
        let changed = false;
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (!target)
            continue;
          if (target instanceof HTMLElement && record.type === "attributes") {
            const runtimeClip = this.runtimeClips.get(target);
            const runtimeBackground = this.runtimeBackgrounds.get(target);
            if (runtimeClip && record.attributeName === "style") {
              const ownsClip = target.style.getPropertyValue("clip-path") === runtimeClip.appliedValue && target.style.getPropertyPriority("clip-path") === "";
              if (!ownsClip)
                this.releaseRuntimeClip(target);
            } else if (runtimeClip && record.attributeName === "data-ni-runtime-clip" && !target.hasAttribute("data-ni-runtime-clip")) {
              this.releaseRuntimeClip(target);
            } else if (runtimeClip && record.attributeName !== "style" && record.attributeName !== "data-ni-runtime-clip") {
              this.releaseRuntimeClip(target);
            }
            if (runtimeBackground && record.attributeName === "style") {
              const ownsBackground = Array.from(runtimeBackground.applied).every(([property, value]) => target.style.getPropertyValue(property) === value && target.style.getPropertyPriority(property) === "");
              if (!ownsBackground)
                this.releaseRuntimeBackground(target);
            } else if (runtimeBackground && record.attributeName === "data-ni-runtime-background" && !target.hasAttribute("data-ni-runtime-background")) {
              this.releaseRuntimeBackground(target);
            } else if (runtimeBackground && record.attributeName !== "style" && record.attributeName !== "data-ni-runtime-background") {
              this.releaseRuntimeBackground(target);
            }
          }
          changed = true;
          if (target instanceof HTMLStyleElement || target instanceof HTMLLinkElement || target.closest("style") !== null) {
            for (const element of this.runtimeBackgrounds.keys())
              this.releaseRuntimeBackground(element);
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
    idForScrollContainer(element) {
      const existing = this.scrollIds.get(element);
      if (existing)
        return existing;
      const id = `scroll-${this.nextScrollId++}`;
      this.scrollIds.set(element, id);
      return id;
    }
    syncScrollListeners(containers) {
      const next = new Map(containers.map((element) => [this.idForScrollContainer(element), element]));
      for (const [id, dispose] of this.scrollDisposers) {
        if (next.has(id))
          continue;
        dispose();
        this.scrollDisposers.delete(id);
        this.trackedScrollContainers.delete(id);
      }
      for (const [id, element] of next) {
        this.trackedScrollContainers.set(id, element);
        if (this.innerScrollMode !== "bridge" && !usesMotionPresentation(this.innerScrollMode) || this.scrollDisposers.has(id)) {
          continue;
        }
        const restoreProgrammaticPreflight = usesMotionPresentation(this.innerScrollMode) ? installProgrammaticScrollPreflight(element, () => this.prepareInnerScroll([id])) : () => void 0;
        const onScroll = () => {
          if (usesMotionPresentation(this.innerScrollMode))
            this.prepareInnerScroll([id]);
          else {
            this.scheduleScrollOffsets(false);
            this.scheduleScrollSettlement();
          }
        };
        const onScrollEnd = () => {
          if (usesMotionPresentation(this.innerScrollMode))
            this.scheduleScrollSettlement();
          else {
            if (this.scrollEndTimer !== null)
              window.clearTimeout(this.scrollEndTimer);
            this.scrollEndTimer = null;
            this.scheduleScrollOffsets(true);
          }
        };
        const onWheel = () => this.prepareInnerScroll([id]);
        const onInputStart = () => {
          this.prepareInnerScroll([id]);
        };
        const onKeyDown = (event) => {
          if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) {
            this.prepareInnerScroll([id]);
          }
        };
        const onInputTerminal = () => this.scheduleScrollSettlement();
        element.addEventListener("scroll", onScroll, { passive: true });
        element.addEventListener("scrollend", onScrollEnd, { passive: true });
        if (usesMotionPresentation(this.innerScrollMode)) {
          element.addEventListener("pointerdown", onInputStart, { capture: true, passive: true });
          element.addEventListener("touchstart", onInputStart, { capture: true, passive: true });
          element.addEventListener("wheel", onWheel, { capture: true, passive: true });
          element.addEventListener("keydown", onKeyDown, true);
          element.addEventListener("keyup", onInputTerminal, true);
          window.addEventListener("pointerup", onInputTerminal, { passive: true });
          window.addEventListener("pointercancel", onInputTerminal, { passive: true });
          window.addEventListener("touchend", onInputTerminal, { passive: true });
          window.addEventListener("touchcancel", onInputTerminal, { passive: true });
        }
        this.scrollDisposers.set(id, () => {
          restoreProgrammaticPreflight();
          element.removeEventListener("scroll", onScroll);
          element.removeEventListener("scrollend", onScrollEnd);
          element.removeEventListener("pointerdown", onInputStart, true);
          element.removeEventListener("touchstart", onInputStart, true);
          element.removeEventListener("wheel", onWheel, true);
          element.removeEventListener("keydown", onKeyDown, true);
          element.removeEventListener("keyup", onInputTerminal, true);
          window.removeEventListener("pointerup", onInputTerminal);
          window.removeEventListener("pointercancel", onInputTerminal);
          window.removeEventListener("touchend", onInputTerminal);
          window.removeEventListener("touchcancel", onInputTerminal);
        });
      }
      if (next.size === 0) {
        if (this.scrollEndTimer !== null)
          window.clearTimeout(this.scrollEndTimer);
        this.scrollEndTimer = null;
        this.presentationPending = false;
        this.presentationActive = false;
        this.presentedScrollContainers.clear();
        this.movingScrollContainers.clear();
        this.clearScrollPresentationFaces();
      }
    }
    scheduleScrollOffsets(settled) {
      if (this.innerScrollMode !== "bridge" && this.innerScrollMode !== "presentation" || !this.onScroll || this.innerScrollMode === "presentation" && !settled) {
        return;
      }
      if (settled) {
        if (this.scrollScheduled) {
          this.scrollSettledPending = true;
          return;
        }
        this.flushScrollOffsets(true);
        return;
      }
      if (this.scrollScheduled)
        return;
      this.scrollScheduled = true;
      requestAnimationFrame(() => {
        this.scrollScheduled = false;
        const finalSample = this.scrollSettledPending;
        this.scrollSettledPending = false;
        this.flushScrollOffsets(finalSample);
      });
    }
    prepareInnerScroll(containers) {
      if (!usesMotionPresentation(this.innerScrollMode) || containers.length === 0)
        return;
      const unprepared = containers.filter((id) => !this.presentedScrollContainers.has(id));
      if (unprepared.length === 0) {
        this.scheduleScrollSettlement();
        return;
      }
      const sequence = ++this.scrollPresentationSequence;
      const prepared = this.innerScrollMode === "native-presentation" || invokeScrollPresentationPrepare(unprepared, sequence);
      if (!prepared) {
        this.degradeScrollContainers(unprepared, "Native scroll presentation is unavailable.");
        return;
      }
      if (!this.presentationActive) {
        this.presentationActive = true;
      }
      for (const id of unprepared) {
        this.presentedScrollContainers.add(id);
        const element = this.trackedScrollContainers.get(id);
        if (element)
          this.movingScrollContainers.add(element);
      }
      this.syncScrollPresentationFaces(this.lastNatives);
      this.applyWebKnockouts(this.lastNatives, this.lastLayers);
      this.presentationPending = true;
      this.scheduleScrollSettlement();
    }
    scheduleScrollSettlement() {
      if (usesMotionPresentation(this.innerScrollMode) && !this.presentationPending)
        return;
      if (this.scrollEndTimer !== null)
        window.clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = window.setTimeout(() => {
        this.scrollEndTimer = null;
        if (!usesMotionPresentation(this.innerScrollMode)) {
          this.scheduleScrollOffsets(true);
          return;
        }
        this.presentationPending = false;
        this.presentationActive = false;
        this.presentedScrollContainers.clear();
        this.movingScrollContainers.clear();
        this.refresh();
        if (this.innerScrollMode === "presentation") {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              void this.flushScrollOffsets(true).finally(() => {
                requestAnimationFrame(() => this.clearScrollPresentationFaces());
              });
            });
          });
        }
      }, 120);
    }
    flushScrollOffsets(settled) {
      if (!this.onScroll || this.trackedScrollContainers.size === 0)
        return Promise.resolve();
      const offsets = Array.from(this.trackedScrollContainers, ([id, element]) => ({
        id,
        ...physicalScrollOffset(element)
      }));
      return this.onScroll({
        ...createEnvelope(),
        sequence: ++this.scrollSequence,
        offsets,
        ...settled ? { settled: true } : {}
      }).catch(() => void 0);
    }
    syncScrollPresentationFaces(natives) {
      if (!usesMotionPresentation(this.innerScrollMode))
        return;
      for (const native of natives) {
        native.handle.setScrollPresentation(this.presentationActive && native.active && (native.plane === "overlay" || Array.from(native.motionDependencies).some((container) => this.movingScrollContainers.has(container))));
      }
    }
    clearScrollPresentationFaces() {
      for (const native of this.lastNatives) {
        native.handle.setScrollPresentation(false);
      }
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
        "toggle",
        "close",
        "cancel",
        "contentvisibilityautostatechange"
      ];
      const onTopLayerState = (event) => {
        if (!(event.target instanceof Element))
          return;
        if (event.type === "beforetoggle") {
          const next = event.newState;
          noteTopLayerState(event.target, next === "open");
        } else if (event.type === "close" || event.type === "cancel") {
          noteTopLayerState(event.target, false);
        } else {
          const owner = activeTopLayerAncestor(event.target);
          if (owner)
            noteTopLayerState(owner, true);
        }
      };
      target.addEventListener("transitionrun", onTransitionRun, true);
      target.addEventListener("transitionend", onTransitionEnd, true);
      target.addEventListener("transitioncancel", onTransitionEnd, true);
      target.addEventListener("animationstart", onAnimationStart, true);
      target.addEventListener("animationend", onAnimationEnd, true);
      target.addEventListener("animationcancel", onAnimationEnd, true);
      target.addEventListener("load", onLoad, true);
      for (const eventName of styleStateEvents) {
        target.addEventListener(eventName, onStyleStateChange, true);
        target.addEventListener(eventName, onTopLayerState, true);
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
          target.removeEventListener(eventName, onTopLayerState, true);
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
      const modalDialogs = activeModalDialogs();
      const states = this.natives.map((handle, dom) => {
        handle.reconcileObservedStyles();
        let fallbackReason = null;
        let active = handle.canAttemptNative() && isElementVisible(handle.el);
        const positionedAncestor = handle.canAttemptNative() ? fixedOrStickyAncestor(handle.el) : null;
        const discoveredScrollPath = active ? scrollPath(handle.el) : [];
        const fixedAncestorContainsScroller = positionedAncestor?.viewportFixed === true && discoveredScrollPath.some((container) => isComposedAncestor(positionedAncestor.element, container));
        const coordinateSpace = positionedAncestor?.viewportFixed && !fixedAncestorContainsScroller ? "viewport" : "document";
        const plane = coordinateSpace === "viewport" || handle.requiresUnobscuredSurface ? "overlay" : "underlay";
        const coordinateScrollPath = coordinateSpace === "document" ? discoveredScrollPath : [];
        const modeledScrollPath = this.innerScrollMode === "unsupported" ? [] : coordinateScrollPath;
        const composition = auditIslandComposition(handle.islandId, handle.el, modeledScrollPath);
        const externalModal = modalDialogs.find((dialog) => !isComposedAncestor(dialog, handle.el));
        if (externalModal) {
          fallbackReason = "native islands outside an active modal use their web presentation";
          active = false;
        }
        const fullscreen = document.fullscreenElement;
        if (!fallbackReason && fullscreen && !isComposedAncestor(fullscreen, handle.el)) {
          fallbackReason = "native islands outside the fullscreen element use their web presentation";
          active = false;
        }
        if (positionedAncestor?.position === "sticky") {
          fallbackReason = "sticky native islands use the web presentation until sticky motion is modeled";
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
        let activeScrollPath = active ? coordinateScrollPath : [];
        if (active && activeScrollPath.length > MAX_SCROLL_PATH_DEPTH) {
          fallbackReason = "nested scroll depth exceeds the native host safety limit";
          active = false;
          activeScrollPath = [];
        } else if (active && activeScrollPath.length > 0 && this.innerScrollMode === "unsupported") {
          fallbackReason = "independent scroll containers are not supported by the active native transport";
          active = false;
          activeScrollPath = [];
        } else if (active && activeScrollPath.length > 0) {
          const invalidScrollport = activeScrollPath.some((container) => {
            const scrollport = scrollContainerRect(container);
            return !scrollport || !isSafeBridgeRect(scrollport);
          });
          if (invalidScrollport) {
            fallbackReason = "the scroll container geometry cannot be represented safely by the native host";
            active = false;
            activeScrollPath = [];
          }
        }
        let rect = null;
        let visualRect = null;
        if (active) {
          const bounds = coordinateSpace === "viewport" ? viewportRect(handle.el) : rectInsideScrollPath(handle.el, activeScrollPath);
          const viewportBounds = docRect(handle.el);
          visualRect = visibleRectInsideScrollPath(viewportBounds, activeScrollPath);
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
              visualRect = null;
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
          visualRect,
          plane,
          coordinateSpace,
          scrollPath: activeScrollPath,
          motionDependencies: new Set(activeScrollPath),
          fallbackReason
        };
      });
      this.degradeUnsupportedOverlaps(states);
      return states;
    }
    degradeUnsupportedOverlaps(states) {
      for (let leftIndex = 0; leftIndex < states.length; leftIndex++) {
        const left = states[leftIndex];
        if (!left.active || !left.rect || !left.visualRect)
          continue;
        for (let rightIndex = leftIndex + 1; rightIndex < states.length; rightIndex++) {
          const right = states[rightIndex];
          if (!right.active || !right.rect || !right.visualRect)
            continue;
          if (!sameCoordinatePath(left, right)) {
            if (!usesMotionPresentation(this.innerScrollMode) && intersects(left.visualRect, right.visualRect)) {
              const fallback2 = left.visualRect.w * left.visualRect.h <= right.visualRect.w * right.visualRect.h ? left : right;
              fallback2.fallbackReason = "overlapping native islands from different scroll containers use the web fallback";
              fallback2.active = false;
              fallback2.rect = null;
              fallback2.visualRect = null;
            }
            continue;
          }
          const unsupportedPartialOverlap = partialOverlap(left.visualRect, right.visualRect) && (hasComplexOpaqueShape(left.rect) || hasComplexOpaqueShape(right.rect));
          const unsupportedRoundedContainment = hasComplexOpaqueShape(left.rect) && contains(left.visualRect, right.visualRect) && !opaqueContainsRect(left.visualRect, right.visualRect) || hasComplexOpaqueShape(right.rect) && contains(right.visualRect, left.visualRect) && !opaqueContainsRect(right.visualRect, left.visualRect);
          const unsupported = unsupportedPartialOverlap || unsupportedRoundedContainment;
          if (!unsupported)
            continue;
          const area = (state) => (state.rect?.w ?? 0) * (state.rect?.h ?? 0);
          const fallback = area(left) <= area(right) ? left : right;
          fallback.fallbackReason = "partially overlapping complex opaque regions require native path boolean support";
          fallback.active = false;
          fallback.rect = null;
          fallback.visualRect = null;
        }
      }
    }
    resolveHostPlanes(natives, layers) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.rect || !native.visualRect)
            continue;
          const mustCrossWebView = layers.some((layer) => layer.coordinateSpace === "viewport" && above(native, layer) && canMoveIntoIntersection(native, layer)) || natives.some((other) => other !== native && other.active && other.plane === "overlay" && other.rect !== null && other.visualRect !== null && above(native, other) && canMoveIntoIntersection(native, other));
          if (!mustCrossWebView)
            continue;
          native.plane = "overlay";
          changed = true;
        }
      }
      changed = true;
      while (changed) {
        changed = false;
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.rect || !native.visualRect)
            continue;
          const webAbove = layers.some((layer) => isElementVisible(layer.el) && above(layer, native) && canMoveIntoIntersection(layer, native));
          const underlayNativeAbove = natives.some((other) => other !== native && other.active && other.plane === "underlay" && other.rect !== null && other.visualRect !== null && above(other, native) && canMoveIntoIntersection(other, native));
          if (webAbove || underlayNativeAbove)
            continue;
          native.plane = "overlay";
          changed = true;
        }
      }
    }
    detectOverlayCutoutConflicts(natives, layers) {
      for (const native of natives) {
        if (!native.active || native.plane !== "overlay" || !native.visualRect)
          continue;
        const unsupported = layers.find((layer) => layer.overlayCutoutIssue !== null && above(layer, native) && canMoveIntoIntersection(layer, native));
        if (!unsupported)
          continue;
        native.fallbackReason = unsupported.overlayCutoutIssue?.reason ?? "the upper web surface cannot become a native cutout";
        native.active = false;
        native.rect = null;
        native.visualRect = null;
      }
    }
    buildLayers() {
      const explicitElements = new Set(this.layers.map((layer) => layer.el));
      const layers = this.layers.filter((layer) => layer.el.isConnected).map((layer, dom2) => {
        const style = getComputedStyle(layer.el);
        const positionedAncestor = fixedOrStickyAncestor(layer.el);
        const coordinateSpace = positionedAncestor?.viewportFixed ? "viewport" : "document";
        const layerScrollPath = coordinateSpace === "viewport" ? [] : scrollPath(layer.el);
        const allowFixedPosition = positionedAncestor?.position === "fixed";
        const radius = uniformCssCornerRadius([
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]);
        const overlayClassification = automaticWebLayerCutoutIssue(layer.el, layerScrollPath[layerScrollPath.length - 1] ?? null, allowFixedPosition, true);
        return {
          el: layer.el,
          z: zIndex(layer.el),
          dom: dom2,
          rect: {
            ...coordinateSpace === "viewport" ? viewportRect(layer.el) : rectInsideScrollPath(layer.el, layerScrollPath),
            r: radius ?? 0
          },
          visualRect: { ...docRect(layer.el), r: radius ?? 0 },
          coordinateSpace,
          scrollPath: layerScrollPath,
          backgroundPaint: null,
          cutoutIssue: radius === null ? {
            reason: "declared opaque surfaces require a uniform pixel border-radius",
            mayMoveWithoutRefresh: false
          } : auditWebLayerCutoutComposition(layer.el, layerScrollPath, false, allowFixedPosition),
          overlayCutoutIssue: overlayClassification === void 0 ? {
            reason: "web paint above an overlay island must be opaque across its bounded box",
            mayMoveWithoutRefresh: false
          } : overlayClassification
        };
      });
      if (!this.compositionEnabled || this.natives.length === 0)
        return layers;
      const nativeElements = new Set(this.natives.map((native) => native.el));
      const htmlRuntimeBackground = this.runtimeBackgrounds.get(document.documentElement);
      const htmlHasBackground = htmlRuntimeBackground !== void 0 || hasVisibleBackground(getComputedStyle(document.documentElement));
      const nativeBounds = this.natives.filter((native) => native.el.isConnected).map((native) => {
        const positionedAncestor = fixedOrStickyAncestor(native.el);
        const coordinateSpace = positionedAncestor?.viewportFixed ? "viewport" : "document";
        const nativeScrollPath = coordinateSpace === "viewport" ? [] : scrollPath(native.el);
        const rect = coordinateSpace === "viewport" ? viewportRect(native.el) : rectInsideScrollPath(native.el, nativeScrollPath);
        return {
          el: native.el,
          z: zIndex(native.el),
          dom: 0,
          rect,
          visualRect: docRect(native.el),
          coordinateSpace,
          scrollPath: nativeScrollPath
        };
      });
      let dom = layers.length;
      for (const element of this.automaticLayerCandidates()) {
        if (!element.isConnected || explicitElements.has(element) || nativeElements.has(element) || this.natives.some((native) => isComposedAncestor(native.el, element))) {
          continue;
        }
        const positionedAncestor = fixedOrStickyAncestor(element);
        const coordinateSpace = positionedAncestor?.viewportFixed ? "viewport" : "document";
        const layerScrollPath = coordinateSpace === "viewport" ? [] : scrollPath(element);
        const allowFixedPosition = positionedAncestor?.position === "fixed";
        const runtimeBackground = this.runtimeBackgrounds.get(element);
        const sourceBackground = runtimeBackground?.source ?? separableBackgroundPaint(getComputedStyle(element));
        const isViewportRoot = element === document.body || element === document.documentElement;
        const paintsDocumentCanvas = element === document.documentElement || element === document.body && !htmlHasBackground;
        const backgroundPaint = sourceBackground !== null && (element.children.length > 0 || isViewportRoot) ? sourceBackground : null;
        const cached = layerScrollPath.length > 0 ? void 0 : this.automaticLayerClassifications.get(element);
        const issue = backgroundPaint !== null ? auditWebLayerCutoutComposition(element, layerScrollPath, true, allowFixedPosition) : cached === void 0 ? automaticWebLayerCutoutIssue(element, layerScrollPath[layerScrollPath.length - 1] ?? null, allowFixedPosition) : cached === false ? void 0 : cached;
        const overlayClassification = automaticWebLayerCutoutIssue(element, layerScrollPath[layerScrollPath.length - 1] ?? null, allowFixedPosition, true);
        const overlayCutoutIssue = overlayClassification === void 0 ? {
          reason: "web paint above an overlay island must be opaque across its bounded box",
          mayMoveWithoutRefresh: false
        } : overlayClassification;
        if (cached === void 0 && layerScrollPath.length === 0) {
          this.automaticLayerClassifications.set(element, issue === void 0 ? false : issue);
        }
        if (issue === void 0 || !isElementVisible(element))
          continue;
        const visualRect = paintsDocumentCanvas ? documentCanvasRect() : docRect(element);
        const rect = paintsDocumentCanvas ? visualRect : coordinateSpace === "viewport" ? viewportRect(element) : rectInsideScrollPath(element, layerScrollPath);
        const layer = {
          el: element,
          z: zIndex(element),
          dom: dom++,
          rect
        };
        const layerViewport = scrollPathViewport(layerScrollPath);
        if (!nativeBounds.some((native) => canMoveIntoIntersection({
          rect,
          visualRect,
          coordinateSpace,
          scrollPath: layerScrollPath
        }, native) || layerViewport !== null && intersects(layerViewport, native.visualRect))) {
          continue;
        }
        const style = getComputedStyle(element);
        const radius = paintsDocumentCanvas ? 0 : uniformCssCornerRadius([
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]);
        layers.push({
          ...layer,
          rect: { ...rect, r: radius ?? 0 },
          visualRect: { ...visualRect, r: radius ?? 0 },
          coordinateSpace,
          scrollPath: layerScrollPath,
          backgroundPaint,
          cutoutIssue: radius === null ? {
            reason: "automatically detected web surfaces require a uniform pixel border-radius",
            mayMoveWithoutRefresh: false
          } : issue,
          overlayCutoutIssue
        });
      }
      return layers;
    }
    detectBackgroundPaintConflicts(natives, layers) {
      for (const layer of layers) {
        if (!layer.backgroundPaint)
          continue;
        const style = getComputedStyle(layer.el);
        const backgroundClips = style.backgroundClip.split(",").map((value) => value.trim()).filter(Boolean);
        const backgroundClip = backgroundClips[backgroundClips.length - 1] ?? "border-box";
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.visualRect || !above(native, layer) || !intersects(native.visualRect, layer.visualRect)) {
            continue;
          }
          if (canClipLayerAsUnit(layer.el, native.handle.el))
            continue;
          const unsafe = backgroundClip !== "border-box" || directTextIntersects(layer.el, native.visualRect) || hasVisiblePseudoElement(layer.el) || /\binset\b/i.test(style.boxShadow) || !borderContains(layer.el, native.visualRect);
          if (!unsafe)
            continue;
          native.fallbackReason = "overlapping web paint cannot be separated from its background";
          native.active = false;
          native.rect = null;
          native.visualRect = null;
        }
      }
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
          if (!native.active || native.plane !== "underlay" || !native.rect || !native.visualRect || !above(native, layer) || !issue.mayMoveWithoutRefresh && !intersects(native.visualRect, layer.visualRect)) {
            continue;
          }
          const covered = layers.some((cover) => cover !== layer && cover.cutoutIssue === null && isElementVisible(cover.el) && above(cover, native) && opaqueContainsRect(cover.visualRect, layer.visualRect));
          if (covered)
            continue;
          native.fallbackReason = issue.reason;
          native.active = false;
          native.rect = null;
          native.visualRect = null;
        }
      }
      for (const native of natives) {
        if (!native.active || !native.visualRect)
          continue;
        const nativeScrollViewport = scrollPathViewport(native.scrollPath);
        for (const layer of layers) {
          if (layer.cutoutIssue !== null || native.scrollPath.includes(layer.el) || sameScrollPath(layer.scrollPath, native.scrollPath) || !above(layer, native) || !isElementVisible(layer.el)) {
            continue;
          }
          if (usesMotionPresentation(this.innerScrollMode))
            continue;
          const layerScrollViewport = scrollPathViewport(layer.scrollPath);
          const canCross = intersects(layer.visualRect, native.visualRect) || nativeScrollViewport !== null && intersects(layer.visualRect, nativeScrollViewport) || layerScrollViewport !== null && intersects(layerScrollViewport, native.visualRect);
          if (!canCross)
            continue;
          native.fallbackReason = "web layers from a different scroll container use the web fallback";
          native.active = false;
          native.rect = null;
          native.visualRect = null;
          break;
        }
      }
    }
    enforceUnobscuredSurfaces(natives, layers) {
      for (const native of natives) {
        if (!native.active || !native.rect || !native.handle.requiresUnobscuredSurface)
          continue;
        const nativeRect = native.visualRect;
        if (!nativeRect)
          continue;
        const webSurfaceAbove = layers.some((layer) => isElementVisible(layer.el) && above(layer, native) && intersects(layer.visualRect, nativeRect));
        const nativeSurfaceAbove = natives.some((other) => other !== native && other.active && other.visualRect !== null && above(other, native) && intersects(other.visualRect, nativeRect));
        if (!webSurfaceAbove && !nativeSurfaceAbove)
          continue;
        native.fallbackReason = "this protected native surface must remain completely unobscured";
        native.active = false;
        native.rect = null;
        native.visualRect = null;
      }
    }
    resolveMotionDependencies(natives, layers) {
      for (const native of natives) {
        native.motionDependencies = new Set(native.scrollPath);
        if (!native.active || !native.visualRect)
          continue;
        for (const layer of layers) {
          if (sameCoordinatePath(layer, native) || !pathsMayCross(native.visualRect, native.scrollPath, layer.visualRect, layer.scrollPath)) {
            continue;
          }
          addSymmetricPathDifference(native.motionDependencies, native.scrollPath, layer.scrollPath);
        }
        for (const other of natives) {
          if (other === native || !other.active || !other.visualRect || sameCoordinatePath(other, native) || !pathsMayCross(native.visualRect, native.scrollPath, other.visualRect, other.scrollPath)) {
            continue;
          }
          addSymmetricPathDifference(native.motionDependencies, native.scrollPath, other.scrollPath);
        }
        if (native.motionDependencies.size <= MAX_MOTION_DEPENDENCIES)
          continue;
        native.fallbackReason = "scroll composition dependencies exceed the native host safety limit";
        native.active = false;
        native.rect = null;
        native.visualRect = null;
        native.scrollPath = [];
        native.motionDependencies.clear();
      }
    }
    enforceRegionCapacity(natives, layers) {
      for (const native of natives) {
        if (!native.active || !native.rect || !native.visualRect)
          continue;
        const crossingLayers = layers.filter((layer) => isElementVisible(layer.el) && above(layer, native) && canMoveIntoIntersection(layer, native));
        const cutoutCount = native.plane === "overlay" ? crossingLayers.filter((layer) => layer.cutoutIssue === null && layer.overlayCutoutIssue === null).length : 0;
        const exclusionCount = crossingLayers.filter((layer) => {
          const style = getComputedStyle(layer.el);
          return style.visibility === "visible" && style.pointerEvents !== "none" && inertAncestor(layer.el) === null;
        }).length + natives.filter((other) => other !== native && other.active && other.rect !== null && other.visualRect !== null && above(other, native) && intersects(other.visualRect, native.visualRect)).length;
        if (cutoutCount <= MAX_REGIONS_PER_COMPONENT && exclusionCount <= MAX_REGIONS_PER_COMPONENT)
          continue;
        native.fallbackReason = "overlapping composition regions exceed the native host safety limit";
        native.active = false;
        native.rect = null;
        native.visualRect = null;
        native.scrollPath = [];
        native.motionDependencies.clear();
      }
    }
    syncCompositionFallbacks(natives) {
      for (const native of natives)
        native.handle.setCompositionFallback(native.fallbackReason);
    }
    releaseRuntimeClip(element) {
      const state = this.runtimeClips.get(element);
      if (!state)
        return;
      if (element.style.getPropertyValue("clip-path") === state.appliedValue) {
        if (state.originalValue) {
          element.style.setProperty("clip-path", state.originalValue, state.originalPriority);
        } else {
          element.style.removeProperty("clip-path");
        }
      }
      element.removeAttribute("data-ni-runtime-clip");
      this.runtimeClips.delete(element);
    }
    releaseRuntimeBackground(element) {
      const state = this.runtimeBackgrounds.get(element);
      if (!state)
        return;
      for (const property of BACKGROUND_PROPERTIES) {
        if (element.style.getPropertyValue(property) !== state.applied.get(property))
          continue;
        const original = state.original.get(property);
        if (original?.value) {
          element.style.setProperty(property, original.value, original.priority);
        } else {
          element.style.removeProperty(property);
        }
      }
      element.removeAttribute("data-ni-runtime-background");
      this.runtimeBackgrounds.delete(element);
    }
    applyRuntimeBackground(layer, holes) {
      const source = layer.backgroundPaint;
      if (!source)
        return false;
      let state = this.runtimeBackgrounds.get(layer.el);
      if (!state) {
        state = {
          original: new Map(BACKGROUND_PROPERTIES.map((property) => [
            property,
            {
              value: layer.el.style.getPropertyValue(property),
              priority: layer.el.style.getPropertyPriority(property)
            }
          ])),
          applied: /* @__PURE__ */ new Map(),
          source
        };
        this.runtimeBackgrounds.set(layer.el, state);
      }
      const width = round2(layer.rect.w);
      const height = round2(layer.rect.h);
      const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const path = escapeXml(knockoutPathData(layer.rect, holes));
      const svg = source.image === "none" ? "" : [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`,
        ` viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`,
        `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">`,
        `<path fill="white" fill-rule="evenodd" d="${path}"/></mask>`,
        `<foreignObject width="${width}" height="${height}" mask="url(#m)">`,
        `<div xmlns="http://www.w3.org/1999/xhtml" style="${escapeXml([
          "box-sizing:border-box",
          `width:${width}px`,
          `height:${height}px`,
          `border-style:solid`,
          `border-color:transparent`,
          `border-width:${source.borderWidths.join(" ")}`,
          `background-color:${source.color}`,
          `background-image:${source.image}`,
          `background-size:${source.size}`,
          `background-position:${source.position}`,
          `background-repeat:${source.repeat}`,
          `background-origin:${source.origin}`,
          `background-clip:${source.clip}`,
          `background-attachment:${source.attachment}`,
          `background-blend-mode:${source.blendMode}`
        ].join(";"))}"></div></foreignObject></svg>`
      ].join("");
      const values = /* @__PURE__ */ new Map([
        ["background-color", "transparent"],
        ["background-repeat", "no-repeat"],
        ["background-origin", "border-box"],
        ["background-clip", "border-box"],
        ["background-attachment", "scroll"],
        ["background-blend-mode", "normal"]
      ]);
      if (source.image === "none") {
        const images = [];
        const sizes = [];
        const positions = [];
        for (const rect of complementRects(layer.rect, holes)) {
          images.push(`linear-gradient(${source.color}, ${source.color})`);
          sizes.push(`${round2(rect.w)}px ${round2(rect.h)}px`);
          positions.push(`${round2(rect.x - layer.rect.x)}px ${round2(rect.y - layer.rect.y)}px`);
        }
        for (const hole of holes) {
          const radius = Math.min(hole.r ?? 0, hole.w / 2, hole.h / 2);
          if (radius <= 0)
            continue;
          const left = round2(hole.x - layer.rect.x);
          const top = round2(hole.y - layer.rect.y);
          const right = round2(left + hole.w - radius);
          const bottom = round2(top + hole.h - radius);
          const size = `${round2(radius)}px ${round2(radius)}px`;
          const stops = `transparent ${round2(radius)}px, ${source.color} ${round2(radius)}px`;
          for (const [center, x, y] of [
            ["100% 100%", left, top],
            ["0% 100%", right, top],
            ["100% 0%", left, bottom],
            ["0% 0%", right, bottom]
          ]) {
            images.push(`radial-gradient(circle at ${center}, ${stops})`);
            sizes.push(size);
            positions.push(`${x}px ${y}px`);
          }
        }
        if (images.length > 512) {
          this.releaseRuntimeBackground(layer.el);
          return false;
        }
        values.set("background-image", images.length > 0 ? images.join(", ") : "none");
        values.set("background-size", sizes.length > 0 ? sizes.join(", ") : "auto");
        values.set("background-position", positions.length > 0 ? positions.join(", ") : "0px 0px");
      } else {
        values.set("background-image", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
        values.set("background-size", `${round2(layer.rect.w)}px ${round2(layer.rect.h)}px`);
        values.set("background-position", "0px 0px");
      }
      for (const [property, value] of values) {
        if (layer.el.style.getPropertyValue(property) !== value || layer.el.style.getPropertyPriority(property) !== "") {
          layer.el.style.setProperty(property, value);
        }
      }
      state.applied = new Map(BACKGROUND_PROPERTIES.map((property) => [property, layer.el.style.getPropertyValue(property)]));
      if (!layer.el.hasAttribute("data-ni-runtime-background")) {
        layer.el.setAttribute("data-ni-runtime-background", "");
      }
      const applied = getComputedStyle(layer.el);
      const transparent = applied.backgroundColor === "transparent" || applied.backgroundColor === "rgba(0, 0, 0, 0)";
      const expectedImage = values.get("background-image");
      if (transparent && (expectedImage === "none" || applied.backgroundImage !== "" && applied.backgroundImage !== "none")) {
        return true;
      }
      this.releaseRuntimeBackground(layer.el);
      return false;
    }
    applyWebKnockouts(natives, layers) {
      let degraded = false;
      const currentLayers = new Set(layers.map((layer) => layer.el));
      for (const element of this.runtimeClips.keys()) {
        if (!currentLayers.has(element))
          this.releaseRuntimeClip(element);
      }
      for (const element of this.runtimeBackgrounds.keys()) {
        if (!currentLayers.has(element))
          this.releaseRuntimeBackground(element);
      }
      for (const layer of layers) {
        const candidates = natives.filter((native) => native.active && native.plane === "underlay" && native.rect !== null && native.visualRect !== null && layer.cutoutIssue === null && above(native, layer) && intersects(native.visualRect, layer.visualRect) && !this.relativePathIsMoving(native.scrollPath, layer.scrollPath));
        const holeCandidates = candidates.filter((native) => {
          if (!native.rect || !native.visualRect)
            return false;
          if (sameCoordinatePath(native, layer))
            return true;
          const fullRect = { ...docRect(native.el), r: native.rect.r };
          if (fullyVisibleInsideScrollPath(fullRect, native.scrollPath))
            return true;
          native.fallbackReason = "partially clipped rounded native islands use their web presentation across scroll paths";
          native.active = false;
          native.rect = null;
          native.visualRect = null;
          degraded = true;
          return false;
        });
        const holes = this.compositionEnabled ? disjointHoles(holeCandidates.map((native) => sameCoordinatePath(native, layer) ? native.rect : {
          ...rectInScrollPathCoordinates(native.visualRect, layer.scrollPath),
          r: native.rect.r
        })) : [];
        if (holes.length === 0) {
          this.releaseRuntimeClip(layer.el);
          this.releaseRuntimeBackground(layer.el);
          continue;
        }
        const clipLayerAsUnit = layer.backgroundPaint !== null && holeCandidates.every((native) => canClipLayerAsUnit(layer.el, native.handle.el));
        if (layer.backgroundPaint && !clipLayerAsUnit) {
          this.releaseRuntimeClip(layer.el);
          if (this.applyRuntimeBackground(layer, holes))
            continue;
          for (const native of natives) {
            if (!native.active || !native.visualRect || !above(native, layer) || !intersects(native.visualRect, layer.visualRect)) {
              continue;
            }
            native.fallbackReason = "the page background cannot be separated from its web content";
            native.active = false;
            native.rect = null;
            native.visualRect = null;
            degraded = true;
          }
          continue;
        }
        this.releaseRuntimeBackground(layer.el);
        const clip = holes.some((hole) => opaqueContainsRect(hole, layer.rect)) ? "inset(50%)" : knockoutPath(layer.rect, holes);
        const existing = this.runtimeClips.get(layer.el);
        if (!existing) {
          this.runtimeClips.set(layer.el, {
            originalValue: layer.el.style.getPropertyValue("clip-path"),
            originalPriority: layer.el.style.getPropertyPriority("clip-path"),
            appliedValue: ""
          });
        }
        if (layer.el.style.getPropertyValue("clip-path") !== clip || layer.el.style.getPropertyPriority("clip-path") !== "") {
          layer.el.style.setProperty("clip-path", clip);
        }
        const state = existing ?? this.runtimeClips.get(layer.el);
        if (state)
          state.appliedValue = layer.el.style.getPropertyValue("clip-path");
        layer.el.setAttribute("data-ni-runtime-clip", "");
      }
      if (degraded)
        this.applyWebKnockouts(natives, layers);
    }
    relativePathIsMoving(nativePath, layerPath) {
      if (!this.presentationActive || this.movingScrollContainers.size === 0)
        return false;
      const nativeSet = new Set(nativePath);
      const layerSet = new Set(layerPath);
      for (const container of this.movingScrollContainers) {
        if (nativeSet.has(container) !== layerSet.has(container))
          return true;
      }
      return false;
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
      this.resolveHostPlanes(natives, layers);
      this.detectBackgroundPaintConflicts(natives, layers);
      this.detectLayerCoordinateConflicts(natives, layers);
      this.detectOverlayCutoutConflicts(natives, layers);
      this.enforceUnobscuredSurfaces(natives, layers);
      this.resolveMotionDependencies(natives, layers);
      this.enforceRegionCapacity(natives, layers);
      this.syncScrollPresentationFaces(natives);
      this.lastNatives = natives;
      this.lastLayers = layers;
      this.applyWebKnockouts(natives, layers);
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
      const region = (layer) => ({
        rect: layer.rect,
        coordinateSpace: layer.coordinateSpace,
        scrollPath: layer.scrollPath.map((element) => this.idForScrollContainer(element))
      });
      const nativeRegion = (native) => ({
        rect: native.rect,
        coordinateSpace: native.coordinateSpace,
        scrollPath: native.scrollPath.map((element) => this.idForScrollContainer(element))
      });
      const cutouts = {};
      const exclusions = {};
      for (const native of natives) {
        if (!native.active || !native.rect)
          continue;
        if (!native.visualRect)
          continue;
        const nativeRect = native.visualRect;
        cutouts[native.handle.islandId] = native.plane === "overlay" ? layers.filter((layer) => layer.cutoutIssue === null && layer.overlayCutoutIssue === null && isElementVisible(layer.el) && above(layer, native) && canMoveIntoIntersection(layer, native)).map(region) : [];
        exclusions[native.handle.islandId] = layers.filter((layer) => touchable(layer) && above(layer, native) && canMoveIntoIntersection(layer, native)).map(region);
        for (const other of natives) {
          if (other !== native && other.active && other.rect && other.visualRect && above(other, native) && intersects(other.visualRect, nativeRect)) {
            exclusions[native.handle.islandId].push(nativeRegion(other));
          }
        }
      }
      const components = natives.filter((native) => !native.handle.degraded).map((native) => ({
        id: native.handle.islandId,
        type: native.handle.type,
        plane: native.plane,
        coordinateSpace: native.coordinateSpace,
        scrollPath: native.scrollPath.map((element) => this.idForScrollContainer(element)),
        motionDependencies: Array.from(native.motionDependencies, (element) => this.idForScrollContainer(element)),
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
      const activeScrollContainers = Array.from(new Set(natives.filter((native) => native.active).flatMap((native) => Array.from(native.motionDependencies))));
      this.syncScrollListeners(activeScrollContainers);
      const referencedScrollContainers = Array.from(new Set(natives.filter((native) => !native.handle.degraded).flatMap((native) => Array.from(native.motionDependencies))));
      const scrollContainers = referencedScrollContainers.flatMap((element) => {
        const visualRect = scrollContainerRect(element);
        if (!visualRect)
          return [];
        const ancestorPath = scrollPath(element);
        const rect = rectInScrollPathCoordinates(visualRect, ancestorPath);
        const offset = physicalScrollOffset(element);
        return [
          {
            id: this.idForScrollContainer(element),
            rect,
            scrollPath: ancestorPath.map((ancestor) => this.idForScrollContainer(ancestor)),
            contentWidth: round2(element.scrollWidth),
            contentHeight: round2(element.scrollHeight),
            offsetX: offset.x,
            offsetY: offset.y
          }
        ];
      });
      return {
        ...createEnvelope(),
        ...this.innerScrollMode === "presentation" ? { motionPresentation: true } : {},
        components,
        scrollContainers,
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
      this.pendingScrollOffsets = null;
      this.applyingScrollOffsets = false;
      this.applyingLayouts = 0;
    }
    get available() {
      return this.transport.available;
    }
    get usesWebScrollPresentation() {
      return this.transport.innerScrollMode === "presentation";
    }
    get supportsScrollPresentation() {
      return this.transport.innerScrollMode === "presentation" || this.transport.innerScrollMode === "native-presentation";
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
      this.stacking.innerScrollMode = transport.innerScrollMode;
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
      this.knownElements.add(document.documentElement);
      this.scan(document.body);
      this.domObserver = new MutationObserver((records) => this.handleDomMutations(records));
      this.domObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-native-islands-opaque-surface"],
        childList: true,
        subtree: true
      });
      this.stacking.start((payload) => {
        this.applyingLayouts++;
        return this.transport.applyLayout(payload).catch((error) => {
          const reason = error instanceof Error && error.message ? `Native layout rejected: ${error.message}` : "Native layout rejected by the platform bridge.";
          for (const component of payload.components) {
            this.degradeIsland(component.id, reason);
          }
          throw error;
        }).finally(() => {
          this.applyingLayouts--;
          if (this.applyingLayouts === 0 && this.pendingScrollOffsets)
            void this.flushScrollOffsets();
        });
      }, (payload) => this.enqueueScrollOffsets(payload));
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
    enqueueScrollOffsets(payload) {
      this.pendingScrollOffsets = payload;
      if (!this.applyingScrollOffsets && this.applyingLayouts === 0)
        void this.flushScrollOffsets();
      return Promise.resolve();
    }
    async flushScrollOffsets() {
      if (this.applyingScrollOffsets || this.applyingLayouts > 0)
        return;
      this.applyingScrollOffsets = true;
      try {
        while (this.pendingScrollOffsets) {
          const payload = this.pendingScrollOffsets;
          this.pendingScrollOffsets = null;
          try {
            await this.transport.applyScrollOffsets(payload);
          } catch (error) {
            const reason = error instanceof Error && error.message ? `Native scroll synchronization failed: ${error.message}` : "Native scroll synchronization failed.";
            this.stacking.degradeScrollContainers(payload.offsets.map((offset) => offset.id), reason);
            this.pendingScrollOffsets = null;
          }
        }
      } finally {
        this.applyingScrollOffsets = false;
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
  const WEB_PRESENTATION_OVERRIDES = /* @__PURE__ */ new Map([
    ["background-clip", "text"],
    ["-webkit-background-clip", "text"],
    ["border-image-source", "linear-gradient(transparent, transparent)"],
    ["border-image-slice", "1"]
  ]);
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
      observedAttributes,
      requiresUnobscuredSurface: options.requiresUnobscuredSurface ?? false
    };
    registerIslandContract(options.nativeComponent, contract);
    class DefinedNativeIsland extends HTMLElement {
      constructor() {
        super();
        this.islandId = `native-island-${++definitionState.islandSequence}`;
        this.type = options.nativeComponent;
        this.interactive = options.isInteractive ?? false;
        this.requiresUnobscuredSurface = options.requiresUnobscuredSurface ?? false;
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
        this.presentationFace = null;
        this.presentationPaint = null;
        this.scrollPresentationActive = false;
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
        if (nativeIslandsRuntime.usesWebScrollPresentation) {
          this.renderPresentationFace();
        } else if ((options.accessibility ?? "web") === "web") {
          this.renderAccessibilityFace();
        }
        this.hideWebPresentation();
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
          this.scrollPresentationActive = false;
          this.restoreWebPresentation();
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
        this.presentationFace = null;
        this.scrollPresentationActive = false;
        this.restoreWebPresentation();
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
          this.restoreWebPresentation();
          if (!wasFallback)
            this.renderFallback();
          this.setAttribute("data-native-islands-composition-fallback", "");
        } else {
          this.restoreFallbackPresentation();
          if (nativeIslandsRuntime.usesWebScrollPresentation) {
            this.renderPresentationFace();
          } else if ((options.accessibility ?? "web") === "web") {
            this.renderAccessibilityFace();
          }
          this.hideWebPresentation();
          if (this.nativeCreated)
            this.scheduleUpdate(false);
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
      setScrollPresentation(active) {
        this.scrollPresentationActive = active;
        if (!nativeIslandsRuntime.supportsScrollPresentation)
          return;
        if (!this.presentationFace && this.nativeCreated && !this.degraded && this.compositionFallbackReason === null) {
          this.renderPresentationFace();
        }
        this.presentationFace?.style.setProperty("visibility", active ? "visible" : "hidden", "important");
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
      scheduleUpdate(refreshPresentation = true) {
        if (this.updateScheduled)
          return;
        this.updateScheduled = true;
        queueMicrotask(() => {
          this.updateScheduled = false;
          if (!this.connected || this.degraded || !nativeIslandsRuntime.available)
            return;
          if (nativeIslandsRuntime.usesWebScrollPresentation && refreshPresentation) {
            this.renderPresentationFace();
          } else if ((options.accessibility ?? "web") === "web") {
            this.renderAccessibilityFace();
          }
          void this.send("update");
        });
      }
      renderFallback() {
        this.restoreWebPresentation();
        this.restoreFallbackPresentation();
        this.accessibilityFace = null;
        this.presentationFace = null;
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
      hideWebPresentation() {
        if (this.presentationPaint || typeof this.style.getPropertyValue !== "function")
          return;
        this.presentationPaint = new Map(Array.from(WEB_PRESENTATION_OVERRIDES.keys(), (property) => [
          property,
          {
            value: this.style.getPropertyValue(property),
            priority: this.style.getPropertyPriority(property)
          }
        ]));
        for (const [property, value] of WEB_PRESENTATION_OVERRIDES) {
          this.style.setProperty(property, value, "important");
        }
        this.setAttribute("data-native-islands-presentation-hidden", "");
      }
      restoreWebPresentation() {
        const original = this.presentationPaint;
        if (!original)
          return;
        for (const [property, value] of WEB_PRESENTATION_OVERRIDES) {
          if (this.style.getPropertyValue(property) !== value || this.style.getPropertyPriority(property) !== "important") {
            continue;
          }
          const previous = original.get(property);
          if (previous?.value)
            this.style.setProperty(property, previous.value, previous.priority);
          else
            this.style.removeProperty(property);
        }
        this.removeAttribute("data-native-islands-presentation-hidden");
        this.presentationPaint = null;
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
        this.accessibilityFace = null;
        this.presentationFace = null;
      }
      renderPresentationFace() {
        this.presentationFace?.remove();
        this.accessibilityFace?.remove();
        const face = document.createElement("div");
        for (const name of this.getAttributeNames()) {
          if (name === "id" || name === "style" || name === "data-native-islands-fallback" || name === "data-native-islands-composition-fallback") {
            continue;
          }
          const value = this.getAttribute(name);
          if (value !== null)
            face.setAttribute(name, value);
        }
        face.setAttribute("data-native-islands-presentation-face", "");
        options.renderFallback(face);
        const hostStyle = typeof getComputedStyle === "function" ? getComputedStyle(this) : null;
        face.style.setProperty("box-sizing", "border-box", "important");
        face.style.setProperty("width", "100%", "important");
        face.style.setProperty("height", "100%", "important");
        face.style.setProperty("max-width", "100%", "important");
        face.style.setProperty("max-height", "100%", "important");
        face.style.setProperty("min-width", "0", "important");
        face.style.setProperty("min-height", "0", "important");
        face.style.setProperty("border-radius", "inherit", "important");
        face.style.setProperty("overflow", "hidden", "important");
        if (hostStyle) {
          face.style.setProperty("background-color", hostStyle.backgroundColor, "important");
          face.style.setProperty("background-image", hostStyle.backgroundImage, "important");
          face.style.setProperty("background-size", hostStyle.backgroundSize, "important");
          face.style.setProperty("background-position", hostStyle.backgroundPosition, "important");
          face.style.setProperty("background-repeat", hostStyle.backgroundRepeat, "important");
          face.style.setProperty("border-color", hostStyle.borderColor, "important");
          face.style.setProperty("border-style", hostStyle.borderStyle, "important");
          face.style.setProperty("border-width", hostStyle.borderWidth, "important");
          face.style.setProperty("color", hostStyle.color, "important");
        }
        face.style.setProperty("pointer-events", "none", "important");
        face.style.setProperty("visibility", this.scrollPresentationActive ? "visible" : "hidden", "important");
        face.setAttribute("aria-hidden", "true");
        face.inert = true;
        this.append(face);
        this.presentationFace = face;
        if ((options.accessibility ?? "web") === "web")
          this.renderAccessibilityFace();
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
  const SCROLL_PRESENTATION_PREPARE = "__CAPACITOR_NATIVE_ISLANDS_SCROLL_PREPARE__";
  const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9._:-]{0,63}$/;
  const eventListeners = /* @__PURE__ */ new Map();
  let eventChannelOpen = false;
  let runtimeInitialized = false;
  let protocolVersion;
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
    protocolVersion = payload.protocolVersion;
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
  function installScrollPresentationPrepare() {
    const exec = cordovaWindow()?.cordova?.exec;
    if (!exec || platform() !== "android") return;
    const scope = window;
    scope[SCROLL_PRESENTATION_PREPARE] = (containerIds, sequence) => {
      if (!Array.isArray(containerIds) || containerIds.length === 0 || containerIds.length > 256 || !containerIds.every((id) => typeof id === "string" && IDENTIFIER.test(id)) || new Set(containerIds).size !== containerIds.length || !Number.isSafeInteger(sequence) || sequence < 0 || protocolVersion === void 0) {
        return false;
      }
      void call("prepareScrollPresentation", {
        protocolVersion,
        containerIds,
        sequence
      }).catch(() => void 0);
      return true;
    };
  }
  function createCordovaTransport() {
    const exec = cordovaWindow()?.cordova?.exec;
    return {
      available: Boolean(exec),
      innerScrollMode: platform() === "ios" ? "native" : platform() === "android" ? "presentation" : "unsupported",
      applyLayout(payload) {
        return call("applyLayout", payload);
      },
      applyScrollOffsets(payload) {
        return call("applyScrollOffsets", payload);
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
  function requiresUnobscuredSurface() {
    const exec = cordovaWindow()?.cordova?.exec;
    if (!exec) return Promise.resolve(true);
    return new Promise((resolve) => {
      exec(
        (value) => {
          const capabilities = value;
          resolve(capabilities?.requiresUnobscuredSurface !== false);
        },
        () => resolve(true),
        SERVICE,
        "capabilities",
        []
      );
    });
  }
  function initializeCordovaRuntime() {
    if (runtimeInitialized || platform() !== "android") return;
    const transport = createCordovaTransport();
    if (!transport.available) return;
    runtimeInitialized = true;
    installScrollPresentationPrepare();
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
    strokeWidth: "border-top-width",
    pressedCornerRadius: "--os-location-button-pressed-corner-radius",
    clickablePadding: "--os-location-button-clickable-padding"
  };
  const OBSERVED_ATTRIBUTES = ["text-type"];
  const OBSERVED_STYLES = [
    STYLE_PROPERTIES.backgroundColor,
    STYLE_PROPERTIES.textColor,
    STYLE_PROPERTIES.iconTint,
    STYLE_PROPERTIES.strokeColor,
    STYLE_PROPERTIES.strokeWidth,
    STYLE_PROPERTIES.pressedCornerRadius,
    STYLE_PROPERTIES.clickablePadding,
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
  function clampedPixelStyle(style, name, minimum, maximum, fallback) {
    const value = style.getPropertyValue(name).trim();
    if (!value.endsWith("px")) return fallback;
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }
  function dispatch(element, type, detail) {
    element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
  function dispatchPosition(element, position) {
    dispatch(element, "location-position", {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    });
  }
  function requestNativeFallback(element) {
    const exec = cordovaWindow()?.cordova?.exec;
    if (!exec) {
      dispatch(element, "location-error", {
        reason: "Cordova is not available"
      });
      return;
    }
    exec(
      (value) => {
        const position = value;
        dispatch(element, "location-grant", {
          granted: true
        });
        dispatch(element, "location-position", {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          timestamp: position.timestamp
        });
      },
      (value) => {
        const error = value;
        if (error?.code === "OS-PLUG-GLOC-0003" || error?.code === "OS-PLUG-GLOC-0008") {
          dispatch(element, "location-grant", {
            granted: false
          });
        }
        dispatch(element, "location-error", {
          reason: error?.message || "Location request failed"
        });
      },
      "OSGeolocation",
      "getCurrentPosition",
      [{ enableHighAccuracy: true }]
    );
  }
  function renderFallback(element) {
    element.dataset.osLocationButtonFallbackFace = "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "os-location-button-fallback";
    const normalizedTextType = textType(element);
    const label2 = TEXT_LABELS[normalizedTextType];
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("os-location-button-fallback__icon");
    icon.setAttribute("viewBox", "0 0 960 960");
    icon.setAttribute("aria-hidden", "true");
    const iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    iconPath.setAttribute(
      "d",
      "M440 918v-80q-125-14-214.5-103.5T122 520H42v-80h80q14-125 103.5-214.5T440 122V42h80v80q125 14 214.5 103.5T838 440h80v80h-80q-14 125-103.5 214.5T520 838v80h-80Zm40-158q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560 480q0-33-23.5-56.5T480 400q-33 0-56.5 23.5T400 480q0 33 23.5 56.5T480 560Z"
    );
    icon.append(iconPath);
    const text = document.createElement("span");
    text.className = normalizedTextType === "none" ? "os-location-button-fallback__visually-hidden" : "";
    text.textContent = label2;
    button.append(icon, text);
    button.setAttribute("aria-label", label2);
    button.addEventListener("click", () => {
      const currentPlatform = platform();
      if (currentPlatform !== "web") {
        requestNativeFallback(element);
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
          dispatchPosition(element, position);
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

    :where([data-os-location-button-fallback-face]) {
      background-clip: text !important;
      border-image-source: linear-gradient(transparent, transparent) !important;
      border-image-slice: 1 !important;
    }

    .os-location-button-fallback {
      position: relative;
      isolation: isolate;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      inline-size: 100%;
      block-size: 100%;
      min-inline-size: 3rem;
      min-block-size: 3rem;
      padding-inline: calc(1rem + clamp(4px, var(--os-location-button-clickable-padding, 6px), 8px));
      border: inherit;
      border-image-source: linear-gradient(transparent, transparent);
      border-image-slice: 1;
      border-radius: inherit;
      background-color: inherit;
      background-clip: text;
      color: inherit;
      font: 500 0.875rem/1.25rem Roboto, system-ui, sans-serif;
      letter-spacing: 0.007142857em;
    }

    .os-location-button-fallback::before {
      content: '';
      position: absolute;
      inset: clamp(4px, var(--os-location-button-clickable-padding, 6px), 8px);
      z-index: 0;
      box-sizing: border-box;
      border-width: inherit;
      border-style: inherit;
      border-color: inherit;
      border-radius: inherit;
      background-color: inherit;
    }

    .os-location-button-fallback:active::before {
      border-radius: clamp(0px, var(--os-location-button-pressed-corner-radius, 12px), 68px);
    }

    .os-location-button-fallback > * {
      position: relative;
      z-index: 1;
    }

    .os-location-button-fallback__icon {
      color: var(--os-location-button-icon-color, currentColor);
      inline-size: 1.25rem;
      block-size: 1.25rem;
      flex: 0 0 auto;
      fill: currentColor;
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
  function registerLocationButton(protectedSurface) {
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
      requiresUnobscuredSurface: protectedSurface,
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
          pressedCornerRadius: pixelStyle(style, STYLE_PROPERTIES.pressedCornerRadius, 0, 68, 12),
          strokeWidth: pixelStyle(style, STYLE_PROPERTIES.strokeWidth, 0, 3, 0),
          clickablePadding: clampedPixelStyle(style, STYLE_PROPERTIES.clickablePadding, 4, 8, 6)
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
    if (platform() === "android") {
      installFallbackStyles();
      void requiresUnobscuredSurface().then(registerLocationButton);
      return;
    }
    registerLocationButton(false);
  }
  if (cordovaWindow()?.cordova && !cordovaWindow()?.cordova?.platformId) {
    document.addEventListener("deviceready", boot, { once: true });
  } else {
    boot();
  }
})();
