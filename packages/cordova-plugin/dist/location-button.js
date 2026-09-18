(function() {
  "use strict";
  function globalSingleton(name, create) {
    const key = Symbol.for(`@capacitor/native-islands/${name}`);
    const scope = typeof window === "undefined" ? globalThis : window;
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
  const PROTOCOL_VERSION = 7;
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
    const x = round2(bounds.left + window.scrollX);
    const y = round2(bounds.top + window.scrollY);
    const right = round2(bounds.left + bounds.width + window.scrollX);
    const bottom = round2(bounds.top + bounds.height + window.scrollY);
    return {
      x,
      y,
      w: round2(right - x),
      h: round2(bottom - y)
    };
  }
  function viewportRect(element) {
    const bounds = element.getBoundingClientRect();
    const x = round2(bounds.left);
    const y = round2(bounds.top);
    const right = round2(bounds.left + bounds.width);
    const bottom = round2(bounds.top + bounds.height);
    return {
      x,
      y,
      w: round2(right - x),
      h: round2(bottom - y)
    };
  }
  function isSafeBridgeRect(rect) {
    var _a;
    const radius = (_a = rect.r) !== null && _a !== void 0 ? _a : 0;
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
      if (rects.length === 1 || rects.some((rect) => {
        var _a;
        return ((_a = rect.r) !== null && _a !== void 0 ? _a : 0) > 0;
      })) {
        output.push(...rects);
        continue;
      }
      const xs = Array.from(new Set(rects.reduce((values, rect) => {
        values.push(rect.x, rect.x + rect.w);
        return values;
      }, []))).sort((a, b) => a - b);
      const ys = Array.from(new Set(rects.reduce((values, rect) => {
        values.push(rect.y, rect.y + rect.h);
        return values;
      }, []))).sort((a, b) => a - b);
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
    const clipped = holes.reduce((values, hole) => {
      const value = intersection(layer, hole);
      if (value)
        values.push(value);
      return values;
    }, []);
    if (clipped.length === 0)
      return [Object.assign(Object.assign({}, layer), { r: 0 })];
    const xs = Array.from(new Set(clipped.reduce((values, rect) => {
      values.push(rect.x, rect.x + rect.w);
      return values;
    }, [layer.x, layer.x + layer.w]))).sort((a, b) => a - b);
    const ys = Array.from(new Set(clipped.reduce((values, rect) => {
      values.push(rect.y, rect.y + rect.h);
      return values;
    }, [layer.y, layer.y + layer.h]))).sort((a, b) => a - b);
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
    var _a, _b, _c;
    if (!contains(outer, inner))
      return false;
    if (Math.abs(outer.x - inner.x) <= CONTAINMENT_EPSILON && Math.abs(outer.y - inner.y) <= CONTAINMENT_EPSILON && Math.abs(outer.w - inner.w) <= CONTAINMENT_EPSILON && Math.abs(outer.h - inner.h) <= CONTAINMENT_EPSILON && Math.abs(((_a = outer.r) !== null && _a !== void 0 ? _a : 0) - ((_b = inner.r) !== null && _b !== void 0 ? _b : 0)) <= CONTAINMENT_EPSILON) {
      return true;
    }
    const radius = Math.min((_c = outer.r) !== null && _c !== void 0 ? _c : 0, outer.w / 2, outer.h / 2);
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
    var _a;
    const width = round2(layer.w);
    const height = round2(layer.h);
    let path = `M0 0 H${width} V${height} H0 Z`;
    for (const hole of holes) {
      const x = round2(hole.x - layer.x);
      const y = round2(hole.y - layer.y);
      const radius = Math.min((_a = hole.r) !== null && _a !== void 0 ? _a : 0, hole.w / 2, hole.h / 2);
      path += ` M${round2(x + radius)} ${y} A${radius} ${radius} 0 0 0 ${x} ${round2(y + radius)} L${x} ${round2(y + hole.h - radius)} A${radius} ${radius} 0 0 0 ${round2(x + radius)} ${round2(y + hole.h)} L${round2(x + hole.w - radius)} ${round2(y + hole.h)} A${radius} ${radius} 0 0 0 ${round2(x + hole.w)} ${round2(y + hole.h - radius)} L${round2(x + hole.w)} ${round2(y + radius)} A${radius} ${radius} 0 0 0 ${round2(x + hole.w - radius)} ${y} Z`;
    }
    return path;
  }
  function knockoutPath(layer, holes) {
    return `path("${knockoutPathData(layer, holes)}")`;
  }
  function knockoutMaskDefinition(layer, holes) {
    const width = round2(layer.w);
    const height = round2(layer.h);
    const removed = holes.map((hole) => {
      var _a;
      const x = round2(hole.x - layer.x);
      const y = round2(hole.y - layer.y);
      const radius = Math.max(0, Math.min((_a = hole.r) !== null && _a !== void 0 ? _a : 0, hole.w / 2, hole.h / 2));
      return `<rect x="${x}" y="${y}" width="${round2(hole.w)}" height="${round2(hole.h)}" rx="${radius}" fill="black"/>`;
    }).join("");
    return `<mask id="ni-knockout" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:luminance"><rect width="${width}" height="${height}" fill="white"/>${removed}</mask>`;
  }
  function knockoutMaskSvg(layer, holes) {
    const width = round2(layer.w);
    const height = round2(layer.h);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${knockoutMaskDefinition(layer, holes)}</defs><rect width="${width}" height="${height}" fill="white" mask="url(#ni-knockout)"/></svg>`;
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
  const MASK_PROPERTIES = [
    "mask-image",
    "mask-size",
    "mask-position",
    "mask-repeat",
    "mask-mode",
    "mask-composite",
    "mask-clip",
    "mask-origin"
  ];
  function runtimeOwnsMask(el, style) {
    return el.hasAttribute("data-ni-runtime-clip") && MASK_PROPERTIES.every((property) => el.style.getPropertyValue(property) !== "" && el.style.getPropertyPriority(property) === "" && style.getPropertyValue(property) === el.style.getPropertyValue(property));
  }
  function independentScrollContainers(element) {
    const containers = [];
    let node = composedParentElement(element);
    while (node) {
      if (node !== document.body && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (node.hasAttribute("data-ni-root-scroll-owner") || scrolls(node, style))
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
    var _a, _b;
    const color = value.trim().toLowerCase();
    if (color === "transparent")
      return 0;
    const body = (_a = color.match(/^[a-z]+\((.*)\)$/)) === null || _a === void 0 ? void 0 : _a[1];
    if (!body)
      return null;
    const slashAlpha = (_b = body.match(/\/\s*([+-]?(?:\d+\.?\d*|\.\d+)%?)(?:\s|$)/)) === null || _b === void 0 ? void 0 : _b[1];
    const commaParts = body.split(",").map((part) => part.trim());
    const alpha = slashAlpha !== null && slashAlpha !== void 0 ? slashAlpha : commaParts.length === 4 ? commaParts[3] : null;
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
    var _a;
    const clips2 = style.backgroundClip.split(",").map((value) => value.trim()).filter(Boolean);
    return (_a = clips2[clips2.length - 1]) !== null && _a !== void 0 ? _a : "border-box";
  }
  function hasSparsePaint(el, style) {
    var _a;
    const paintedElementNames = /* @__PURE__ */ new Set(["BUTTON", "CANVAS", "IFRAME", "IMG", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);
    if (paintedElementNames.has(el.tagName))
      return true;
    if (Array.from(el.childNodes).some((node) => {
      var _a2, _b;
      return node.nodeType === Node.TEXT_NODE && ((_b = (_a2 = node.textContent) === null || _a2 === void 0 ? void 0 : _a2.trim().length) !== null && _b !== void 0 ? _b : 0) > 0;
    }) && ((_a = colorAlpha(style.color)) !== null && _a !== void 0 ? _a : 0) > 0) {
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
    ].some(([width, color]) => {
      var _a2;
      return Number.parseFloat(width) > 0 && ((_a2 = colorAlpha(color)) !== null && _a2 !== void 0 ? _a2 : 0) > 0;
    });
    return hasBorder || style.boxShadow !== "" && style.boxShadow !== "none" || style.textShadow !== "" && style.textShadow !== "none" || style.outlineStyle !== "" && style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
  }
  function hasPaintOutsideBorderBox(el, style) {
    const hasVisiblePseudo = (pseudo) => {
      var _a;
      const pseudoStyle = getComputedStyle(el, pseudo);
      const content = ((_a = pseudoStyle.content) !== null && _a !== void 0 ? _a : "").trim();
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
  function auditWebLayerCutoutComposition(el, modeledScrollContainers = null, backgroundOnly = false, allowViewportPosition = false, aboveNativeUnderlay = false) {
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
      if (!aboveNativeUnderlay && Number.parseFloat(style.opacity) !== 1 || propertyIsActive(style, "filter") || propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter") || (style.getPropertyValue("mix-blend-mode").trim() || "normal") !== "normal" || !runtimeClip && propertyIsActive(style, "clip-path") || !runtimeOwnsMask(node, style) && (propertyIsActive(style, "mask-image") || propertyIsActive(style, "-webkit-mask-image"))) {
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
      if (node !== el && !isViewportRoot && !node.hasAttribute("data-ni-root-scroll-owner") && (overflowClips || paintContains) && !modeledScrollClip && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, layerRect))) {
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
      if (!runtimeClip && style.clipPath !== "none" || !runtimeOwnsMask(node, style) && mask && mask !== "none") {
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
      if (node !== el && !isViewportRoot && !node.hasAttribute("data-ni-root-router-prototype") && (overflowClips || paintContains) && !modeledScrollClip && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, islandRect))) {
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
    } catch (_a) {
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
  function rootScrollAdmission(input) {
    if (input.optedOut)
      return { routed: false, reason: "root scrolling is disabled by the author" };
    if (input.horizontal)
      return { routed: false, reason: "horizontal root scrolling is not supported" };
    return { routed: true };
  }
  const OWNER_ATTRIBUTE = "data-ni-root-scroll-owner";
  const OPTOUT_ATTRIBUTE = "data-native-islands-scroll";
  const RUNWAY = 1e7;
  const ORIGIN = RUNWAY / 2;
  const OWNER_STYLE = `
[${OWNER_ATTRIBUTE}] {
  overflow-y: hidden !important;
  overscroll-behavior-y: auto !important;
  scroll-behavior: auto !important;
}
`;
  const CARRIER_STYLE = `
html[data-ni-root-scroll] {
  height: calc(100vh + ${RUNWAY}px) !important;
  min-height: 0 !important;
  overflow-y: auto !important;
}
html[data-ni-root-scroll] body {
  position: fixed !important;
  inset: calc(-1 * var(--ni-document-scroll-offset, 0px)) 0 auto 0 !important;
  width: 100% !important;
  margin: 0 !important;
}
`;
  function rootScrollAdmissionFor(element) {
    const style = getComputedStyle(element);
    return rootScrollAdmission({
      optedOut: element.getAttribute(OPTOUT_ATTRIBUTE) === "off",
      horizontal: element.scrollWidth > element.clientWidth && (style.overflowX === "auto" || style.overflowX === "scroll")
    });
  }
  class RootScrollRuntime {
    constructor() {
      this.owners = /* @__PURE__ */ new Map();
      this.issues = /* @__PURE__ */ new Map();
      this.active = null;
      this.documentOffset = 0;
      this.documentRange = 0;
      this.rootOffset = ORIGIN;
      this.ownerStyle = null;
      this.carrierStyle = null;
      this.carrierActive = false;
      this.enabled = false;
      this.onPointerDown = (event) => {
        var _a;
        const active = (_a = event.composedPath().filter((target) => target instanceof HTMLElement).map((target) => this.owners.get(target)).find((candidate) => candidate !== void 0)) !== null && _a !== void 0 ? _a : null;
        if (this.carrierActive)
          this.commitRootOffset();
        if (active === this.active)
          return;
        this.active = active;
        if (active === null) {
          this.deactivateCarrier();
        } else if (this.carrierActive) {
          document.documentElement.dataset.niRootScrollActive = active.id;
        } else {
          this.activateCarrier(active.id);
        }
      };
      this.onRootScroll = () => this.commitRootOffset();
    }
    setEnabled(enabled) {
      var _a;
      if (enabled === this.enabled)
        return;
      this.enabled = enabled;
      if (enabled) {
        this.documentOffset = window.scrollY;
        this.documentRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        this.ownerStyle = document.createElement("style");
        this.ownerStyle.dataset.niRootScrollOwners = "";
        this.ownerStyle.textContent = OWNER_STYLE;
        document.head.append(this.ownerStyle);
        document.documentElement.dataset.niRootScrollActive = "document";
        document.addEventListener("pointerdown", this.onPointerDown, true);
      } else {
        document.removeEventListener("pointerdown", this.onPointerDown, true);
        this.clear();
        delete document.documentElement.dataset.niRootScrollActive;
        (_a = this.ownerStyle) === null || _a === void 0 ? void 0 : _a.remove();
        this.ownerStyle = null;
      }
    }
    reconcile(candidates) {
      var _a;
      if (!this.enabled)
        return;
      if (this.carrierActive)
        this.commitRootOffset();
      const retained = /* @__PURE__ */ new Set();
      let restoreDocument = false;
      this.issues.clear();
      for (const candidate of candidates) {
        const admission = rootScrollAdmissionFor(candidate.element);
        if (!admission.routed) {
          this.issues.set(candidate.element, admission.reason);
          continue;
        }
        retained.add(candidate.element);
        const owner = (_a = this.owners.get(candidate.element)) !== null && _a !== void 0 ? _a : Object.assign({}, candidate);
        owner.id = candidate.id;
        this.owners.set(candidate.element, owner);
        if (candidate.element.getAttribute(OWNER_ATTRIBUTE) !== candidate.id) {
          candidate.element.setAttribute(OWNER_ATTRIBUTE, candidate.id);
        }
      }
      for (const [element, owner] of this.owners) {
        if (retained.has(element))
          continue;
        if (this.active === owner) {
          this.active = null;
          restoreDocument = true;
        }
        element.removeAttribute(OWNER_ATTRIBUTE);
        this.owners.delete(element);
      }
      this.documentRange = Math.max(0, (this.carrierActive ? document.body.scrollHeight : document.documentElement.scrollHeight) - window.innerHeight);
      if (!this.carrierActive)
        this.documentOffset = window.scrollY;
      const documentOffset = Math.min(this.documentOffset, this.documentRange);
      this.documentOffset = documentOffset;
      if (this.carrierActive) {
        document.documentElement.style.setProperty("--ni-document-scroll-offset", `${this.documentOffset}px`);
      }
      if (restoreDocument)
        this.deactivateCarrier();
    }
    issueFor(element) {
      var _a;
      return (_a = this.issues.get(element)) !== null && _a !== void 0 ? _a : null;
    }
    isRouted(element) {
      return this.owners.has(element);
    }
    offsetFor(element) {
      return element.scrollTop;
    }
    pageOffset() {
      return this.carrierActive ? this.documentOffset : window.scrollY;
    }
    pageRange() {
      return this.documentRange;
    }
    clear() {
      this.deactivateCarrier();
      for (const element of this.owners.keys())
        element.removeAttribute(OWNER_ATTRIBUTE);
      this.owners.clear();
      this.issues.clear();
      this.active = null;
    }
    commitRootOffset() {
      const active = this.active;
      if (!this.carrierActive || active === null)
        return;
      const nextRootOffset = window.scrollY;
      const delta = nextRootOffset - this.rootOffset;
      this.rootOffset = nextRootOffset;
      if (delta === 0)
        return;
      active.element.scrollTop += delta;
    }
    activateCarrier(owner) {
      this.documentOffset = window.scrollY;
      this.documentRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      this.carrierStyle = document.createElement("style");
      this.carrierStyle.dataset.niRootScrollCarrier = "";
      this.carrierStyle.textContent = CARRIER_STYLE;
      document.head.append(this.carrierStyle);
      document.documentElement.style.setProperty("--ni-document-scroll-offset", `${this.documentOffset}px`);
      document.documentElement.dataset.niRootScroll = "";
      document.documentElement.dataset.niRootScrollActive = owner;
      this.carrierActive = true;
      window.scrollTo(0, ORIGIN);
      this.rootOffset = window.scrollY;
      window.addEventListener("scroll", this.onRootScroll, { passive: true });
    }
    deactivateCarrier() {
      var _a;
      if (!this.carrierActive)
        return;
      this.commitRootOffset();
      window.removeEventListener("scroll", this.onRootScroll);
      window.scrollTo(0, this.documentOffset);
      this.carrierActive = false;
      delete document.documentElement.dataset.niRootScroll;
      document.documentElement.style.removeProperty("--ni-document-scroll-offset");
      (_a = this.carrierStyle) === null || _a === void 0 ? void 0 : _a.remove();
      this.carrierStyle = null;
      this.rootOffset = window.scrollY;
      this.documentRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      document.documentElement.dataset.niRootScrollActive = "document";
    }
  }
  let contextMemo = /* @__PURE__ */ new WeakMap();
  let nscMemo = /* @__PURE__ */ new WeakMap();
  let topLayerSequence = 0;
  const topLayerOrder = /* @__PURE__ */ new WeakMap();
  function matchesState(element, selector) {
    try {
      return element.matches(selector);
    } catch (_a) {
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
      result = hasEffectiveZIndex(el, cs) || cs.position === "fixed" || cs.position === "sticky" || parseFloat(cs.opacity) < 1 || cs.transform !== "none" || cs.translate !== void 0 && cs.translate !== "none" && cs.translate !== "" || cs.perspective !== "none" || cs.filter !== "none" || cs.backdropFilter !== void 0 && cs.backdropFilter !== "none" && cs.backdropFilter !== "" || cs.mixBlendMode !== "normal" || cs.isolation === "isolate" || cs.clipPath !== void 0 && cs.clipPath !== "none" && cs.clipPath !== "" || cs.maskImage !== void 0 && cs.maskImage !== "none" && cs.maskImage !== "" || /transform|opacity|filter|perspective|clip-path/.test(cs.willChange || "") || /paint|layout|strict|content/.test(cs.contain || "") || cs.containerType === "size" || cs.containerType === "inline-size";
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
    var _a, _b;
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
        const orderA = (_a = topLayerOrder.get(topA)) !== null && _a !== void 0 ? _a : 0;
        const orderB = (_b = topLayerOrder.get(topB)) !== null && _b !== void 0 ? _b : 0;
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
    var _a;
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !((_a = node.textContent) === null || _a === void 0 ? void 0 : _a.trim()))
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
  const CROSS_PATH_OVERLAP_REASON = "overlapping native islands from different scroll containers are unsupported";
  const COMPLEX_OVERLAP_REASON = "partially overlapping complex opaque regions require native path boolean support";
  function hasResolvedGeometry(state) {
    return state.active && state.rect !== null && state.visualRect !== null;
  }
  function hasUnsupportedPartialOverlap(left, right) {
    return partialOverlap(left.visualRect, right.visualRect) && (hasComplexOpaqueShape(left.rect) || hasComplexOpaqueShape(right.rect));
  }
  function hasUnsupportedRoundedContainment(outer, inner) {
    return hasComplexOpaqueShape(outer.rect) && contains(outer.visualRect, inner.visualRect) && !opaqueContainsRect(outer.visualRect, inner.visualRect);
  }
  function samePathOverlapReason(left, right) {
    if (hasUnsupportedPartialOverlap(left, right))
      return COMPLEX_OVERLAP_REASON;
    if (hasUnsupportedRoundedContainment(left, right))
      return COMPLEX_OVERLAP_REASON;
    if (hasUnsupportedRoundedContainment(right, left))
      return COMPLEX_OVERLAP_REASON;
    return null;
  }
  function planeSeparatedOverlap(left, right) {
    const fixedOverlay = (state) => state.plane === "overlay" && state.coordinateSpace === "viewport";
    const scrolledUnderlay = (state) => state.plane === "underlay" && state.coordinateSpace === "document";
    const pair = fixedOverlay(left) && scrolledUnderlay(right) ? { overlay: left, underlay: right } : fixedOverlay(right) && scrolledUnderlay(left) ? { overlay: right, underlay: left } : null;
    if (pair === null)
      return false;
    return above(pair.overlay, pair.underlay);
  }
  function unsupportedOverlapReason(left, right) {
    if (left.plane === "underlay" && right.plane === "underlay" && stationaryCoordinatePaths(left, right))
      return null;
    if (sameCoordinatePath(left, right))
      return samePathOverlapReason(left, right);
    if (!intersects(left.visualRect, right.visualRect))
      return null;
    return planeSeparatedOverlap(left, right) ? null : CROSS_PATH_OVERLAP_REASON;
  }
  function stationaryCoordinatePaths(left, right) {
    if (sameCoordinatePath(left, right))
      return true;
    if (left.scrollPath.length > 0 || right.scrollPath.length > 0)
      return false;
    const root = document.scrollingElement;
    return root !== null && root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight;
  }
  function smallerNative(left, right) {
    return left.rect.w * left.rect.h <= right.rect.w * right.rect.h ? left : right;
  }
  function suspendNative(state, reason) {
    state.inactiveReason = reason;
    state.active = false;
    state.rect = null;
    state.visualRect = null;
  }
  function knockoutCandidates(natives, layer) {
    return natives.filter((native) => hasResolvedGeometry(native) && native.plane === "underlay" && layer.cutoutIssue === null && above(native, layer) && intersects(native.visualRect, layer.visualRect));
  }
  function roundedHolesOverlap(holes) {
    return holes.some((left, index) => holes.slice(index + 1).some((right) => intersects(left, right) && (hasComplexOpaqueShape(left) || hasComplexOpaqueShape(right))));
  }
  function maskStyleKey(element) {
    const style = getComputedStyle(element);
    return JSON.stringify([
      element.style.cssText,
      ...MASK_PROPERTIES.map((property) => style.getPropertyValue(property))
    ]);
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
    return Object.assign(Object.assign({}, rect), { x: round2(rect.x + offset.x), y: round2(rect.y + offset.y) });
  }
  function rectInScrollPathCoordinates(rect, path) {
    const offset = scrollPathOffset(path);
    return Object.assign(Object.assign({}, rect), { x: round2(rect.x + offset.x), y: round2(rect.y + offset.y) });
  }
  function canonicalScrollRect(rect) {
    var _a;
    const tenth = (value) => Math.round(value * 10) / 10;
    return {
      x: tenth(rect.x),
      y: tenth(rect.y),
      w: tenth(rect.w),
      h: tenth(rect.h),
      r: tenth((_a = rect.r) !== null && _a !== void 0 ? _a : 0)
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
    var _a, _b;
    const root = document.documentElement;
    const body = document.body;
    return {
      x: 0,
      y: 0,
      w: round2(Math.max(window.innerWidth, root.scrollWidth, (_a = body === null || body === void 0 ? void 0 : body.scrollWidth) !== null && _a !== void 0 ? _a : 0)),
      h: round2(Math.max(window.innerHeight, root.scrollHeight, (_b = body === null || body === void 0 ? void 0 : body.scrollHeight) !== null && _b !== void 0 ? _b : 0))
    };
  }
  function hasVisibleBackground(style) {
    const image = style.backgroundImage.trim();
    const color = style.backgroundColor.replace(/\s+/g, "").toLowerCase();
    return image !== "" && image !== "none" || color !== "" && color !== "transparent" && color !== "rgba(0,0,0,0)" && !color.endsWith("/0)");
  }
  function isElementVisible(el) {
    if (!el.isConnected || el.hidden)
      return false;
    const visibilityProbe = el.checkVisibility;
    if (typeof visibilityProbe === "function") {
      try {
        if (!visibilityProbe.call(el))
          return false;
      } catch (_a) {
        return false;
      }
    } else if (el.getClientRects().length === 0) {
      return false;
    }
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
      if (typeof visibilityProbe !== "function")
        return false;
      try {
        if (!visibilityProbe.call(el, { contentVisibilityAuto: true }))
          return false;
      } catch (_b) {
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
        if (current === document.body && document.documentElement.hasAttribute("data-ni-root-scroll")) {
          current = composedParentElement(current);
          continue;
        }
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
    var _a, _b;
    const root = document.documentElement;
    const body = document.body;
    const maxX = Math.max(0, Math.max(root.scrollWidth, (_a = body === null || body === void 0 ? void 0 : body.scrollWidth) !== null && _a !== void 0 ? _a : 0) - window.innerWidth);
    const maxY = Math.max(0, Math.max(root.scrollHeight, (_b = body === null || body === void 0 ? void 0 : body.scrollHeight) !== null && _b !== void 0 ? _b : 0) - window.innerHeight);
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
    if (typeof (effect === null || effect === void 0 ? void 0 : effect.getKeyframes) !== "function")
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
    } catch (_a) {
      return "global-layout";
    }
  }
  function animationTarget(animation) {
    var _a;
    const target = (_a = animation.effect) === null || _a === void 0 ? void 0 : _a.target;
    if (target instanceof Element)
      return target;
    const originatingElement = target === null || target === void 0 ? void 0 : target.element;
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
    return establishesStackingContext(layer.el) && !isComposedAncestor(layer.el, native) && auditWebLayerCutoutComposition(layer.el, layer.scrollPath, false, layer.coordinateSpace === "viewport") === null;
  }
  function activeModalDialogs() {
    return Array.from(document.querySelectorAll("dialog")).filter((dialog) => {
      try {
        return dialog.matches(":modal");
      } catch (_a) {
        return false;
      }
    });
  }
  class StackingService {
    get innerScrollMode() {
      return this.scrollMode;
    }
    set innerScrollMode(mode) {
      this.scrollMode = mode;
      this.rootScroll.setEnabled(mode === "root");
    }
    constructor(onOpenRoot = () => void 0, automaticLayerCandidates = () => []) {
      this.automaticLayerCandidates = automaticLayerCandidates;
      this.compositionEnabled = false;
      this.scrollMode = "unsupported";
      this.rootScroll = new RootScrollRuntime();
      this.natives = [];
      this.layers = [];
      this.onChange = null;
      this.onScroll = null;
      this.mutationObserver = null;
      this.resizeObserver = null;
      this.scheduled = false;
      this.acknowledgedSignature = "";
      this.pendingSignature = null;
      this.pendingLayout = null;
      this.planGeneration = 0;
      this.layoutWaiters = [];
      this.activeEffects = /* @__PURE__ */ new Map();
      this.watchedAnimations = /* @__PURE__ */ new WeakSet();
      this.effectRootDisposers = /* @__PURE__ */ new Map();
      this.automaticLayerClassifications = /* @__PURE__ */ new WeakMap();
      this.scrollIds = /* @__PURE__ */ new WeakMap();
      this.trackedScrollContainers = /* @__PURE__ */ new Map();
      this.scrollDisposers = /* @__PURE__ */ new Map();
      this.nextScrollId = 1;
      this.scrollSequence = 0;
      this.scrollScheduled = false;
      this.scrollSettledPending = false;
      this.scrollEndTimer = null;
      this.runtimeClips = /* @__PURE__ */ new Map();
      this.runtimeBackgrounds = /* @__PURE__ */ new Map();
      this.runtimePaintStyles = /* @__PURE__ */ new WeakMap();
      this.rejectedMasks = /* @__PURE__ */ new Map();
      this.refresh = () => {
        if (this.scheduled)
          return;
        this.scheduled = true;
        requestAnimationFrame(() => {
          var _a, _b;
          this.scheduled = false;
          const waiters = this.layoutWaiters.splice(0);
          const payload = this.resolve();
          const signature = JSON.stringify(payload);
          if (this.pendingSignature === null && signature === this.acknowledgedSignature) {
            for (const waiter of waiters)
              waiter.resolve();
            return;
          }
          if (signature === this.pendingSignature && this.pendingLayout) {
            void this.pendingLayout.then(() => {
              for (const waiter of waiters)
                waiter.resolve();
            }, (error) => {
              for (const waiter of waiters)
                waiter.reject(error);
            });
            return;
          }
          const generation = ++this.planGeneration;
          this.pendingSignature = signature;
          const apply = (_b = (_a = this.onChange) === null || _a === void 0 ? void 0 : _a.call(this, payload)) !== null && _b !== void 0 ? _b : Promise.resolve();
          this.pendingLayout = apply;
          void apply.then(() => {
            for (const waiter of waiters)
              waiter.resolve();
          }, (error) => {
            for (const waiter of waiters)
              waiter.reject(error);
          });
          void apply.then(() => {
            if (generation !== this.planGeneration)
              return;
            this.pendingSignature = null;
            this.pendingLayout = null;
            this.acknowledgedSignature = signature;
          }).catch(() => {
            if (generation === this.planGeneration) {
              this.pendingSignature = null;
              this.pendingLayout = null;
            }
          });
        });
      };
      this.compositionObserver = new CompositionObserver(() => this.refresh(), void 0, onOpenRoot);
    }
    registerNative(handle) {
      var _a;
      if (this.natives.some((candidate) => candidate.el === handle.el))
        return;
      this.invalidatePendingPlan();
      this.natives.push(handle);
      (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.observe(handle.el);
    }
    registerLayer(handle) {
      var _a;
      if (this.layers.some((candidate) => candidate.el === handle.el))
        return;
      this.invalidatePendingPlan();
      this.layers.push(handle);
      (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.observe(handle.el);
      this.refresh();
    }
    findNative(id) {
      return this.natives.find((native) => native.islandId === id);
    }
    failScrollContainers(ids, reason) {
      const failed = new Set(ids);
      for (const handle of this.natives) {
        const affected = independentScrollContainers(handle.el).some((container) => failed.has(this.idForScrollContainer(container)));
        if (affected) {
          handle.failNative(reason);
        }
      }
    }
    notifyTransportAvailable() {
      for (const handle of this.natives)
        handle.onTransportAvailable();
    }
    async recreateNativeViews() {
      await Promise.all(this.natives.map((handle) => handle.recreateNative()));
    }
    prepareForPageHide() {
      this.invalidatePendingPlan();
      this.rootScroll.clear();
    }
    invalidateAutomaticLayers(root) {
      if (!root) {
        this.automaticLayerClassifications = /* @__PURE__ */ new WeakMap();
        this.rejectedMasks.clear();
        return;
      }
      if (root instanceof HTMLElement)
        this.automaticLayerClassifications.delete(root);
      for (const element of root.querySelectorAll("*")) {
        this.automaticLayerClassifications.delete(element);
      }
    }
    unregister(el) {
      var _a;
      this.rejectedMasks.delete(el);
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
      (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.unobserve(el);
      this.refresh();
    }
    /** Resolve after the current DOM composition has been acknowledged by the native transport. */
    synchronize() {
      return new Promise((resolve, reject) => {
        this.layoutWaiters.push({ resolve, reject });
        this.refresh();
      });
    }
    start(onChange, onScroll) {
      if (this.onChange)
        return;
      this.onChange = onChange;
      this.onScroll = onScroll !== null && onScroll !== void 0 ? onScroll : null;
      this.mutationObserver = new MutationObserver((records) => {
        var _a;
        let changed = false;
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (!target)
            continue;
          const runtimePaint = record.type === "attributes" && target instanceof HTMLElement && (record.attributeName === "style" && this.runtimePaintStyles.get(target) === target.style.cssText || ((_a = record.attributeName) === null || _a === void 0 ? void 0 : _a.startsWith("data-ni-runtime-")) || record.attributeName === "data-native-islands-inactive");
          if (!runtimePaint)
            this.rejectedMasks.clear();
          if (target instanceof HTMLElement && record.type === "attributes") {
            const runtimeClip = this.runtimeClips.get(target);
            const runtimeBackground = this.runtimeBackgrounds.get(target);
            if (runtimeClip && record.attributeName === "style") {
              const ownsClip = Array.from(runtimeClip.applied).every(([property, value]) => target.style.getPropertyValue(property) === value && target.style.getPropertyPriority(property) === "");
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
        attributeOldValue: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.refresh());
        this.resizeObserver.observe(document.documentElement);
        for (const native of this.natives)
          this.resizeObserver.observe(native.el);
        for (const layer of this.layers)
          this.resizeObserver.observe(layer.el);
      }
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
        if (this.innerScrollMode !== "bridge" || this.scrollDisposers.has(id)) {
          continue;
        }
        const onScroll = () => {
          this.scheduleScrollOffsets(false);
          this.scheduleScrollSettlement();
        };
        const onScrollEnd = () => {
          if (this.scrollEndTimer !== null)
            window.clearTimeout(this.scrollEndTimer);
          this.scrollEndTimer = null;
          this.scheduleScrollOffsets(true);
        };
        element.addEventListener("scroll", onScroll, { passive: true });
        element.addEventListener("scrollend", onScrollEnd, { passive: true });
        this.scrollDisposers.set(id, () => {
          element.removeEventListener("scroll", onScroll);
          element.removeEventListener("scrollend", onScrollEnd);
        });
      }
      if (next.size === 0) {
        if (this.scrollEndTimer !== null)
          window.clearTimeout(this.scrollEndTimer);
        this.scrollEndTimer = null;
      }
    }
    scheduleScrollOffsets(settled) {
      if (this.innerScrollMode !== "bridge" || !this.onScroll)
        return;
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
    scheduleScrollSettlement() {
      if (this.scrollEndTimer !== null)
        window.clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = window.setTimeout(() => {
        this.scrollEndTimer = null;
        this.scheduleScrollOffsets(true);
      }, 120);
    }
    flushScrollOffsets(settled) {
      if (!this.onScroll || this.trackedScrollContainers.size === 0)
        return Promise.resolve();
      const offsets = Array.from(this.trackedScrollContainers, ([id, element]) => Object.assign({ id }, physicalScrollOffset(element)));
      return this.onScroll(Object.assign(Object.assign(Object.assign({}, createEnvelope()), { sequence: ++this.scrollSequence, offsets }), settled ? { settled: true } : {})).catch(() => void 0);
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
        const getAnimations = event.target.getAnimations;
        const animation = typeof getAnimations === "function" ? Array.from(getAnimations.call(event.target)).find((candidate) => candidate.animationName === event.animationName && (candidate.playState === "running" || candidate.pending)) : void 0;
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
      const onStyleStateChange = (event) => {
        if (this.innerScrollMode === "root" && event.type.startsWith("pointer"))
          return;
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
      var _a;
      (_a = this.effectRootDisposers.get(root)) === null || _a === void 0 ? void 0 : _a();
      this.effectRootDisposers.delete(root);
    }
    beginEffect(target, key, impact) {
      var _a;
      if (!(target instanceof Element) || impact === "none")
        return;
      const effects = (_a = this.activeEffects.get(target)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Map();
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
      const getDocumentAnimations = document.getAnimations;
      if (typeof getDocumentAnimations === "function") {
        for (const animation of Array.from(getDocumentAnimations.call(document)))
          append(animation);
      }
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
          for (const animation of Array.from(getAnimations.call(root)))
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
      var _a;
      const safety = {
        globalLayout: false,
        movingMarkedLayer: false,
        localCompositionTargets: /* @__PURE__ */ new Set()
      };
      for (const effect of this.collectRunningEffects()) {
        if (((_a = effect.target.parentElement) === null || _a === void 0 ? void 0 : _a.hasAttribute("data-ni-root-scroll-owner")) || document.documentElement.hasAttribute("data-ni-root-scroll-active") && effect.target.parentElement === document.body) {
          continue;
        }
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
      this.acknowledgedSignature = "";
      this.planGeneration++;
      this.pendingSignature = null;
    }
    buildNatives(motion) {
      const modalDialogs = activeModalDialogs();
      const states = this.natives.map((handle, dom) => {
        handle.reconcileObservedStyles();
        let inactiveReason = null;
        let active = handle.canAttemptNative() && isElementVisible(handle.el);
        const positionedAncestor = handle.canAttemptNative() ? fixedOrStickyAncestor(handle.el) : null;
        const discoveredScrollPath = active ? scrollPath(handle.el) : [];
        const fixedAncestorContainsScroller = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.viewportFixed) === true && discoveredScrollPath.some((container) => isComposedAncestor(positionedAncestor.element, container));
        const coordinateSpace = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.viewportFixed) && !fixedAncestorContainsScroller ? "viewport" : "document";
        const plane = coordinateSpace === "viewport" || handle.requiresUnobscuredSurface ? "overlay" : "underlay";
        const coordinateScrollPath = coordinateSpace === "document" ? discoveredScrollPath : [];
        const modeledScrollPath = this.innerScrollMode === "unsupported" ? [] : coordinateScrollPath;
        const composition = auditIslandComposition(handle.islandId, handle.el, modeledScrollPath);
        const externalModal = modalDialogs.find((dialog) => !isComposedAncestor(dialog, handle.el));
        if (externalModal) {
          inactiveReason = "native islands outside an active modal cannot be composed";
          active = false;
        }
        const fullscreen = document.fullscreenElement;
        if (!inactiveReason && fullscreen && !isComposedAncestor(fullscreen, handle.el)) {
          inactiveReason = "native islands outside the fullscreen element cannot be composed";
          active = false;
        }
        if ((positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky") {
          inactiveReason = "sticky native islands are unsupported";
          active = false;
        }
        const animatedAncestor = handle.canAttemptNative() && Array.from(motion.localCompositionTargets).some((target) => isComposedAncestor(target, handle.el));
        if (!inactiveReason && (motion.globalLayout || motion.movingMarkedLayer || animatedAncestor)) {
          inactiveReason = motion.globalLayout ? "active layout-affecting CSS transitions and animations suspend native composition" : motion.movingMarkedLayer ? "active marked-layer CSS transitions and animations suspend native composition" : "active island composition transitions and animations suspend native composition";
          active = false;
        }
        const structuralIssue = composition[0];
        if (active && (structuralIssue === null || structuralIssue === void 0 ? void 0 : structuralIssue.code) === "zero_opacity") {
          active = false;
        } else if (active && structuralIssue) {
          inactiveReason = structuralIssue.message;
          active = false;
        }
        let activeScrollPath = active ? coordinateScrollPath : [];
        if (active && activeScrollPath.length > MAX_SCROLL_PATH_DEPTH) {
          inactiveReason = "nested scroll depth exceeds the native host safety limit";
          active = false;
          activeScrollPath = [];
        } else if (active && activeScrollPath.length > 0 && this.innerScrollMode === "unsupported") {
          inactiveReason = "independent scroll containers are not supported by the active native transport";
          active = false;
          activeScrollPath = [];
        } else if (active && activeScrollPath.length > 0 && this.innerScrollMode === "root") {
          const issue = activeScrollPath.map(rootScrollAdmissionFor).find((result) => !result.routed);
          if (issue && !issue.routed) {
            inactiveReason = issue.reason;
            active = false;
            activeScrollPath = [];
          }
        } else if (active && activeScrollPath.length > 0) {
          const invalidScrollport = activeScrollPath.some((container) => {
            const scrollport = scrollContainerRect(container);
            return !scrollport || !isSafeBridgeRect(scrollport);
          });
          if (invalidScrollport) {
            inactiveReason = "the scroll container geometry cannot be represented safely by the native host";
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
            inactiveReason = "native islands require a uniform pixel border-radius";
            active = false;
          } else {
            rect = Object.assign(Object.assign({}, bounds), { r: cssRadius !== null && cssRadius !== void 0 ? cssRadius : 0 });
            if (!isSafeBridgeRect(rect)) {
              inactiveReason = "native island geometry exceeds the shared safe coordinate or size range";
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
          inactiveReason
        };
      });
      return states;
    }
    suspendUnsupportedOverlaps(states) {
      for (let leftIndex = 0; leftIndex < states.length; leftIndex++) {
        const left = states[leftIndex];
        if (!hasResolvedGeometry(left))
          continue;
        this.suspendOverlapsForLeft(left, states, leftIndex + 1);
      }
    }
    suspendOverlapsForLeft(left, states, startIndex) {
      for (let rightIndex = startIndex; rightIndex < states.length; rightIndex++) {
        if (!hasResolvedGeometry(left))
          break;
        const right = states[rightIndex];
        if (!hasResolvedGeometry(right))
          continue;
        const reason = unsupportedOverlapReason(left, right);
        if (reason === null)
          continue;
        suspendNative(smallerNative(left, right), reason);
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
      var _a, _b;
      for (const native of natives) {
        if (!native.active || native.plane !== "overlay" || !native.visualRect)
          continue;
        const unsupported = layers.find((layer) => layer.overlayCutoutIssue !== null && above(layer, native) && canMoveIntoIntersection(layer, native) && !this.opaqueWebCover(layer, native, layers));
        if (!unsupported)
          continue;
        native.inactiveReason = (_b = (_a = unsupported.overlayCutoutIssue) === null || _a === void 0 ? void 0 : _a.reason) !== null && _b !== void 0 ? _b : "the upper web surface cannot become a native cutout";
        native.active = false;
        native.rect = null;
        native.visualRect = null;
      }
    }
    opaqueWebCover(layer, native, layers) {
      return layers.some((cover) => cover !== layer && cover.overlayCutoutIssue === null && cover.cutoutIssue === null && above(cover, native) && isElementVisible(cover.el) && stationaryCoordinatePaths(cover, layer) && opaqueContainsRect(cover.visualRect, layer.visualRect) && // A descendant can paint outside its box. Only a clipping ancestor
      // proves its complete paint stays inside the opaque surface.
      (layer.cutoutIssue === null || isComposedAncestor(cover.el, layer.el) && getComputedStyle(cover.el).overflow === "hidden"));
    }
    resolveWebUnderlays(natives, layers) {
      for (const native of natives) {
        if (!hasResolvedGeometry(native) || native.plane !== "overlay")
          continue;
        const needsWebAbove = layers.some((layer) => layer.overlayCutoutIssue !== null && above(layer, native) && canMoveIntoIntersection(layer, native) && !this.opaqueWebCover(layer, native, layers));
        if (!needsWebAbove)
          continue;
        const group = /* @__PURE__ */ new Set([native]);
        for (const upper of group) {
          for (const lower of natives) {
            if (hasResolvedGeometry(lower) && lower.plane === "overlay" && above(upper, lower) && canMoveIntoIntersection(upper, lower))
              group.add(lower);
          }
        }
        const safe = Array.from(group).every((candidate) => !candidate.handle.requiresUnobscuredSurface && !candidate.scrollPath.some((element) => this.rootScroll.isRouted(element)) && layers.every((layer) => !canMoveIntoIntersection(candidate, layer) || (above(candidate, layer) ? stationaryCoordinatePaths(candidate, layer) : auditWebLayerCutoutComposition(layer.el, layer.scrollPath, true, layer.coordinateSpace === "viewport", true) === null)));
        if (safe)
          for (const candidate of group)
            candidate.plane = "underlay";
      }
    }
    buildLayers() {
      var _a, _b, _c;
      const explicitElements = new Set(this.layers.map((layer) => layer.el));
      const layers = this.layers.filter((layer) => layer.el.isConnected).map((layer, dom2) => {
        var _a2, _b2, _c2;
        const style = getComputedStyle(layer.el);
        const positionedAncestor = fixedOrStickyAncestor(layer.el);
        const coordinateSpace = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.viewportFixed) ? "viewport" : "document";
        const layerScrollPath = coordinateSpace === "viewport" ? [] : scrollPath(layer.el);
        const allowFixedPosition = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "fixed";
        const radius = uniformCssCornerRadius([
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]);
        const wholeLayerIssue = auditWebLayerCutoutComposition(layer.el, layerScrollPath, false, allowFixedPosition);
        const backgroundPaint = layer.el.children.length > 0 && (radius === null || wholeLayerIssue !== null) ? (_b2 = (_a2 = this.runtimeBackgrounds.get(layer.el)) === null || _a2 === void 0 ? void 0 : _a2.source) !== null && _b2 !== void 0 ? _b2 : separableBackgroundPaint(style) : null;
        const overlayClassification = automaticWebLayerCutoutIssue(layer.el, (_c2 = layerScrollPath[layerScrollPath.length - 1]) !== null && _c2 !== void 0 ? _c2 : null, allowFixedPosition, true);
        return {
          el: layer.el,
          z: zIndex(layer.el),
          dom: dom2,
          rect: Object.assign(Object.assign({}, coordinateSpace === "viewport" ? viewportRect(layer.el) : rectInsideScrollPath(layer.el, layerScrollPath)), { r: radius !== null && radius !== void 0 ? radius : 0 }),
          visualRect: Object.assign(Object.assign({}, docRect(layer.el)), { r: radius !== null && radius !== void 0 ? radius : 0 }),
          coordinateSpace,
          scrollPath: layerScrollPath,
          backgroundPaint,
          cutoutIssue: radius === null && backgroundPaint === null ? {
            reason: "declared opaque surfaces require a uniform pixel border-radius",
            mayMoveWithoutRefresh: false
          } : auditWebLayerCutoutComposition(layer.el, layerScrollPath, backgroundPaint !== null, allowFixedPosition),
          overlayCutoutIssue: radius === null || overlayClassification === void 0 ? {
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
        const coordinateSpace = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.viewportFixed) ? "viewport" : "document";
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
        const coordinateSpace = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.viewportFixed) ? "viewport" : "document";
        const layerScrollPath = coordinateSpace === "viewport" ? [] : scrollPath(element);
        const allowFixedPosition = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "fixed";
        const runtimeBackground = this.runtimeBackgrounds.get(element);
        const sourceBackground = (_a = runtimeBackground === null || runtimeBackground === void 0 ? void 0 : runtimeBackground.source) !== null && _a !== void 0 ? _a : separableBackgroundPaint(getComputedStyle(element));
        const isViewportRoot = element === document.body || element === document.documentElement;
        const paintsDocumentCanvas = element === document.documentElement || element === document.body && !htmlHasBackground;
        const backgroundPaint = sourceBackground !== null && (element.children.length > 0 || isViewportRoot) ? sourceBackground : null;
        const cached = layerScrollPath.length > 0 ? void 0 : this.automaticLayerClassifications.get(element);
        const issue = backgroundPaint !== null ? auditWebLayerCutoutComposition(element, layerScrollPath, true, allowFixedPosition) : cached === void 0 ? automaticWebLayerCutoutIssue(element, (_b = layerScrollPath[layerScrollPath.length - 1]) !== null && _b !== void 0 ? _b : null, allowFixedPosition) : cached === false ? void 0 : cached;
        const overlayClassification = automaticWebLayerCutoutIssue(element, (_c = layerScrollPath[layerScrollPath.length - 1]) !== null && _c !== void 0 ? _c : null, allowFixedPosition, true);
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
        layers.push(Object.assign(Object.assign({}, layer), { rect: Object.assign(Object.assign({}, rect), { r: radius !== null && radius !== void 0 ? radius : 0 }), visualRect: Object.assign(Object.assign({}, visualRect), { r: radius !== null && radius !== void 0 ? radius : 0 }), coordinateSpace, scrollPath: layerScrollPath, backgroundPaint, cutoutIssue: radius === null ? {
          reason: "automatically detected web surfaces require a uniform pixel border-radius",
          mayMoveWithoutRefresh: false
        } : issue, overlayCutoutIssue }));
      }
      return layers;
    }
    detectBackgroundPaintConflicts(natives, layers) {
      var _a;
      for (const layer of layers) {
        if (!layer.backgroundPaint)
          continue;
        const style = getComputedStyle(layer.el);
        const backgroundClips = style.backgroundClip.split(",").map((value) => value.trim()).filter(Boolean);
        const backgroundClip = (_a = backgroundClips[backgroundClips.length - 1]) !== null && _a !== void 0 ? _a : "border-box";
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.visualRect || !above(native, layer) || !intersects(native.visualRect, layer.visualRect)) {
            continue;
          }
          if (canClipLayerAsUnit(layer, native.handle.el))
            continue;
          const unsafe = backgroundClip !== "border-box" || directTextIntersects(layer.el, native.visualRect) || hasVisiblePseudoElement(layer.el) || /\binset\b/i.test(style.boxShadow) || style.boxShadow !== "none" && style.boxShadow !== "" && !contains(layer.visualRect, native.visualRect) || !borderContains(layer.el, native.visualRect);
          if (!unsafe)
            continue;
          native.inactiveReason = "overlapping web paint cannot be separated from its background";
          native.active = false;
          native.rect = null;
          native.visualRect = null;
        }
      }
    }
    detectLayerCoordinateConflicts(natives, layers) {
      var _a;
      if (!this.compositionEnabled)
        return;
      for (const layer of layers) {
        const issue = (_a = layer.cutoutIssue) !== null && _a !== void 0 ? _a : !isSafeBridgeRect(layer.rect) ? {
          reason: "opaque web surface geometry exceeds the shared safe coordinate or size range",
          mayMoveWithoutRefresh: false
        } : null;
        if (!issue)
          continue;
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.rect || !native.visualRect || !above(native, layer) || !issue.mayMoveWithoutRefresh && !intersects(native.visualRect, layer.visualRect)) {
            continue;
          }
          const covered = layers.some((cover) => cover !== layer && cover.cutoutIssue === null && isElementVisible(cover.el) && above(cover, native) && opaqueContainsRect(cover.visualRect, layer.visualRect));
          if (covered)
            continue;
          native.inactiveReason = issue.reason;
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
          const routedByRoot = this.innerScrollMode === "root" && native.scrollPath.every((element) => this.rootScroll.isRouted(element)) && layer.scrollPath.every((element) => this.rootScroll.isRouted(element));
          if (layer.cutoutIssue !== null || routedByRoot || native.scrollPath.includes(layer.el) || sameScrollPath(layer.scrollPath, native.scrollPath) || !above(layer, native) || !isElementVisible(layer.el)) {
            continue;
          }
          const layerScrollViewport = scrollPathViewport(layer.scrollPath);
          const canCross = intersects(layer.visualRect, native.visualRect) || nativeScrollViewport !== null && intersects(layer.visualRect, nativeScrollViewport) || layerScrollViewport !== null && intersects(layerScrollViewport, native.visualRect);
          if (!canCross)
            continue;
          native.inactiveReason = "web layers from a different scroll container cannot be composed";
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
        native.inactiveReason = "this protected native surface must remain completely unobscured";
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
        native.inactiveReason = "scroll composition dependencies exceed the native host safety limit";
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
        native.inactiveReason = "overlapping composition regions exceed the native host safety limit";
        native.active = false;
        native.rect = null;
        native.visualRect = null;
        native.scrollPath = [];
        native.motionDependencies.clear();
      }
    }
    releaseRuntimeClip(element) {
      const state = this.runtimeClips.get(element);
      if (!state)
        return;
      for (const [property, value] of state.applied) {
        if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== "")
          continue;
        const original = state.original.get(property);
        if (original === null || original === void 0 ? void 0 : original.value)
          element.style.setProperty(property, original.value, original.priority);
        else
          element.style.removeProperty(property);
      }
      element.removeAttribute("data-ni-runtime-clip");
      this.runtimePaintStyles.set(element, element.style.cssText);
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
        if (original === null || original === void 0 ? void 0 : original.value) {
          element.style.setProperty(property, original.value, original.priority);
        } else {
          element.style.removeProperty(property);
        }
      }
      element.removeAttribute("data-ni-runtime-background");
      this.runtimePaintStyles.set(element, element.style.cssText);
      this.runtimeBackgrounds.delete(element);
    }
    applyRuntimeBackground(layer, holes, unionMask) {
      var _a;
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
      const svg = source.image === "none" && !unionMask ? "" : [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`,
        ` viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`,
        unionMask ? knockoutMaskDefinition(layer.rect, holes) : `<mask id="ni-knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><path fill="white" fill-rule="evenodd" d="${path}"/></mask>`,
        source.image === "none" ? `<rect width="${width}" height="${height}" fill="${escapeXml(source.color)}" mask="url(#ni-knockout)"/>` : `<foreignObject width="${width}" height="${height}" mask="url(#ni-knockout)"><div xmlns="http://www.w3.org/1999/xhtml" style="${escapeXml([
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
        ].join(";"))}"></div></foreignObject>`,
        "</svg>"
      ].join("");
      const values = /* @__PURE__ */ new Map([
        ["background-color", "transparent"],
        ["background-repeat", "no-repeat"],
        ["background-origin", "border-box"],
        ["background-clip", "border-box"],
        ["background-attachment", "scroll"],
        ["background-blend-mode", "normal"]
      ]);
      if (source.image === "none" && !unionMask) {
        const images = [];
        const sizes = [];
        const positions = [];
        for (const rect of complementRects(layer.rect, holes)) {
          images.push(`linear-gradient(${source.color}, ${source.color})`);
          sizes.push(`${round2(rect.w)}px ${round2(rect.h)}px`);
          positions.push(`${round2(rect.x - layer.rect.x)}px ${round2(rect.y - layer.rect.y)}px`);
        }
        for (const hole of holes) {
          const radius = Math.min((_a = hole.r) !== null && _a !== void 0 ? _a : 0, hole.w / 2, hole.h / 2);
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
      this.runtimePaintStyles.set(layer.el, layer.el.style.cssText);
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
      var _a;
      let suspended = false;
      const currentLayers = new Set(layers.map((layer) => layer.el));
      for (const element of this.rejectedMasks.keys()) {
        if (!currentLayers.has(element))
          this.rejectedMasks.delete(element);
      }
      for (const layer of layers) {
        const rejected = this.rejectedMasks.get(layer.el);
        if (rejected === void 0)
          continue;
        if (rejected !== maskStyleKey(layer.el)) {
          this.rejectedMasks.delete(layer.el);
          continue;
        }
        const candidates = knockoutCandidates(natives, layer);
        if (!roundedHolesOverlap(candidates.map((native) => Object.assign(Object.assign({}, native.visualRect), { r: native.rect.r }))))
          continue;
        for (const native of candidates)
          suspendNative(native, "authored mask properties override native knockout geometry");
      }
      for (const element of this.runtimeClips.keys()) {
        if (!currentLayers.has(element))
          this.releaseRuntimeClip(element);
      }
      for (const element of this.runtimeBackgrounds.keys()) {
        if (!currentLayers.has(element))
          this.releaseRuntimeBackground(element);
      }
      for (const layer of layers) {
        const candidates = knockoutCandidates(natives, layer);
        const holeCandidates = candidates.filter((native) => {
          if (sameCoordinatePath(native, layer))
            return true;
          const fullRect = Object.assign(Object.assign({}, docRect(native.el)), { r: native.rect.r });
          if (fullyVisibleInsideScrollPath(fullRect, native.scrollPath))
            return true;
          suspendNative(native, "partially clipped rounded native islands are unsupported across scroll paths");
          suspended = true;
          return false;
        });
        const rawHoles = this.compositionEnabled ? holeCandidates.map((native) => sameCoordinatePath(native, layer) ? native.rect : Object.assign(Object.assign({}, rectInScrollPathCoordinates(native.visualRect, layer.scrollPath)), { r: native.rect.r })) : [];
        const unionMask = roundedHolesOverlap(rawHoles);
        const holes = unionMask ? rawHoles : disjointHoles(rawHoles);
        if (holes.length === 0) {
          this.releaseRuntimeClip(layer.el);
          this.releaseRuntimeBackground(layer.el);
          continue;
        }
        const clipLayerAsUnit = layer.backgroundPaint !== null && holeCandidates.every((native) => canClipLayerAsUnit(layer, native.handle.el));
        if (layer.backgroundPaint && !clipLayerAsUnit) {
          this.releaseRuntimeClip(layer.el);
          if (this.applyRuntimeBackground(layer, holes, unionMask))
            continue;
          for (const native of natives) {
            if (!native.active || !native.visualRect || !above(native, layer) || !intersects(native.visualRect, layer.visualRect)) {
              continue;
            }
            native.inactiveReason = "the page background cannot be separated from its web content";
            native.active = false;
            native.rect = null;
            native.visualRect = null;
            suspended = true;
          }
          continue;
        }
        this.releaseRuntimeBackground(layer.el);
        const kind = unionMask ? "mask" : "path";
        const clip = holes.some((hole) => opaqueContainsRect(hole, layer.rect)) ? "inset(50%)" : knockoutPath(layer.rect, holes);
        const values = unionMask ? /* @__PURE__ */ new Map([
          ["mask-image", `url("data:image/svg+xml,${encodeURIComponent(knockoutMaskSvg(layer.rect, holes))}")`],
          ["mask-size", "100% 100%"],
          ["mask-position", "0px 0px"],
          ["mask-repeat", "no-repeat"],
          ["mask-mode", "alpha"],
          ["mask-composite", "add"],
          ["mask-clip", "border-box"],
          ["mask-origin", "border-box"]
        ]) : /* @__PURE__ */ new Map([["clip-path", clip]]);
        if (((_a = this.runtimeClips.get(layer.el)) === null || _a === void 0 ? void 0 : _a.kind) !== kind)
          this.releaseRuntimeClip(layer.el);
        const existing = this.runtimeClips.get(layer.el);
        const state = existing !== null && existing !== void 0 ? existing : {
          kind,
          original: new Map(Array.from(values.keys(), (property) => [
            property,
            {
              value: layer.el.style.getPropertyValue(property),
              priority: layer.el.style.getPropertyPriority(property)
            }
          ])),
          applied: /* @__PURE__ */ new Map()
        };
        this.runtimeClips.set(layer.el, state);
        for (const [property, value] of values) {
          if (layer.el.style.getPropertyValue(property) !== value || layer.el.style.getPropertyPriority(property) !== "") {
            layer.el.style.setProperty(property, value);
          }
        }
        state.applied = new Map(Array.from(values.keys(), (property) => [property, layer.el.style.getPropertyValue(property)]));
        layer.el.setAttribute("data-ni-runtime-clip", "");
        this.runtimePaintStyles.set(layer.el, layer.el.style.cssText);
        if (unionMask && !runtimeOwnsMask(layer.el, getComputedStyle(layer.el))) {
          this.releaseRuntimeClip(layer.el);
          this.rejectedMasks.set(layer.el, maskStyleKey(layer.el));
          for (const native of holeCandidates)
            suspendNative(native, "authored mask properties override native knockout geometry");
          suspended = true;
        }
      }
      if (suspended)
        this.applyWebKnockouts(natives, layers);
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
      const routed = /* @__PURE__ */ new Set();
      for (const native of natives) {
        if (!native.active || this.innerScrollMode !== "root")
          continue;
        for (const element of native.scrollPath)
          routed.add(element);
      }
      const routedOwners = Array.from(routed).sort((left, right) => comparePaintOrder(right, left));
      this.rootScroll.reconcile(routedOwners.map((element) => ({
        id: this.idForScrollContainer(element),
        element
      })));
      for (const native of natives) {
        if (native.scrollPath.some((element) => this.rootScroll.isRouted(element)))
          native.plane = "overlay";
      }
      this.resolveHostPlanes(natives, layers);
      this.resolveWebUnderlays(natives, layers);
      this.suspendUnsupportedOverlaps(natives);
      this.detectBackgroundPaintConflicts(natives, layers);
      this.detectLayerCoordinateConflicts(natives, layers);
      this.detectOverlayCutoutConflicts(natives, layers);
      this.enforceUnobscuredSurfaces(natives, layers);
      this.resolveMotionDependencies(natives, layers);
      this.enforceRegionCapacity(natives, layers);
      this.applyWebKnockouts(natives, layers);
      for (const native of natives)
        native.handle.setNativeInactive(native.inactiveReason);
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
      const bridgeRect = (rect, coordinateSpace) => coordinateSpace === "document" && this.innerScrollMode === "root" ? canonicalScrollRect(Object.assign(Object.assign({}, rect), { y: round2(rect.y - window.scrollY + this.rootScroll.pageOffset()) })) : rect;
      const region = (layer) => ({
        rect: bridgeRect(layer.rect, layer.coordinateSpace),
        coordinateSpace: layer.coordinateSpace,
        scrollPath: layer.scrollPath.map((element) => this.idForScrollContainer(element))
      });
      const nativeRegion = (native) => ({
        rect: bridgeRect(native.rect, native.coordinateSpace),
        coordinateSpace: native.coordinateSpace,
        scrollPath: native.scrollPath.map((element) => this.idForScrollContainer(element))
      });
      const cutouts = {};
      const exclusions = {};
      for (const native of natives) {
        if (!native.active || !native.rect)
          continue;
        cutouts[native.handle.islandId] = [];
        exclusions[native.handle.islandId] = [];
        if (!native.visualRect)
          continue;
        const nativeRect = native.visualRect;
        if (native.plane === "overlay") {
          cutouts[native.handle.islandId] = layers.filter((layer) => layer.cutoutIssue === null && layer.overlayCutoutIssue === null && isElementVisible(layer.el) && above(layer, native) && canMoveIntoIntersection(layer, native)).map(region);
        }
        exclusions[native.handle.islandId] = layers.filter((layer) => touchable(layer) && above(layer, native) && canMoveIntoIntersection(layer, native)).map(region);
        for (const other of natives) {
          if (other !== native && other.active && other.rect && other.visualRect && above(other, native) && intersects(other.visualRect, nativeRect)) {
            exclusions[native.handle.islandId].push(nativeRegion(other));
          }
        }
      }
      const components = natives.filter((native) => native.handle.canAttemptNative()).map((native) => {
        const rect = native.rect && bridgeRect(native.rect, native.coordinateSpace);
        return {
          id: native.handle.islandId,
          type: native.handle.type,
          plane: native.plane,
          coordinateSpace: native.coordinateSpace,
          scrollPath: native.scrollPath.map((element) => this.idForScrollContainer(element)),
          motionDependencies: Array.from(native.motionDependencies, (element) => this.idForScrollContainer(element)),
          rect,
          interactive: native.interactive,
          active: native.active
        };
      });
      const motionDependencies = (include) => {
        const dependencies = /* @__PURE__ */ new Set();
        for (const native of natives) {
          if (!include(native))
            continue;
          for (const element of native.motionDependencies)
            dependencies.add(element);
        }
        return Array.from(dependencies);
      };
      const activeScrollContainers = motionDependencies((native) => native.active);
      this.syncScrollListeners(activeScrollContainers);
      const referencedScrollContainers = motionDependencies((native) => native.handle.canAttemptNative()).sort((left, right) => comparePaintOrder(right, left));
      const scrollContainers = [];
      for (const element of referencedScrollContainers) {
        const visualRect = scrollContainerRect(element);
        if (!visualRect)
          continue;
        const ancestorPath = scrollPath(element);
        const viewportFixed = this.innerScrollMode === "root" && this.rootScroll.isRouted(element);
        let rect = rectInScrollPathCoordinates(viewportFixed ? Object.assign(Object.assign({}, visualRect), { y: round2(visualRect.y - window.scrollY + this.rootScroll.pageOffset()) }) : visualRect, ancestorPath);
        if (viewportFixed)
          rect = canonicalScrollRect(rect);
        const offset = physicalScrollOffset(element);
        scrollContainers.push({
          id: this.idForScrollContainer(element),
          rect,
          scrollPath: ancestorPath.map((ancestor) => this.idForScrollContainer(ancestor)),
          viewportFixed,
          contentWidth: round2(element.scrollWidth),
          contentHeight: round2(element.scrollHeight),
          offsetX: offset.x,
          offsetY: viewportFixed ? this.rootScroll.offsetFor(element) : offset.y
        });
      }
      return Object.assign(Object.assign({}, createEnvelope()), {
        components,
        documentRange: round2(this.rootScroll.pageRange()),
        scrollContainers,
        order,
        cutouts,
        exclusions
      });
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
            this.failIsland(event.island, typeof event.reason === "string" ? event.reason : "Native component failed.");
          }
        }));
        if (typeof window !== "undefined") {
          const resetOnPageHide = () => {
            this.stacking.prepareForPageHide();
            transport.reset(createEnvelope());
          };
          const reconcileOnPageShow = async (event) => {
            if (!event.persisted)
              return;
            await this.stacking.recreateNativeViews();
            this.stacking.refresh();
          };
          window.addEventListener("pagehide", resetOnPageHide);
          window.addEventListener("pageshow", reconcileOnPageShow);
          this.transportDisposers.push(() => window.removeEventListener("pagehide", resetOnPageHide));
          this.transportDisposers.push(() => window.removeEventListener("pageshow", reconcileOnPageShow));
        }
      }
      if (transport.available) {
        this.autostart();
        this.stacking.notifyTransportAvailable();
      }
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
    synchronize() {
      return Promise.resolve().then(() => this.stacking.synchronize());
    }
    command(island, nativeComponent, method, properties) {
      try {
        validateCommand(island, nativeComponent, method, properties);
      } catch (error) {
        return Promise.reject(error);
      }
      return this.transport.command(Object.assign(Object.assign({}, createEnvelope()), { island, islandType: nativeComponent, method, params: properties }));
    }
    listen(eventName, listener) {
      return this.transport.on(eventName, createEnvelope(), listener);
    }
    failIsland(id, reason) {
      var _a;
      (_a = this.stacking.findNative(id)) === null || _a === void 0 ? void 0 : _a.failNative(reason);
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
      var _a, _b, _c, _d;
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
        const completeLayout = () => {
          this.applyingLayouts--;
          if (this.applyingLayouts === 0 && this.pendingScrollOffsets)
            void this.flushScrollOffsets();
        };
        return this.transport.applyLayout(payload).catch((error) => {
          const reason = error instanceof Error && error.message ? `Native layout rejected: ${error.message}` : "Native layout rejected by the platform bridge.";
          for (const component of payload.components) {
            this.failIsland(component.id, reason);
          }
          throw error;
        }).then(() => completeLayout(), (error) => {
          completeLayout();
          throw error;
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
      void ((_b = (_a = document.fonts) === null || _a === void 0 ? void 0 : _a.ready) === null || _b === void 0 ? void 0 : _b.then(() => this.refresh()).catch(() => void 0));
      (_c = document.fonts) === null || _c === void 0 ? void 0 : _c.addEventListener("loadingdone", () => this.refresh());
      (_d = document.fonts) === null || _d === void 0 ? void 0 : _d.addEventListener("loadingerror", () => this.refresh());
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
            this.stacking.failScrollContainers(payload.offsets.map((offset) => offset.id), reason);
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
        var _a;
        if (!(tree instanceof ShadowRoot))
          return;
        (_a = this.shadowObservers.get(tree)) === null || _a === void 0 ? void 0 : _a.disconnect();
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
    commandGeneration: 0,
    commandsSuspended: false,
    islandSequence: 0,
    lifecycleListenersInstalled: false,
    definitions: /* @__PURE__ */ new Map()
  }));
  if (!Number.isSafeInteger(definitionState.commandGeneration))
    definitionState.commandGeneration = 0;
  if (typeof definitionState.commandsSuspended !== "boolean")
    definitionState.commandsSuspended = false;
  if (typeof definitionState.lifecycleListenersInstalled !== "boolean") {
    definitionState.lifecycleListenersInstalled = false;
  }
  function installCommandLifecycleListeners() {
    if (definitionState.lifecycleListenersInstalled || typeof window === "undefined")
      return;
    definitionState.lifecycleListenersInstalled = true;
    window.addEventListener("pagehide", () => {
      definitionState.commandGeneration += 1;
      definitionState.commandsSuspended = true;
    });
    window.addEventListener("pageshow", () => {
      definitionState.commandsSuspended = false;
    });
  }
  const scheduleMicrotask = typeof queueMicrotask === "function" ? queueMicrotask : (callback) => {
    void Promise.resolve().then(callback);
  };
  function defineNativeIsland(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    installCommandLifecycleListeners();
    if (!options.tagName.includes("-")) {
      throw new TypeError("tagName must be a valid custom-element name.");
    }
    if (!options.nativeComponent.trim()) {
      throw new TypeError("nativeComponent must not be empty.");
    }
    const observedAttributes = [...new Set((_a = options.observedAttributes) !== null && _a !== void 0 ? _a : [])];
    const observedStyles = [
      ...new Set(((_b = options.observedStyles) !== null && _b !== void 0 ? _b : []).map((property) => property.trim()).filter(Boolean))
    ];
    const structuralSignature = JSON.stringify({
      isInteractive: (_c = options.isInteractive) !== null && _c !== void 0 ? _c : false,
      accessibility: (_d = options.accessibility) !== null && _d !== void 0 ? _d : "web",
      requiresUnobscuredSurface: (_e = options.requiresUnobscuredSurface) !== null && _e !== void 0 ? _e : false,
      observedAttributes: [...observedAttributes].sort(),
      observedStyles: [...observedStyles].sort(),
      preserveChildren: (_f = options.preserveChildren) !== null && _f !== void 0 ? _f : false,
      events: Object.entries((_g = options.events) !== null && _g !== void 0 ? _g : {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    });
    const existingDefinition = definitionState.definitions.get(options.tagName);
    if (existingDefinition) {
      if (existingDefinition.nativeComponent === options.nativeComponent) {
        if (existingDefinition.structuralSignature !== void 0 && existingDefinition.handlers !== void 0) {
          if (existingDefinition.structuralSignature !== structuralSignature) {
            throw new Error(`<${options.tagName}> is already registered with a different definition contract.`);
          }
          existingDefinition.handlers.getProperties = options.getProperties;
          existingDefinition.handlers.renderFallback = options.renderFallback;
        }
        return existingDefinition.constructor;
      }
      throw new Error(`<${options.tagName}> is already registered for "${existingDefinition.nativeComponent}".`);
    }
    if (customElements.get(options.tagName)) {
      throw new Error(`<${options.tagName}> was defined outside Native Islands.`);
    }
    const handlers = {
      getProperties: options.getProperties,
      renderFallback: options.renderFallback
    };
    const reflectedAttributes = /* @__PURE__ */ new Set();
    const contract = {
      tagName: options.tagName,
      commands: ["create", "update"],
      observedAttributes,
      requiresUnobscuredSurface: (_h = options.requiresUnobscuredSurface) !== null && _h !== void 0 ? _h : false
    };
    registerIslandContract(options.nativeComponent, contract);
    class DefinedNativeIsland extends HTMLElement {
      constructor() {
        var _a2, _b2;
        super();
        this.islandId = `native-island-${++definitionState.islandSequence}`;
        this.type = options.nativeComponent;
        this.interactive = (_a2 = options.isInteractive) !== null && _a2 !== void 0 ? _a2 : false;
        this.requiresUnobscuredSurface = (_b2 = options.requiresUnobscuredSurface) !== null && _b2 !== void 0 ? _b2 : false;
        this.connected = false;
        this.mountGeneration = 0;
        this.nativeCreated = false;
        this.nativeFailed = false;
        this.nativeInactiveReason = null;
        this.disconnectGeneration = 0;
        this.eventDisposers = [];
        this.accessibilityFace = null;
        this.updateScheduled = false;
        this.observedStyleSnapshot = null;
        this.presentationPaint = null;
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
        return this.canAttemptNative();
      }
      canAttemptNative() {
        return this.connected && !this.nativeFailed && nativeIslandsRuntime.available;
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
        if (!this.connected || this.nativeFailed || this.nativeCreated)
          return;
        this.activateNative();
        nativeIslandsRuntime.refresh();
      }
      recreateNative() {
        if (!this.connected || this.nativeFailed || !this.nativeCreated || !nativeIslandsRuntime.available) {
          return Promise.resolve();
        }
        return this.send("create");
      }
      activateNative() {
        var _a2, _b2;
        if (!this.connected || this.nativeFailed || this.nativeCreated || !nativeIslandsRuntime.available)
          return;
        this.nativeCreated = true;
        this.restoreFallbackPresentation();
        if (((_a2 = options.accessibility) !== null && _a2 !== void 0 ? _a2 : "web") === "web") {
          this.renderAccessibilityFace();
        }
        this.hideWebPresentation();
        for (const [nativeEvent, domEvent] of Object.entries((_b2 = options.events) !== null && _b2 !== void 0 ? _b2 : {})) {
          this.eventDisposers.push(nativeIslandsRuntime.listen(nativeEvent, (event) => {
            if (event.island !== this.islandId)
              return;
            const detail = Object.assign({}, event);
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
        scheduleMicrotask(() => {
          if (generation !== this.disconnectGeneration || this.isConnected)
            return;
          this.mountGeneration += 1;
          this.connected = false;
          this.nativeFailed = false;
          this.nativeInactiveReason = null;
          this.nativeCreated = false;
          this.observedStyleSnapshot = null;
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
        if (this.nativeCreated && !this.nativeFailed) {
          this.scheduleUpdate();
        } else if (!nativeIslandsRuntime.available) {
          this.renderFallback();
        }
      }
      failNative(reason) {
        var _a2;
        if (this.nativeFailed)
          return;
        this.nativeFailed = true;
        this.nativeCreated = false;
        for (const dispose of this.eventDisposers.splice(0))
          dispose();
        (_a2 = this.accessibilityFace) === null || _a2 === void 0 ? void 0 : _a2.remove();
        this.accessibilityFace = null;
        this.setAttribute("data-native-islands-error", "");
        nativeIslandsRuntime.refresh();
        this.dispatchEvent(new CustomEvent("nativeislanderror", {
          bubbles: true,
          composed: true,
          detail: { reason }
        }));
      }
      setNativeInactive(reason) {
        if (this.nativeInactiveReason === reason)
          return;
        this.nativeInactiveReason = reason;
        if (reason === null)
          this.removeAttribute("data-native-islands-inactive");
        else
          this.setAttribute("data-native-islands-inactive", "");
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
        if (this.nativeCreated && !this.nativeFailed) {
          this.scheduleUpdate();
        } else if (!nativeIslandsRuntime.available) {
          this.renderFallback();
        }
      }
      readObservedStyleSnapshot() {
        const style = getComputedStyle(this);
        return JSON.stringify(observedStyles.map((property) => style.getPropertyValue(property)));
      }
      properties() {
        var _a2;
        if (observedStyles.length > 0) {
          this.observedStyleSnapshot = this.readObservedStyleSnapshot();
        }
        return (_a2 = handlers.getProperties) === null || _a2 === void 0 ? void 0 : _a2.call(handlers, this);
      }
      async send(method) {
        const generation = this.mountGeneration;
        try {
          await nativeIslandsRuntime.command(this.islandId, options.nativeComponent, method, this.properties());
        } catch (error) {
          if (!this.connected || generation !== this.mountGeneration)
            return;
          this.failNative(error instanceof Error ? error.message : "Native command failed.");
        }
      }
      scheduleUpdate(refreshPresentation = true) {
        if (this.updateScheduled)
          return;
        this.updateScheduled = true;
        const commandGeneration = definitionState.commandGeneration;
        scheduleMicrotask(() => {
          var _a2;
          this.updateScheduled = false;
          if (!this.connected || this.nativeFailed || !nativeIslandsRuntime.available || definitionState.commandsSuspended || commandGeneration !== definitionState.commandGeneration) {
            return;
          }
          if (((_a2 = options.accessibility) !== null && _a2 !== void 0 ? _a2 : "web") === "web" && refreshPresentation) {
            this.renderAccessibilityFace();
          }
          void this.send("update");
        });
      }
      renderFallback() {
        var _a2;
        this.restoreWebPresentation();
        this.restoreFallbackPresentation();
        this.accessibilityFace = null;
        if (!options.preserveChildren)
          this.clearChildren();
        const beforeAttributes = new Map(this.getAttributeNames().map((name) => [name, this.getAttribute(name)]));
        const beforeOnClick = this.onclick;
        handlers.renderFallback(this);
        const names = /* @__PURE__ */ new Set([...beforeAttributes.keys(), ...this.getAttributeNames()]);
        for (const name of names) {
          if (name === "data-native-islands-fallback")
            continue;
          const before = (_a2 = beforeAttributes.get(name)) !== null && _a2 !== void 0 ? _a2 : null;
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
          if (previous === null || previous === void 0 ? void 0 : previous.value)
            this.style.setProperty(property, previous.value, previous.priority);
          else
            this.style.removeProperty(property);
        }
        this.removeAttribute("data-native-islands-presentation-hidden");
        this.presentationPaint = null;
      }
      restoreFallbackPresentation() {
        var _a2;
        this.removeAttribute("data-native-islands-fallback");
        this.removeAttribute("data-native-islands-error");
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
        (_a2 = this.accessibilityFace) === null || _a2 === void 0 ? void 0 : _a2.remove();
        this.accessibilityFace = null;
        if (!options.preserveChildren)
          this.clearChildren();
      }
      clearChildren() {
        if (typeof this.replaceChildren === "function") {
          this.replaceChildren();
          return;
        }
        while (this.firstChild)
          this.removeChild(this.firstChild);
      }
      renderAccessibilityFace() {
        var _a2;
        (_a2 = this.accessibilityFace) === null || _a2 === void 0 ? void 0 : _a2.remove();
        const face = document.createElement("div");
        for (const name of this.getAttributeNames()) {
          if (name === "id" || name === "style" || name === "data-native-islands-fallback")
            continue;
          const value = this.getAttribute(name);
          if (value !== null)
            face.setAttribute(name, value);
        }
        handlers.renderFallback(face);
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
      constructor: DefinedNativeIsland,
      structuralSignature,
      handlers
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
      innerScrollMode: platform() === "ios" ? "native" : platform() === "android" ? "root" : "unsupported",
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
  const OBSERVED_ATTRIBUTES = ["text-type", "maximum-age", "timeout", "enable-location-fallback"];
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
  function nonNegativeIntegerAttribute(element, name, fallback, minimum = 0) {
    const value = element.getAttribute(name);
    if (value === null) return fallback;
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number >= minimum ? number : fallback;
  }
  function booleanAttribute(element, name, fallback) {
    const value = element.getAttribute(name);
    if (value === null) return fallback;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }
  function dispatch(element, type, detail) {
    element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
  function toLocationButtonPosition(position) {
    return {
      timestamp: position.timestamp,
      coords: {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        altitude: position.altitude,
        altitudeAccuracy: position.altitudeAccuracy,
        heading: position.heading,
        speed: position.speed,
        magneticHeading: position.magneticHeading,
        trueHeading: position.trueHeading,
        headingAccuracy: position.headingAccuracy,
        course: position.course
      }
    };
  }
  function dispatchPosition(element, position) {
    dispatch(element, "location-position", position);
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
        dispatch(element, "location-position", toLocationButtonPosition(position));
      },
      (value) => {
        const error = value;
        if (error?.code === "OS-PLUG-GLOC-0003" || error?.code === "OS-PLUG-GLOC-0008") {
          dispatch(element, "location-grant", {
            granted: false
          });
        }
        dispatch(element, "location-error", {
          reason: error?.message || "Location request failed",
          code: error?.code
        });
      },
      "OSGeolocation",
      "getCurrentPosition",
      [
        {
          enableHighAccuracy: true,
          timeout: nonNegativeIntegerAttribute(element, "timeout", 1e4, 1),
          maximumAge: nonNegativeIntegerAttribute(element, "maximum-age", 0),
          enableLocationFallback: booleanAttribute(element, "enable-location-fallback", true)
        }
      ]
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
        {
          enableHighAccuracy: true,
          timeout: nonNegativeIntegerAttribute(element, "timeout", 1e4, 1),
          maximumAge: nonNegativeIntegerAttribute(element, "maximum-age", 0)
        }
      );
    });
    element.replaceChildren(button);
  }
  const installedStyleRoots = /* @__PURE__ */ new WeakSet();
  function styleRootFor(element) {
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root : document;
  }
  function installFallbackStyles(root = document) {
    if (installedStyleRoots.has(root)) return;
    installedStyleRoots.add(root);
    if (root.querySelector("style[data-os-location-button]")) return;
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
    if (root instanceof ShadowRoot) {
      root.append(style);
      return;
    }
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
        installFallbackStyles(styleRootFor(element));
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
          clickablePadding: clampedPixelStyle(style, STYLE_PROPERTIES.clickablePadding, 4, 8, 6),
          maximumAge: nonNegativeIntegerAttribute(element, "maximum-age", 0),
          timeout: nonNegativeIntegerAttribute(element, "timeout", 1e4, 1),
          enableLocationFallback: booleanAttribute(element, "enable-location-fallback", true)
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
