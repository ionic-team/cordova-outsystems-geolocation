<<<<<<< Updated upstream
(function() {
  "use strict";
  const SQUARE = [0, 0, 0, 0];
  let projectBounds = null;
  let boundsMemo = null;
  function withBoundsReadScope(read) {
    const previous = boundsMemo;
    boundsMemo = /* @__PURE__ */ new WeakMap();
    try {
      return read();
    } finally {
      boundsMemo = previous;
    }
  }
  function withoutBoundsReadScope(read) {
    const previous = boundsMemo;
    boundsMemo = null;
    try {
      return read();
    } finally {
      boundsMemo = previous;
    }
  }
  function withBoundsProjection(project, read) {
    const previous = projectBounds;
    const previousMemo = boundsMemo;
    projectBounds = project;
    if (boundsMemo)
      boundsMemo = /* @__PURE__ */ new WeakMap();
    try {
      return read();
    } finally {
      projectBounds = previous;
      boundsMemo = previousMemo;
    }
  }
  function readBounds(element, bounds) {
    var _a;
    const cached = bounds ? void 0 : boundsMemo === null || boundsMemo === void 0 ? void 0 : boundsMemo.get(element);
    if (cached)
      return cached;
    const measured = bounds !== null && bounds !== void 0 ? bounds : element.getBoundingClientRect();
    const projected = (_a = projectBounds === null || projectBounds === void 0 ? void 0 : projectBounds(element, measured)) !== null && _a !== void 0 ? _a : measured;
    if (!bounds)
      boundsMemo === null || boundsMemo === void 0 ? void 0 : boundsMemo.set(element, projected);
    return projected;
  }
  function round2(value) {
    return Math.round(value * 100) / 100;
  }
  function cssCornerRadii(style, width, height) {
    const radii = [];
    for (const corner of [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius
    ]) {
      const [horizontal, vertical = horizontal] = corner.trim().split(/\s+/);
      const rx = cssLength(horizontal, width);
      const ry = cssLength(vertical, height);
      if (rx === null || ry === null || Math.abs(rx - ry) > 0.5)
        return null;
      radii.push((rx + ry) / 2);
    }
    const [topLeft, topRight, bottomRight, bottomLeft] = radii;
    return fitRadii([topLeft, topRight, bottomRight, bottomLeft], width, height);
  }
  function fitRadii([topLeft, topRight, bottomRight, bottomLeft], width, height) {
    const fit = (sum, side) => sum > 0 ? side / sum : 1;
    const scale = Math.min(1, fit(topLeft + topRight, width), fit(bottomLeft + bottomRight, width), fit(topLeft + bottomLeft, height), fit(topRight + bottomRight, height));
    const radius = (value) => round2(Math.max(0, value) * scale);
    return [radius(topLeft), radius(topRight), radius(bottomRight), radius(bottomLeft)];
  }
  function insetRadii(radii, inset) {
    const [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) => round2(Math.max(0, radius - inset)));
    return [topLeft, topRight, bottomRight, bottomLeft];
  }
  function cssLength(value, basis) {
    const match = /^(\S+?)(px|%)$/.exec(value);
    if (!match)
      return null;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number < 0)
      return null;
    return match[2] === "%" ? number * basis / 100 : number;
  }
  function docRect(element) {
    const bounds = readBounds(element);
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
    const bounds = readBounds(element);
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
  function hasArea(rect) {
    return rect !== null && rect.w > 0 && rect.h > 0;
  }
  function isSafeBridgeRect(rect) {
    var _a;
    const radii = (_a = rect.r) !== null && _a !== void 0 ? _a : SQUARE;
    return [rect.x, rect.y, rect.w, rect.h, ...radii].every(Number.isFinite) && rect.w > 0 && rect.h > 0 && radii.every((radius) => radius >= 0);
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
  function union(left, right) {
    const x = Math.min(left.x, right.x);
    const y = Math.min(left.y, right.y);
    return {
      x,
      y,
      w: Math.max(left.x + left.w, right.x + right.w) - x,
      h: Math.max(left.y + left.h, right.y + right.h) - y
    };
  }
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
      if (rects.length === 1 || rects.some(hasComplexOpaqueShape)) {
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
      const union2 = [];
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
          const previous = union2.find((rect) => rect.x === left && rect.w === width && rect.y + rect.h === y);
          if (previous)
            previous.h += height;
          else
            union2.push({ x: left, y, w: width, h: height });
          runStart = null;
        }
      }
      output.push(...union2);
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
      return [Object.assign(Object.assign({}, layer), { r: SQUARE })];
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
          output.push({ x: left, y, w: width, h: height, r: SQUARE });
        runStart = null;
      }
    }
    return output;
  }
  function opaqueContainsRect(outer, inner) {
    var _a, _b;
    if (!contains(outer, inner))
      return false;
    if (Math.abs(outer.x - inner.x) <= CONTAINMENT_EPSILON && Math.abs(outer.y - inner.y) <= CONTAINMENT_EPSILON && Math.abs(outer.w - inner.w) <= CONTAINMENT_EPSILON && Math.abs(outer.h - inner.h) <= CONTAINMENT_EPSILON && ((_a = outer.r) !== null && _a !== void 0 ? _a : SQUARE).every((radius, index) => {
      var _a2;
      return Math.abs(radius - ((_a2 = inner.r) !== null && _a2 !== void 0 ? _a2 : SQUARE)[index]) <= CONTAINMENT_EPSILON;
    })) {
      return true;
    }
    const [topLeft, topRight, bottomRight, bottomLeft] = fitRadii((_b = outer.r) !== null && _b !== void 0 ? _b : SQUARE, outer.w, outer.h);
    const corners = [
      [inner.x, inner.y, topLeft],
      [inner.x + inner.w, inner.y, topRight],
      [inner.x, inner.y + inner.h, bottomLeft],
      [inner.x + inner.w, inner.y + inner.h, bottomRight]
    ];
    return corners.every(([x, y, radius], index) => {
      if (radius <= 0)
        return true;
      const left = index === 0 || index === 2;
      const top = index < 2;
      const centerX = left ? outer.x + radius : outer.x + outer.w - radius;
      const centerY = top ? outer.y + radius : outer.y + outer.h - radius;
      const insideCorner = (left ? x < centerX : x > centerX) && (top ? y < centerY : y > centerY);
      return !insideCorner || (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
    });
  }
  function hasComplexOpaqueShape(rect) {
    var _a;
    return ((_a = rect.r) !== null && _a !== void 0 ? _a : SQUARE).some((radius) => radius > 0);
  }
  function knockoutPathData(layer, holes) {
    const width = round2(layer.w);
    const height = round2(layer.h);
    let path = `M0 0 H${width} V${height} H0 Z`;
    for (const hole of holes)
      path += holePathData(layer, hole);
    return path;
  }
  function holePathData(layer, hole) {
    var _a;
    const x = round2(hole.x - layer.x);
    const y = round2(hole.y - layer.y);
    const [topLeft, topRight, bottomRight, bottomLeft] = fitRadii((_a = hole.r) !== null && _a !== void 0 ? _a : SQUARE, hole.w, hole.h);
    return ` M${round2(x + topLeft)} ${y} A${topLeft} ${topLeft} 0 0 0 ${x} ${round2(y + topLeft)} L${x} ${round2(y + hole.h - bottomLeft)} A${bottomLeft} ${bottomLeft} 0 0 0 ${round2(x + bottomLeft)} ${round2(y + hole.h)} L${round2(x + hole.w - bottomRight)} ${round2(y + hole.h)} A${bottomRight} ${bottomRight} 0 0 0 ${round2(x + hole.w)} ${round2(y + hole.h - bottomRight)} L${round2(x + hole.w)} ${round2(y + topRight)} A${topRight} ${topRight} 0 0 0 ${round2(x + hole.w - topRight)} ${y} Z`;
  }
  function knockoutPath(layer, holes) {
    return `path("${knockoutPathData(layer, holes)}")`;
  }
  function knockoutMaskDefinition(layer, holes) {
    const width = round2(layer.w);
    const height = round2(layer.h);
    const removed = holes.map((hole) => `<path d="${holePathData(layer, hole).trim()}" fill="black"/>`).join("");
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
  function axisScrolls(overflow) {
    return overflow === "auto" || overflow === "scroll" || overflow === "hidden";
  }
  let scrollStructure = null;
  function withScrollStructure(read) {
    const previous = scrollStructure;
    scrollStructure = previous !== null && previous !== void 0 ? previous : /* @__PURE__ */ new WeakMap();
    try {
      return read();
    } finally {
      scrollStructure = previous;
    }
  }
  function scrolls(el, style) {
    const decided = scrollStructure === null || scrollStructure === void 0 ? void 0 : scrollStructure.get(el);
    if (decided !== void 0)
      return decided;
    const scrolling = axisScrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1 || axisScrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    scrollStructure === null || scrollStructure === void 0 ? void 0 : scrollStructure.set(el, scrolling);
    return scrolling;
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
    return [...planMemo$1("scrollContainers", element, () => readIndependentScrollContainers(element))];
  }
  function readIndependentScrollContainers(element) {
    const containers = [];
    let position = computedStyle(element).position;
    let node = composedParentElement(element);
    while (node) {
      const style = computedStyle(node);
      const contains2 = position === "fixed" ? establishesFixedContainingBlock(node) : position !== "absolute" || style.position !== "static" || establishesFixedContainingBlock(node);
      if (contains2) {
        if (node !== document.body && node !== document.documentElement && (node.hasAttribute("data-ni-root-scroll-owner") || scrolls(node, style)))
          containers.push(node);
        position = style.position;
      }
      node = composedParentElement(node);
    }
    return containers;
  }
  function establishesFixedContainingBlock(element) {
    const style = computedStyle(element);
    const active = (value) => value !== void 0 && value !== "" && value !== "none";
    const contain = new Set(style.contain.split(/\s+/).filter(Boolean));
    const willChange = new Set(style.willChange.split(",").map((value) => value.trim()).filter(Boolean));
    const individualTransform = ["translate", "scale", "rotate"].some((property) => {
      const value = style.getPropertyValue(property).trim();
      return value !== "" && value !== "none";
    }) || willChange.has("transform");
    return active(style.transform) || individualTransform || active(style.perspective) || active(style.filter) || active(style.getPropertyValue("backdrop-filter")) || contain.has("layout") || contain.has("paint") || contain.has("strict") || contain.has("content") || style.contentVisibility === "auto" || style.contentVisibility === "hidden" || willChange.has("perspective") || willChange.has("filter");
  }
  function clipsThroughPaintContainment(style) {
    return /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(style.getPropertyValue("contain").trim());
  }
  function hasUnsupportedClipEdge(style) {
    const clipMargin = style.getPropertyValue("overflow-clip-margin").trim();
    return clipMargin !== "" && clipMargin !== "0" && clipMargin !== "0px";
  }
  function markedLayerPaintEscapes(el, style) {
    const ownOutsetPaint = style.textShadow !== "" && style.textShadow !== "none" || propertyIsActive(style, "filter");
    const visibleOverflow = style.overflowX === "visible" && el.scrollWidth > el.clientWidth + 1 || style.overflowY === "visible" && el.scrollHeight > el.clientHeight + 1;
    return ownOutsetPaint || visibleOverflow && contentLeavesBox(el);
  }
  function contentLeavesBox(el) {
    if (typeof document.createRange !== "function")
      return true;
    const box = readBounds(el);
    const leaves = (rect) => rect.width > 0 && rect.height > 0 && (rect.left < box.left - 1 || rect.top < box.top - 1 || rect.right > box.right + 1 || rect.bottom > box.bottom + 1);
    const range = document.createRange();
    const pending = Array.from(el.childNodes);
    for (let walked = 0; pending.length > 0; walked += 1) {
      if (walked === 256)
        return true;
      const node = pending.pop();
      if (node.nodeType === Node.TEXT_NODE) {
        range.selectNodeContents(node);
        if (leaves(readBounds(el, range.getBoundingClientRect())))
          return true;
      } else if (node instanceof HTMLElement) {
        if (node.shadowRoot || leaves(readBounds(node)))
          return true;
        pending.push(...Array.from(node.childNodes));
      }
    }
    return false;
  }
  function clipHoldsLayer(node, source) {
    return geometryFact(() => {
      const style = computedStyle(node);
      return clipOpaqueShapeContains(node, style, readBounds(source)) || clipsOnlyOffscreen(node, style);
    });
  }
  function clipOpaqueShapeContains(node, style, islandRect) {
    const bounds = readBounds(node);
    const radii = cssCornerRadii(style, bounds.right - bounds.left, bounds.bottom - bounds.top);
    if (radii === null)
      return false;
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const innerRadii = insetRadii(radii, Math.min(borderTop, borderRight, borderBottom, borderLeft));
    const paintContains = clipsThroughPaintContainment(style);
    const hasRadii = innerRadii.some((radius) => radius > 0);
    const clipsX = paintContains || hasRadii || style.overflowX !== "visible";
    const clipsY = paintContains || hasRadii || style.overflowY !== "visible";
    const left = bounds.left + borderLeft;
    const top = bounds.top + borderTop;
    const outer = {
      x: clipsX ? left : Math.min(left, islandRect.left),
      y: clipsY ? top : Math.min(top, islandRect.top),
      w: clipsX ? Math.max(0, bounds.right - bounds.left - borderLeft - borderRight) : Math.max(bounds.right, islandRect.right) - Math.min(left, islandRect.left),
      h: clipsY ? Math.max(0, bounds.bottom - bounds.top - borderTop - borderBottom) : Math.max(bounds.bottom, islandRect.bottom) - Math.min(top, islandRect.top),
      r: innerRadii
    };
    const inner = {
      x: islandRect.left,
      y: islandRect.top,
      w: islandRect.right - islandRect.left,
      h: islandRect.bottom - islandRect.top
    };
    return opaqueContainsRect(outer, inner);
  }
  function paddingBox(element) {
    const bounds = readBounds(element);
    const left = bounds.left + element.clientLeft;
    const top = bounds.top + element.clientTop;
    return {
      x: left,
      y: top,
      w: Math.min(element.clientWidth, bounds.width - element.clientLeft),
      h: Math.min(element.clientHeight, bounds.height - element.clientTop)
    };
  }
  function innerClip(node, style) {
    const bounds = readBounds(node);
    const radii = cssCornerRadii(style, bounds.width, bounds.height);
    if (radii === null)
      return null;
    const border = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map((width) => Number.parseFloat(width) || 0);
    const [top, right, bottom, left] = border;
    return {
      x: bounds.left + left,
      y: bounds.top + top,
      w: Math.max(0, bounds.width - left - right),
      h: Math.max(0, bounds.height - top - bottom),
      r: insetRadii(radii, Math.max(...border))
    };
  }
  function sharedCorners(clip, port) {
    const near = (a, b) => Math.abs(a - b) <= 0.5;
    const left = near(clip.x, port.x);
    const top = near(clip.y, port.y);
    const right = near(clip.x + clip.w, port.x + port.w);
    const bottom = near(clip.y + clip.h, port.y + port.h);
    return [left && top, right && top, right && bottom, left && bottom];
  }
  function inheritedCornerRadii(element, port) {
    const radii = [0, 0, 0, 0];
    let node = composedParentElement(element);
    for (let depth = 0; node && depth < 16; depth++, node = composedParentElement(node)) {
      if (node === document.documentElement || node === document.body)
        break;
      const style = computedStyle(node);
      if (!clips(style) && !clipsThroughPaintContainment(style))
        continue;
      if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
        break;
      const clip = innerClip(node, style);
      if (!(clip === null || clip === void 0 ? void 0 : clip.r))
        break;
      const shared = sharedCorners(clip, port);
      if (!shared.some(Boolean))
        break;
      shared.forEach((corner, index) => {
        var _a, _b;
        if (corner)
          radii[index] = Math.max(radii[index], (_b = (_a = clip.r) === null || _a === void 0 ? void 0 : _a[index]) !== null && _b !== void 0 ? _b : 0);
      });
    }
    return fitRadii(radii, port.w, port.h);
  }
  function roundsScrollport(node, style, port) {
    const clip = innerClip(node, style);
    if (!(clip === null || clip === void 0 ? void 0 : clip.r))
      return false;
    const shared = sharedCorners(clip, port);
    const [topLeft, topRight, bottomRight, bottomLeft] = clip.r.map((radius, index) => shared[index] ? 0 : radius);
    const radii = [topLeft, topRight, bottomRight, bottomLeft];
    return opaqueContainsRect(Object.assign(Object.assign({}, clip), { r: radii }), port);
  }
  function clipsOnlyOffscreen(node, style) {
    const root = document.scrollingElement;
    let fixed = false;
    for (let current = node; current && !fixed; current = composedParentElement(current)) {
      fixed = computedStyle(current).position === "fixed";
    }
    const still = fixed || !!root && root.scrollHeight <= root.clientHeight && root.scrollWidth <= root.clientWidth;
    if (!still || !(window.innerWidth > 0) || !(window.innerHeight > 0))
      return false;
    const screen = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    return clipOpaqueShapeContains(node, style, screen);
  }
  function containsComposed(ancestor, element) {
    for (let node = element; node; node = composedParentElement(node)) {
      if (node === ancestor)
        return true;
    }
    return false;
  }
  function composedParentElement(element) {
    const cached = readParents === null || readParents === void 0 ? void 0 : readParents.get(element);
    if (cached !== void 0)
      return cached;
    const parent = uncachedComposedParentElement(element);
    readParents === null || readParents === void 0 ? void 0 : readParents.set(element, parent);
    return parent;
  }
  function uncachedComposedParentElement(element) {
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
  function isIdentityScale(style) {
    const value = style.getPropertyValue("scale").trim();
    if (value === "" || value === "none")
      return true;
    const parts = value.split(/\s+/);
    return parts.length <= 3 && parts.every((part) => part.endsWith("%") ? Number(part.slice(0, -1)) === 100 : Number(part) === 1);
  }
  function isIdentityRotate(style) {
    const value = style.getPropertyValue("rotate").trim();
    if (value === "" || value === "none" || value === "0")
      return true;
    return value.split(/\s+/).some((part) => /^[+-]?(?:0+(?:\.0*)?|\.(?:0+))(?:deg|rad|grad|turn)$/i.test(part));
  }
  function hasAncestorBackdropFilter(el) {
    for (let node = composedParentElement(el); node; node = composedParentElement(node)) {
      const style = computedStyle(node);
      if (propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter")) {
        return true;
      }
    }
    return false;
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
  function hasRootContainment(style) {
    const contain = style.getPropertyValue("contain").trim();
    const visibility = style.getPropertyValue("content-visibility").trim();
    const containerType = style.getPropertyValue("container-type").trim();
    return contain !== "" && contain !== "none" || visibility !== "" && visibility !== "visible" || containerType !== "" && containerType !== "normal";
  }
  function isViewportRootElement(node, style) {
    return node === document.documentElement || node === document.body && !hasRootContainment(style) && !hasRootContainment(computedStyle(document.documentElement));
  }
  function bodyBackgroundPropagates() {
    const root = document.documentElement;
    const body = document.body;
    if (!body || body.parentElement !== root)
      return false;
    const rootStyle = computedStyle(root);
    if (rootStyle.backgroundImage !== "" && rootStyle.backgroundImage !== "none" || colorAlpha(rootStyle.backgroundColor) !== 0)
      return false;
    return !hasRootContainment(rootStyle) && !hasRootContainment(computedStyle(body));
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
  function hasVisiblePseudoElement(el, includeTranslucentFills = false) {
    return ["::before", "::after"].some((pseudo) => pseudoPaints(computedStyle(el, pseudo), includeTranslucentFills));
  }
  function pseudoPaints(style, includeTranslucentFills = false) {
    var _a, _b, _c;
    const content = ((_a = style.content) !== null && _a !== void 0 ? _a : "").trim();
    if (content === "" || content === "none" || content === "normal" || style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0) {
      return false;
    }
    if (content !== '""' && content !== "''")
      return true;
    const fill = style.backgroundColor === "" ? 0 : (_b = colorAlpha(style.backgroundColor)) !== null && _b !== void 0 ? _b : 1;
    return ((_c = style.display) !== null && _c !== void 0 ? _c : "").includes("list-item") || (includeTranslucentFills ? fill > 0 : fill === 1) || style.backgroundImage !== "" && style.backgroundImage !== "none" || insetShadow(style) || style.borderImageSource != null && style.borderImageSource !== "" && style.borderImageSource !== "none" || propertyIsActive(style, "filter") || propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter") || [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some((width) => Number.parseFloat(width) > 0);
  }
  function insetShadow(style) {
    var _a;
    return /\binset\b/.test((_a = style.boxShadow) !== null && _a !== void 0 ? _a : "");
  }
  function hasOuterDecoration(style) {
    var _a;
    const shadows = ((_a = style.boxShadow) !== null && _a !== void 0 ? _a : "").split(/,(?![^(]*\))/);
    return shadows.some((shadow) => shadow.trim() !== "" && shadow.trim() !== "none" && !/\binset\b/.test(shadow)) || style.outlineStyle !== "" && style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
  }
  const paintedElementNames = /* @__PURE__ */ new Set(["BUTTON", "CANVAS", "IFRAME", "IMG", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);
  function hasSparsePaint(el, style) {
    return readStyleFact("sparsePaint", style, () => {
      var _a;
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
      return hasBorder || hasVisiblePseudoElement(el) || insetShadow(style) || style.textShadow !== "" && style.textShadow !== "none";
    });
  }
  function isTranslucentFill(el, fadedByNative = false) {
    var _a;
    const style = computedStyle(el);
    const alpha = ((_a = colorAlpha(style.backgroundColor)) !== null && _a !== void 0 ? _a : 0) * (fadedByNative ? 1 : Number.parseFloat(style.opacity));
    return alpha < 1 && style.backgroundImage === "none" && el.children.length === 0 && !hasSparsePaint(el, style);
  }
  function paintEscapesBorderBox(el) {
    const style = computedStyle(el);
    if (style.position !== "static" && style.overflowX !== "visible" && style.overflowY !== "visible") {
      return propertyIsActive(style, "filter") || ["::before", "::after"].some((pseudo) => computedStyle(el, pseudo).position === "fixed");
    }
    return hasPaintOutsideBorderBox(el, style) || markedLayerPaintEscapes(el, style);
  }
  function hasPaintOutsideBorderBox(el, style) {
    return style.textShadow !== "" && style.textShadow !== "none" || pseudoPaintEscapes(el);
  }
  function opaqueGradientDepth(el, height) {
    var _a;
    const positions = opaqueGradientStops(el);
    if (positions === null)
      return null;
    let depth = 0;
    for (const position of positions)
      depth = Math.max(depth, (_a = lengthPercentage(position, height)) !== null && _a !== void 0 ? _a : 0);
    return depth > 0 ? Math.min(depth, height) : null;
  }
  function alphaGradientStops(el, height) {
    var _a, _b, _c, _d, _e, _f;
    if (opaqueGradientDepth(el, height) === null)
      return null;
    const style = computedStyle(el);
    if (style.backgroundOrigin !== "padding-box" || style.backgroundAttachment !== "scroll" || style.backgroundBlendMode !== "normal")
      return null;
    const body = (_a = style.backgroundImage.trim().match(/^linear-gradient\((.*)\)$/)) === null || _a === void 0 ? void 0 : _a[1];
    if (!body)
      return null;
    const parts = topLevelParts(body);
    if (/^(to bottom|180deg)$/.test((_b = parts[0]) !== null && _b !== void 0 ? _b : ""))
      parts.shift();
    const stops = [];
    for (const [index, part] of parts.entries()) {
      const match = part.match(/^([a-z-]+\([^()]*\)|#[\da-f]+|[a-z]+)(?:\s+(.+))?$/i);
      if (!match)
        return null;
      const position = match[2] === void 0 ? index === 0 ? 0 : index === parts.length - 1 ? height : null : lengthPercentage(match[2], height);
      if (position === null || position < 0 || position > height || position / height < ((_d = (_c = stops[stops.length - 1]) === null || _c === void 0 ? void 0 : _c.offset) !== null && _d !== void 0 ? _d : 0))
        return null;
      stops.push({ color: match[1], offset: position / height });
    }
    if (((_e = stops[0]) === null || _e === void 0 ? void 0 : _e.offset) > 0)
      stops.unshift(Object.assign(Object.assign({}, stops[0]), { offset: 0 }));
    if (((_f = stops[stops.length - 1]) === null || _f === void 0 ? void 0 : _f.offset) !== 1 || stops.length < 2 || stops.length > 8)
      return null;
    return stops;
  }
  function opaqueGradientStops(el) {
    var _a, _b;
    const style = computedStyle(el);
    const image = style.backgroundImage.trim();
    const body = topLevelParts(image).length === 1 ? (_a = image.match(/^linear-gradient\((.*)\)$/)) === null || _a === void 0 ? void 0 : _a[1] : void 0;
    if (!body || colorAlpha(style.backgroundColor) !== 0 || backgroundColorClip(style) !== "border-box" || style.backgroundSize.trim() !== "auto" || !["0% 0%", "0px 0px", "left top"].includes(style.backgroundPosition.trim()) || [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some((width) => Number.parseFloat(width) !== 0) || hasPaintOutsideBorderBox(el, style)) {
      return null;
    }
    const stops = topLevelParts(body);
    if (/^(to bottom|180deg)$/.test((_b = stops[0]) !== null && _b !== void 0 ? _b : ""))
      stops.shift();
    const positions = [];
    for (const stop of stops) {
      const match = stop.match(/^([a-z-]+\([^()]*\)|#[\da-f]+|[a-z]+)(?:\s+(.+))?$/i);
      if (!match || colorAlpha(match[1]) !== 1)
        break;
      if (match[2] === void 0)
        continue;
      if (lengthPercentage(match[2], 100) === null)
        return null;
      positions.push(match[2]);
    }
    return positions.length > 0 ? positions : null;
  }
  function topLevelParts(value) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index++) {
      const character = value[index];
      if (character === "(")
        depth++;
      else if (character === ")")
        depth--;
      else if (character === "," && depth === 0) {
        parts.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
    parts.push(value.slice(start).trim());
    return parts;
  }
  function lengthPercentage(value, basis) {
    const term = (text) => {
      const parsed = text.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(px|%)$/);
      if (!parsed)
        return null;
      const amount = Number.parseFloat(parsed[1]);
      return parsed[2] === "%" ? amount / 100 * basis : amount;
    };
    const sum = value.trim().match(/^calc\((\S+)\s+([+-])\s+(\S+)\)$/);
    if (!sum)
      return term(value.trim());
    const left = term(sum[1]);
    const right = term(sum[3]);
    if (left === null || right === null)
      return null;
    return sum[2] === "+" ? left + right : left - right;
  }
  function pseudoPaintEscapes(el) {
    return ["::before", "::after"].some((pseudo) => {
      var _a;
      const style = computedStyle(el, pseudo);
      if (!pseudoPaints(style))
        return false;
      const margins = [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft];
      return (style.position || "static") !== "static" || ((_a = style.display) !== null && _a !== void 0 ? _a : "").includes("list-item") || margins.some((margin) => Number.parseFloat(margin !== null && margin !== void 0 ? margin : "") < 0) || propertyIsActive(style, "transform") || propertyIsActive(style, "translate") || propertyIsActive(style, "filter") || style.textShadow !== void 0 && style.textShadow !== "" && style.textShadow !== "none" || hasOuterDecoration(style);
    });
  }
  function automaticWebLayerCutoutIssue(el, modeledScrollContainer = null, allowViewportPosition = false, requireOpaqueBox = false, followSticky = false) {
    const style = computedStyle(el);
    const alpha = colorAlpha(style.backgroundColor);
    const hasImage = style.backgroundImage !== "" && style.backgroundImage !== "none";
    if ((alpha === 0 || alpha === null) && !hasImage && !hasSparsePaint(el, style))
      return void 0;
    const opaqueBorderBox = alpha === 1 && backgroundColorClip(style) === "border-box";
    if (requireOpaqueBox && (!opaqueBorderBox || hasPaintOutsideBorderBox(el, style))) {
      const opaqueGradient = !opaqueBorderBox && opaqueGradientStops(el) !== null && auditWebLayerCutoutComposition(el, modeledScrollContainer, false, allowViewportPosition, false, followSticky) === null;
      return Object.assign({ reason: "web paint above an overlay island must be fully opaque across its bounded box", mayMoveWithoutRefresh: false }, opaqueGradient ? { opaqueGradient: true } : {});
    }
    if (el.children.length === 0) {
      return auditWebLayerCutoutComposition(el, modeledScrollContainer, false, allowViewportPosition, false, followSticky);
    }
    if (!opaqueBorderBox || hasPaintOutsideBorderBox(el, style)) {
      return {
        reason: "sparse, translucent, or partially painted web content cannot use a box-shaped native cutout",
        mayMoveWithoutRefresh: false
      };
    }
    return auditWebLayerCutoutComposition(el, modeledScrollContainer, false, allowViewportPosition, false, followSticky);
  }
  let geometryFacts = null;
  function geometryFact(check) {
    const value = check();
    geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.push({ check, value });
    return value;
  }
  function recordGeometry(classify) {
    const previous = geometryFacts;
    const facts = [];
    geometryFacts = facts;
    try {
      return { value: classify(), facts };
    } finally {
      geometryFacts = previous;
      previous === null || previous === void 0 ? void 0 : previous.push(...facts);
    }
  }
  function geometryHolds(facts) {
    return facts.every((fact) => fact.check() === fact.value);
  }
  let successfulWebAudits = null;
  let styleMemo = null;
  let readStyles = null;
  let readParents = null;
  let planMemos = null;
  function computedStyle(el, pseudo) {
    var _a, _b;
    const key = pseudo !== null && pseudo !== void 0 ? pseudo : "own";
    const cached = (_a = readStyles === null || readStyles === void 0 ? void 0 : readStyles.get(el)) === null || _a === void 0 ? void 0 : _a[key];
    if (cached)
      return cached;
    let style = pseudo ? void 0 : styleMemo === null || styleMemo === void 0 ? void 0 : styleMemo.get(el);
    if (!style) {
      style = pseudo ? getComputedStyle(el, pseudo) : getComputedStyle(el);
      if (!pseudo)
        styleMemo === null || styleMemo === void 0 ? void 0 : styleMemo.set(el, style);
    }
    if (readStyles) {
      const scope = readStyles;
      style = readPhaseStyle(style, scope);
      const declarations = (_b = scope.get(el)) !== null && _b !== void 0 ? _b : {};
      declarations[key] = style;
      scope.set(el, declarations);
    }
    return style;
  }
  const STYLE_READ = Symbol("styleRead");
  const readPhasePrototype = Object.create(new Proxy({}, {
    get: (_, key, receiver) => {
      const read = receiver[STYLE_READ];
      if (typeof key !== "string")
        return Reflect.get(read.declaration, key, read.declaration);
      Object.defineProperty(readPhasePrototype, key, {
        get() {
          return readStyleValue(this[STYLE_READ], key);
        }
      });
      return readStyleValue(read, key);
    }
  }));
  function readPhaseStyle(declaration, scope) {
    const values = /* @__PURE__ */ new Map();
    const property = (name) => {
      const key = `css:${name}`;
      if (readStyles === scope && values.has(key))
        return values.get(key);
      const value = declaration.getPropertyValue(name);
      if (readStyles === scope)
        values.set(key, value);
      return value;
    };
    const style = Object.create(readPhasePrototype);
    style[STYLE_READ] = { declaration, scope, values, property };
    return style;
  }
  function readStyleValue(read, name) {
    if (name === "getPropertyValue")
      return read.property;
    const remember = readStyles === read.scope;
    if (remember) {
      const value2 = read.values.get(name);
      if (value2 !== void 0 || read.values.has(name))
        return value2;
    }
    const value = Reflect.get(read.declaration, name, read.declaration);
    const bound = typeof value === "function" ? value.bind(read.declaration) : value;
    if (remember)
      read.values.set(name, bound);
    return bound;
  }
  function planMemo$1(name, key, compute) {
    if (!planMemos)
      return compute();
    let memo = planMemos.get(name);
    if (!memo) {
      memo = /* @__PURE__ */ new WeakMap();
      planMemos.set(name, memo);
    }
    if (memo.has(key))
      return memo.get(key);
    const value = compute();
    memo.set(key, value);
    return value;
  }
  function readStyleFact(name, style, read) {
    return readStyles ? planMemo$1(name, style, read) : read();
  }
  function withPlanScope(read) {
    const previous = { styleMemo, planMemos };
    styleMemo = /* @__PURE__ */ new WeakMap();
    planMemos = /* @__PURE__ */ new Map();
    try {
      return read();
    } finally {
      ({ styleMemo, planMemos } = previous);
    }
  }
  function withCompositionReadScope(read) {
    const previous = successfulWebAudits;
    const previousStyles = readStyles;
    const previousParents = readParents;
    successfulWebAudits = /* @__PURE__ */ new WeakMap();
    readStyles = /* @__PURE__ */ new WeakMap();
    readParents = /* @__PURE__ */ new WeakMap();
    try {
      return read();
    } finally {
      successfulWebAudits = previous;
      readStyles = previousStyles;
      readParents = previousParents;
    }
  }
  function toElementArray(value) {
    if (value === null)
      return [];
    return Array.isArray(value) ? value : [value];
  }
  function auditWebLayerCutoutComposition(el, modeledScrollContainers = null, backgroundOnly = false, allowViewportPosition = false, aboveNativeUnderlay = false, followSticky = false, island = null) {
    var _a, _b;
    const containers = toElementArray(modeledScrollContainers);
    const modes = Number(backgroundOnly) | Number(allowViewportPosition) << 1 | Number(aboveNativeUnderlay) << 2 | Number(followSticky) << 3;
    const successful = island === null ? successfulWebAudits === null || successfulWebAudits === void 0 ? void 0 : successfulWebAudits.get(el) : void 0;
    const reused = successful === null || successful === void 0 ? void 0 : successful.find((audit) => audit.modes === modes && audit.containers.length === containers.length && audit.containers.every((container, index) => container === containers[index]));
    if (reused) {
      geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.push(...reused.facts);
      return null;
    }
    const firstFact = (_a = geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.length) !== null && _a !== void 0 ? _a : 0;
    const modeledScrollContainerSet = new Set(containers);
    let clipSource = el;
    let followedSticky = !followSticky;
    let node = el;
    while (node) {
      const style = computedStyle(node);
      const isViewportRoot = isViewportRootElement(node, style);
      const runtimeClip = runtimeOwnsClip(node, style);
      if (style.position === "sticky" && !followedSticky) {
        followedSticky = true;
      } else if (style.position === "sticky" || !allowViewportPosition && style.position === "fixed") {
        return {
          reason: "fixed and sticky web layers cannot use document-space native cutouts",
          mayMoveWithoutRefresh: true
        };
      }
      if (!aboveNativeUnderlay && Number.parseFloat(style.opacity) !== 1 || readStyleFact("webCutoutEffects", style, () => propertyIsActive(style, "filter") || propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter") || (style.getPropertyValue("mix-blend-mode").trim() || "normal") !== "normal") || !runtimeClip && propertyIsActive(style, "clip-path") || !runtimeOwnsMask(node, style) && (propertyIsActive(style, "mask-image") || propertyIsActive(style, "-webkit-mask-image"))) {
        return {
          reason: "translucent, filtered, blended, clipped, or masked web layers cannot use box-shaped native cutouts",
          mayMoveWithoutRefresh: false
        };
      }
      if (readStyleFact("webCutoutTransforms", style, () => {
        const zoom = style.getPropertyValue("zoom").trim();
        return !isAxisAlignedTransform(style.transform) || !isSupportedIndividualTranslate(style) || !isIdentityScale(style) || !isIdentityRotate(style) || hasMotionPath(style) || zoom !== "" && zoom !== "1" && zoom !== "normal";
      })) {
        return {
          reason: "opaque web surface coordinates are unsafe under 3D translation, scale, rotation, skew, perspective, motion paths, or zoom",
          mayMoveWithoutRefresh: false
        };
      }
      if (node === el && !(node === document.documentElement || node === document.body && bodyBackgroundPropagates()) && !backgroundOnly && geometryFact(() => markedLayerPaintEscapes(el, computedStyle(el)))) {
        return {
          reason: "web surfaces with out-of-bounds paint or visible overflow cannot use a box-bounded cutout",
          mayMoveWithoutRefresh: false
        };
      }
      const overflowClips = clips(style);
      const paintContains = clipsThroughPaintContainment(style);
      const modeledScrollClip = modeledScrollContainerSet.has(node) && overflowClips && !paintContains && ["", "0", "0px"].includes(style.getPropertyValue("overflow-clip-margin").trim());
      if (node !== el && !isViewportRoot && !node.hasAttribute("data-ni-root-scroll-owner") && (overflowClips || paintContains) && !modeledScrollClip && !(island !== null && containsComposed(node, island)) && (hasUnsupportedClipEdge(style) || !clipHoldsLayer(node, clipSource))) {
        return {
          reason: `opaque web surface coordinates are unsafe under a partially clipping ${paintContains ? "paint-containment" : "overflow"} ancestor`,
          mayMoveWithoutRefresh: false
        };
      }
      if (modeledScrollContainerSet.has(node))
        clipSource = node;
      node = composedParentElement(node);
    }
    if (successfulWebAudits && island === null) {
      const entry = { containers: [...containers], modes, facts: (_b = geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.slice(firstFact)) !== null && _b !== void 0 ? _b : [] };
      if (successful)
        successful.push(entry);
      else
        successfulWebAudits.set(el, [entry]);
    }
    return null;
  }
  function inheritedOpacity(el, skip = /* @__PURE__ */ new Set()) {
    let opacity = 1;
    for (let node = el; node; node = composedParentElement(node)) {
      if (skip.has(node))
        continue;
      const value = Number.parseFloat(computedStyle(node).opacity);
      if (Number.isFinite(value))
        opacity *= value;
    }
    return opacity;
  }
  function auditIslandComposition(island, el, modeledScrollContainers = null) {
    const modeledScrollContainerSet = new Set(toElementArray(modeledScrollContainers));
    const issues = [];
    const islandRect = readBounds(el);
    let modeledClip = null;
    let modeledPort = null;
    let modeledClipMoves = false;
    let node = el;
    while (node) {
      const style = computedStyle(node);
      const isViewportRoot = isViewportRootElement(node, style);
      const runtimeClip = runtimeOwnsClip(node, style);
      if (!isAxisAlignedTransform(style.transform)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element: label(node),
          message: "scale, rotation, skew, or perspective cannot be replayed by the native host"
        });
        break;
      }
      if (!isSupportedIndividualTranslate(style)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element: label(node),
          message: "three-dimensional CSS translation cannot be replayed by the native host"
        });
        break;
      }
      if (!isIdentityScale(style) || !isIdentityRotate(style)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element: label(node),
          message: "CSS scale and rotation cannot be replayed by the native host"
        });
        break;
      }
      if (hasMotionPath(style)) {
        issues.push({
          code: "non_axis_transform",
          island,
          element: label(node),
          message: "CSS motion paths cannot be replayed by the native host"
        });
        break;
      }
      const zoom = style.getPropertyValue("zoom").trim();
      if (zoom !== "" && zoom !== "1" && zoom !== "normal") {
        issues.push({
          code: "non_axis_transform",
          island,
          element: label(node),
          message: "CSS zoom cannot be replayed by the native host"
        });
        break;
      }
      const opacity = Number.parseFloat(style.opacity);
      if (opacity === 0) {
        issues.push({
          code: "zero_opacity",
          island,
          element: label(node),
          message: "zero-opacity content is not visible"
        });
        break;
      }
      if (propertyIsActive(style, "filter") || node === el && (propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter")) || propertyIsActive(style, "mix-blend-mode", "normal")) {
        issues.push({
          code: "unsupported_visual_effect",
          island,
          element: label(node),
          message: "opacity, filters, blending, and perspective cannot be inherited by the detached native host"
        });
        break;
      }
      const mask = style.maskImage || style.getPropertyValue("-webkit-mask-image");
      if (!runtimeClip && style.clipPath !== "none" || !runtimeOwnsMask(node, style) && mask && mask !== "none") {
        issues.push({
          code: "css_clip_or_mask",
          island,
          element: label(node),
          message: "CSS clip-path and masks are not supported for a native island"
        });
        break;
      }
      const overflowClips = clips(style);
      const paintContains = clipsThroughPaintContainment(style);
      const modeledScrollClip = modeledScrollContainerSet.has(node) && (overflowClips || axisScrolls(style.overflowX) || axisScrolls(style.overflowY)) && !paintContains && ["", "0", "0px"].includes(style.getPropertyValue("overflow-clip-margin").trim());
      if (modeledScrollClip) {
        modeledClip = readBounds(node);
        modeledPort = paddingBox(node);
        modeledClipMoves = false;
      } else if (modeledClip && (style.position === "fixed" || style.position === "sticky")) {
        modeledClipMoves = true;
      }
      if (node !== el && !isViewportRoot && !node.hasAttribute("data-ni-root-router-prototype") && (overflowClips || paintContains) && !modeledScrollClip && (hasUnsupportedClipEdge(style) || !clipOpaqueShapeContains(node, style, islandRect) && !clipsOnlyOffscreen(node, style) && (modeledClipMoves || !modeledClip || !clipOpaqueShapeContains(node, style, modeledClip) && !(modeledPort && roundsScrollport(node, style, modeledPort))))) {
        issues.push({
          code: "overflow_clip",
          island,
          element: label(node),
          message: `native host cannot inherit a partially clipping ${paintContains ? "paint-containment" : "overflow"} ancestor`
        });
        break;
      }
      node = composedParentElement(node);
    }
    return issues;
  }
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
  class IslandLifecycle {
    constructor(firstFrame) {
      this.firstFrame = firstFrame;
      this.state = "pending";
      this.instance = 1;
    }
    /** True when native currently holds (or is creating) the view for this instance. */
    get holdsView() {
      return this.state === "created" || this.state === "drawn";
    }
    /** Applies `event` and returns `false` if the transition is a no-op or invalid. */
    transition(event) {
      const next = this.next(event);
      if (next === null)
        return false;
      if (next === "released" && this.holdsView || event.type === "restarted")
        this.instance += 1;
      this.state = next;
      return true;
    }
    next(event) {
      const { state } = this;
      if (state === "failed")
        return event.type === "restarted" ? "pending" : null;
      switch (event.type) {
        case "sent":
          return state === "pending" || state === "released" ? "staged" : null;
        case "applied":
          if (event.holds)
            return this.holdsView ? null : this.firstFrame ? "created" : "drawn";
          return this.holdsView ? "released" : null;
        case "drawn":
          return state === "created" && event.instance === this.instance ? "drawn" : null;
        case "failed":
          return "failed";
        case "reset":
          return state === "pending" ? null : "released";
        case "restarted":
          return null;
      }
    }
  }
  function createEnvelope() {
    return {};
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
  class NativeIslandError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "NativeIslandError";
    }
  }
  function validateCommand(island, nativeComponent, command, properties) {
    if (!island) {
      throw new NativeIslandError("invalid_request", "Invalid native island id.");
    }
    if (!nativeComponent) {
      throw new NativeIslandError("invalid_request", "Invalid native component name.");
    }
    if (!command) {
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
    try {
      json = JSON.stringify(properties);
    } catch (_a) {
      throw new NativeIslandError("invalid_request", "Native island properties must be JSON-compatible.");
    }
    if (json === void 0) {
      throw new NativeIslandError("invalid_request", "Native island properties must be JSON-compatible.");
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
  const NAMED_EASINGS = {
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1]
  };
  function parseEasing(value) {
    var _a;
    const easing = (value !== null && value !== void 0 ? value : "linear").trim().toLowerCase();
    if (easing === "linear" || easing === "")
      return void 0;
    const named = NAMED_EASINGS[easing];
    if (named)
      return { bezier: named };
    if (easing === "step-start")
      return { steps: 1, jump: "start" };
    if (easing === "step-end")
      return { steps: 1, jump: "end" };
    const call2 = /^([a-z-]+)\((.*)\)$/.exec(easing);
    if (!call2)
      return null;
    const args = call2[2].split(",").map((arg) => arg.trim());
    if (call2[1] === "cubic-bezier") {
      const points = args.map(Number);
      if (points.length !== 4 || !points.every(Number.isFinite) || points[0] < 0 || points[0] > 1)
        return null;
      if (points[2] < 0 || points[2] > 1)
        return null;
      return { bezier: [points[0], points[1], points[2], points[3]] };
    }
    if (call2[1] === "steps") {
      const steps = Number(args[0]);
      const position = (_a = args[1]) !== null && _a !== void 0 ? _a : "end";
      const jump = {
        start: "start",
        "jump-start": "start",
        end: "end",
        "jump-end": "end",
        "jump-none": "none",
        "jump-both": "both"
      }[position];
      if (!Number.isInteger(steps) || steps < (jump === "none" ? 2 : 1) || !jump || args.length > 2)
        return null;
      return { steps, jump };
    }
    if (call2[1] === "linear")
      return linearStops(args);
    return null;
  }
  function linearStops(args) {
    var _a, _b;
    var _c, _d;
    const stops = [];
    for (const arg of args) {
      const parts = arg.split(/\s+/);
      const output = Number(parts[0]);
      if (!Number.isFinite(output) || parts.length > 3)
        return null;
      const inputs = parts.slice(1).map((part) => part.endsWith("%") ? Number(part.slice(0, -1)) / 100 : Number.NaN);
      if (!inputs.every(Number.isFinite))
        return null;
      if (inputs.length === 0)
        stops.push({ output, input: null });
      for (const input of inputs)
        stops.push({ output, input });
    }
    if (stops.length < 2)
      return null;
    (_a = (_c = stops[0]).input) !== null && _a !== void 0 ? _a : _c.input = 0;
    (_b = (_d = stops[stops.length - 1]).input) !== null && _b !== void 0 ? _b : _d.input = 1;
    let largest = -Infinity;
    for (const stop of stops) {
      if (stop.input === null)
        continue;
      stop.input = Math.max(stop.input, largest);
      largest = stop.input;
    }
    for (let index = 1; index < stops.length; index++) {
      if (stops[index].input !== null)
        continue;
      let next = index;
      while (stops[next].input === null)
        next++;
      const from = stops[index - 1].input;
      const to = stops[next].input;
      for (let gap = index; gap < next; gap++) {
        stops[gap].input = from + (to - from) * (gap - index + 1) / (next - index + 1);
      }
    }
    return { points: stops.flatMap((stop) => [round4(stop.input), round4(stop.output)]) };
  }
  function round4(value) {
    return Math.round(value * 1e4) / 1e4;
  }
  function parseLength(value, pxScale) {
    const tokens = value.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?(?:px|rem|%)?|[()+\-*/]|calc\(|[a-z-]+\(|\S/gi);
    if (!tokens)
      return null;
    let index = 0;
    const expression = () => {
      let left = term();
      while (left && (tokens[index] === "+" || tokens[index] === "-")) {
        const sign = tokens[index++] === "+" ? 1 : -1;
        const right = term();
        if (!right || right.number !== left.number)
          return null;
        left = { px: left.px + sign * right.px, fraction: left.fraction + sign * right.fraction, number: left.number };
      }
      return left;
    };
    const term = () => {
      let left = factor();
      while (left && (tokens[index] === "*" || tokens[index] === "/")) {
        const operator = tokens[index++];
        const right = factor();
        if (!right)
          return null;
        if (operator === "/") {
          if (!right.number || right.px === 0)
            return null;
          left = { px: left.px / right.px, fraction: left.fraction / right.px, number: left.number };
        } else if (right.number) {
          left = { px: left.px * right.px, fraction: left.fraction * right.px, number: left.number };
        } else if (left.number) {
          left = { px: right.px * left.px, fraction: right.fraction * left.px, number: false };
        } else {
          return null;
        }
      }
      return left;
    };
    const factor = () => {
      const token = tokens[index++];
      if (token === void 0)
        return null;
      if (token === "(" || token.toLowerCase() === "calc(") {
        const inner = expression();
        return tokens[index++] === ")" ? inner : null;
      }
      if (token === "-" && tokens[index] !== void 0) {
        const negated = factor();
        return negated && { px: -negated.px, fraction: -negated.fraction, number: negated.number };
      }
      const number = Number.parseFloat(token);
      if (!Number.isFinite(number))
        return null;
      if (token.endsWith("%"))
        return { px: 0, fraction: number / 100, number: false };
      if (token.toLowerCase().endsWith("px"))
        return { px: number * pxScale, fraction: 0, number: false };
      if (token.toLowerCase().endsWith("rem")) {
        const fontSize = Number.parseFloat(computedStyle(document.documentElement).fontSize);
        return Number.isFinite(fontSize) ? { px: number * fontSize, fraction: 0, number: false } : null;
      }
      return { px: number, fraction: 0, number: true };
    };
    const result = expression();
    if (!result || index !== tokens.length)
      return null;
    if (result.number && result.px !== 0)
      return null;
    return { px: result.px, fraction: result.fraction };
  }
  function splitTopLevel(value, separator) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const character of value) {
      if (character === "(")
        depth++;
      if (character === ")")
        depth--;
      if (depth === 0 && separator.test(character)) {
        parts.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }
    parts.push(current.trim());
    return parts.filter(Boolean);
  }
  function translationOf(value, property, width, height, pxScale = 1) {
    const text = value.trim();
    if (text === "" || text === "none")
      return { x: 0, y: 0 };
    const resolve = (length, size) => {
      if (length === void 0)
        return 0;
      const parsed = parseLength(length, pxScale);
      return parsed && parsed.px + parsed.fraction * size;
    };
    if (property === "translate") {
      const parts = splitTopLevel(text, /\s/);
      if (parts.length > 3)
        return null;
      const x2 = resolve(parts[0], width);
      const y2 = resolve(parts[1], height);
      const z = parts[2] === void 0 ? 0 : resolve(parts[2], 0);
      return x2 === null || y2 === null || z === null ? null : { x: x2, y: y2 };
    }
    let x = 0;
    let y = 0;
    const functions = /([a-z0-9]+)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/gi;
    let consumed = 0;
    for (let match = functions.exec(text); match; match = functions.exec(text)) {
      if (text.slice(consumed, match.index).trim() !== "")
        return null;
      consumed = match.index + match[0].length;
      const name = match[1].toLowerCase();
      const args = splitTopLevel(match[2], /,/);
      let dx = 0;
      let dy = 0;
      if (name === "translate" && args.length <= 2) {
        dx = resolve(args[0], width);
        dy = resolve(args[1], height);
      } else if (name === "translatex" && args.length === 1) {
        dx = resolve(args[0], width);
      } else if (name === "translatey" && args.length === 1) {
        dy = resolve(args[0], height);
      } else if (name === "translatez" && args.length === 1) {
        if (resolve(args[0], 0) === null)
          return null;
      } else if (name === "translate3d" && args.length === 3) {
        dx = resolve(args[0], width);
        dy = resolve(args[1], height);
        if (resolve(args[2], 0) === null)
          return null;
      } else if (name === "matrix" || name === "matrix3d") {
        const values = args.map(Number);
        const identity = name === "matrix" ? [1, 0, 0, 1] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
        const linear = name === "matrix" ? values.slice(0, 4) : values.slice(0, 12);
        if (values.length !== (name === "matrix" ? 6 : 16) || !values.every(Number.isFinite))
          return null;
        if (linear.some((entry, entryIndex) => Math.abs(entry - identity[entryIndex]) > 1e-6))
          return null;
        if (name === "matrix3d" && Math.abs(values[15] - 1) > 1e-6)
          return null;
        dx = (name === "matrix" ? values[4] : values[12]) * pxScale;
        dy = (name === "matrix" ? values[5] : values[13]) * pxScale;
      } else {
        return null;
      }
      if (dx === null || dy === null)
        return null;
      x += dx;
      y += dy;
    }
    if (text.slice(consumed).trim() !== "" || consumed === 0)
      return null;
    return { x, y };
  }
  let lengthZoom = null;
  function transitionLengthZoom() {
    var _a, _b, _c, _d;
    if ((lengthZoom === null || lengthZoom === void 0 ? void 0 : lengthZoom.document) === document)
      return lengthZoom.zoom;
    let zoom = 1;
    let probe = null;
    try {
      probe = document.createElement("div");
      probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;transition:transform 1000s linear";
      ((_a = document.body) !== null && _a !== void 0 ? _a : document.documentElement).append(probe);
      void getComputedStyle(probe).transform;
      probe.style.transform = "translateX(100px)";
      const transition = probe.getAnimations().find((animation) => animation.transitionProperty === "transform");
      const keyframes = (_c = (_b = transition === null || transition === void 0 ? void 0 : transition.effect) === null || _b === void 0 ? void 0 : _b.getKeyframes()) !== null && _c !== void 0 ? _c : [];
      const to = (_d = keyframes[keyframes.length - 1]) === null || _d === void 0 ? void 0 : _d.transform;
      const read = typeof to === "string" ? translationOf(to, "transform", 1, 1) : null;
      if (read && read.x > 0)
        zoom = round4(read.x / 100);
      transition === null || transition === void 0 ? void 0 : transition.cancel();
    } catch (_e) {
      zoom = 1;
    } finally {
      probe === null || probe === void 0 ? void 0 : probe.remove();
    }
    lengthZoom = { document, zoom };
    return zoom;
  }
  const IGNORED_KEYFRAME_FIELDS = /* @__PURE__ */ new Set(["offset", "computedOffset", "easing", "composite"]);
  function describeMotion(element, animations, captureGeometry = false) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (animations.length === 0)
      return null;
    const rect = element.getBoundingClientRect();
    const html = element instanceof HTMLElement ? element : null;
    const scaled = (drawn, laid) => laid === void 0 || laid <= 0 || Math.abs(drawn - laid) <= 1 ? { size: drawn, scale: 1 } : { size: laid, scale: drawn / laid };
    const horizontal = scaled(rect.width, html === null || html === void 0 ? void 0 : html.offsetWidth);
    const vertical = scaled(rect.height, html === null || html === void 0 ? void 0 : html.offsetHeight);
    const entries = [];
    const channels = /* @__PURE__ */ new Set();
    let transformProperty = null;
    for (const animation of animations) {
      const effect = animation.effect;
      if (!effect || typeof effect.getKeyframes !== "function" || typeof effect.getComputedTiming !== "function") {
        return null;
      }
      if (effect.pseudoElement || effect.composite !== void 0 && effect.composite !== "replace")
        return null;
      const timing = effect.getComputedTiming();
      const effectEasing = parseEasing(typeof timing.easing === "string" ? timing.easing : void 0);
      const duration = typeof timing.duration === "number" ? timing.duration : Number.NaN;
      const iterations = (_a = timing.iterations) !== null && _a !== void 0 ? _a : 1;
      const delay = (_b = timing.delay) !== null && _b !== void 0 ? _b : 0;
      const fill = timing.fill === "auto" || timing.fill === void 0 ? "none" : timing.fill;
      const currentTime = typeof animation.currentTime === "number" ? animation.currentTime : 0;
      if (effectEasing === null || !Number.isFinite(duration) || duration <= 0 || !(iterations >= 0))
        return null;
      if (!Number.isFinite(animation.playbackRate) || animation.playbackRate === 0)
        return null;
      const roundedStart = delay === 0 && currentTime < 0 && currentTime >= -0.5 && ((_c = timing.direction) !== null && _c !== void 0 ? _c : "normal") === "normal" && !((_d = timing.iterationStart) !== null && _d !== void 0 ? _d : 0);
      if (currentTime < delay && fill !== "backwards" && fill !== "both" && !roundedStart)
        return null;
      const transition = typeof animation.transitionProperty === "string";
      const pxScale = transition ? 1 / transitionLengthZoom() : 1;
      const perChannel = /* @__PURE__ */ new Map();
      for (const keyframe of effect.getKeyframes()) {
        const offset = (_e = keyframe.computedOffset) !== null && _e !== void 0 ? _e : keyframe.offset;
        if (typeof offset !== "number" || !Number.isFinite(offset))
          return null;
        if (keyframe.composite !== void 0 && keyframe.composite !== "auto" && keyframe.composite !== "replace") {
          return null;
        }
        const easing = parseEasing(typeof keyframe.easing === "string" ? keyframe.easing : void 0);
        if (easing === null)
          return null;
        for (const [name, raw] of Object.entries(keyframe)) {
          if (IGNORED_KEYFRAME_FIELDS.has(name))
            continue;
          const value = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null;
          if (value === null)
            return null;
          let channel;
          let point;
          if (name === "transform" || name === "translate") {
            if (transformProperty !== null && transformProperty !== name)
              return null;
            transformProperty = name;
            const translation = translationOf(value, name, horizontal.size, vertical.size, pxScale);
            if (!translation)
              return null;
            channel = "translate";
            point = [round4(translation.x * horizontal.scale), round4(translation.y * vertical.scale)];
          } else if (name === "visibility") {
            continue;
          } else if (name === "opacity") {
            const opacity = Number.parseFloat(value);
            if (!Number.isFinite(opacity))
              return null;
            channel = "opacity";
            point = [round4(Math.min(1, Math.max(0, opacity)))];
          } else {
            return null;
          }
          const list = (_f = perChannel.get(channel)) !== null && _f !== void 0 ? _f : [];
          list.push(Object.assign({ offset: round4(offset), value: point }, easing ? { easing } : {}));
          perChannel.set(channel, list);
        }
      }
      for (const [channel, frames] of perChannel) {
        if (channels.has(channel))
          return null;
        if (frames[0].offset !== 0 || frames[frames.length - 1].offset !== 1)
          return null;
        channels.add(channel);
        const property = channel === "translate" ? transformProperty : null;
        const measured = property && (captureGeometry || roundedStart) ? translationOf(computedStyle(element).getPropertyValue(property), property, horizontal.size, vertical.size) : null;
        const anchored = measured && !((_g = timing.iterationStart) !== null && _g !== void 0 ? _g : 0) && (timing.direction === void 0 || timing.direction === "normal" || timing.direction === "alternate");
        const point = anchored ? { x: frames[0].value[0] / horizontal.scale, y: frames[0].value[1] / vertical.scale } : measured;
        entries.push(Object.assign(Object.assign({ animation, measuredAt: performance.now() }, property && point ? {
          translation: Object.assign(Object.assign({ anchored: !!anchored, property }, point), { width: horizontal.size, height: vertical.size, scaleX: horizontal.scale, scaleY: vertical.scale })
        } : {}), { payload: Object.assign(Object.assign({ channel, keyframes: frames }, effectEasing ? { easing: effectEasing } : {}), { delay: round4(delay), endDelay: round4((_h = timing.endDelay) !== null && _h !== void 0 ? _h : 0), duration: round4(duration), iterations: Number.isFinite(iterations) ? iterations : null, iterationStart: (_j = timing.iterationStart) !== null && _j !== void 0 ? _j : 0, direction: (_k = timing.direction) !== null && _k !== void 0 ? _k : "normal", fill, startTime: typeof animation.startTime === "number" ? round4(animation.startTime) : 0, playbackRate: animation.playbackRate, sampledTime: anchored ? 0 : round4(currentTime) }) }));
      }
    }
    if (entries.length === 0)
      return null;
    if (channels.has("opacity") && html && html.children.length > 0 && Number.parseFloat(computedStyle(html).opacity) === 0) {
      return null;
    }
    return entries;
  }
  function startMotionAt(animations, at) {
    var _a;
    for (const animation of animations) {
      if (animation.playState !== "running")
        continue;
      try {
        const effect = animation.effect;
        const timing = (_a = effect === null || effect === void 0 ? void 0 : effect.getTiming) === null || _a === void 0 ? void 0 : _a.call(effect);
        if (effect && timing && !timing.delay && (timing.fill === "none" || timing.fill === "forwards" || timing.fill === "auto")) {
          effect.updateTiming({ fill: timing.fill === "forwards" ? "both" : "backwards" });
        }
        animation.startTime = at;
      } catch (_b) {
      }
    }
  }
  function startsThisFrame(animation, frame, fresh) {
    if (animation.pending && animation.startTime === null)
      return true;
    return fresh && frame !== null && typeof animation.startTime === "number" && Math.abs(animation.startTime - frame) < 0.5;
  }
  function motionStartTime(earliest, frameTime, frameInterval) {
    if (frameTime === null || !Number.isFinite(frameTime) || frameTime > earliest || !(frameInterval > 0)) {
      return earliest;
    }
    return frameTime + Math.ceil((earliest - frameTime) / frameInterval) * frameInterval;
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
      // Same notion of scrollable as discovery, so a pane the carrier cannot
      // route horizontally cannot reach it by being discovered some other way.
      horizontal: element.scrollWidth > element.clientWidth && axisScrolls(style.overflowX)
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
        if (document.head) {
          document.head.append(this.ownerStyle);
        } else {
          const ownerStyle = this.ownerStyle;
          document.addEventListener("DOMContentLoaded", () => {
            var _a2;
            return (_a2 = document.head) === null || _a2 === void 0 ? void 0 : _a2.append(ownerStyle);
          }, { once: true });
        }
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
      if (document.head) {
        document.head.append(this.carrierStyle);
      } else {
        const carrierStyle = this.carrierStyle;
        document.addEventListener("DOMContentLoaded", () => {
          var _a;
          return (_a = document.head) === null || _a === void 0 ? void 0 : _a.append(carrierStyle);
        }, { once: true });
      }
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
  let planMemo = null;
  let topLayerRoots = () => [document];
  function setTopLayerRoots(roots) {
    topLayerRoots = roots;
  }
  function queryState(root, selector) {
    if (typeof root.querySelector !== "function")
      return null;
    try {
      return root.querySelector(selector) !== null;
    } catch (_a) {
      return false;
    }
  }
  function anyTopLayerOpen() {
    if (document.fullscreenElement)
      return true;
    for (const root of topLayerRoots()) {
      for (const state of [":modal", ":popover-open"]) {
        const found = queryState(root, state);
        if (found !== false)
          return true;
      }
    }
    return false;
  }
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
    var _a;
    if (planMemo) {
      (_a = planMemo.topLayerOpen) !== null && _a !== void 0 ? _a : planMemo.topLayerOpen = anyTopLayerOpen();
      if (!planMemo.topLayerOpen)
        return null;
    }
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
    if (planMemo)
      planMemo = { order: /* @__PURE__ */ new WeakMap(), level: /* @__PURE__ */ new WeakMap(), phase: /* @__PURE__ */ new WeakMap(), topLayer: /* @__PURE__ */ new WeakMap() };
  }
  function withPaintOrderScope(read) {
    const previous = planMemo;
    resetPaintOrderCache();
    planMemo = { order: /* @__PURE__ */ new WeakMap(), level: /* @__PURE__ */ new WeakMap(), phase: /* @__PURE__ */ new WeakMap(), topLayer: /* @__PURE__ */ new WeakMap() };
    try {
      return read();
    } finally {
      planMemo = previous;
    }
  }
  function remembered(memo, key, compute) {
    if (!memo)
      return compute();
    if (memo.has(key))
      return memo.get(key);
    const value = compute();
    memo.set(key, value);
    return value;
  }
  function isFlexOrGridItem(el) {
    const parent = composedParentElement(el);
    if (!parent)
      return false;
    const display = computedStyle(parent).display;
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
      const cs = computedStyle(el);
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
  function isComposedAncestorOf(ancestor, element) {
    for (let current = composedParentElement(element); current; current = composedParentElement(current)) {
      if (current === ancestor)
        return true;
    }
    return false;
  }
  function paintsBelowAncestor(descendant, ancestor) {
    if (establishesStackingContext(ancestor))
      return false;
    let participant = descendant;
    let context = nearestContext(descendant);
    while (context && context !== ancestor && isComposedAncestorOf(ancestor, context)) {
      participant = context;
      context = nearestContext(context);
    }
    return stackLevel(participant) < 0;
  }
  function stackLevel(el) {
    return remembered(planMemo === null || planMemo === void 0 ? void 0 : planMemo.level, el, () => {
      const cs = computedStyle(el);
      if (hasEffectiveZIndex(el, cs)) {
        const z = parseInt(cs.zIndex, 10);
        if (!Number.isNaN(z))
          return z;
      }
      return 0;
    });
  }
  function paintPhase(el) {
    return remembered(planMemo === null || planMemo === void 0 ? void 0 : planMemo.phase, el, () => {
      const cs = computedStyle(el);
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
    });
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
    const commonDisplay = computedStyle(common).display;
    if (/^(?:inline-)?(?:flex|grid)$/.test(commonDisplay)) {
      const orderA = Number.parseInt(computedStyle(branchA).order, 10) || 0;
      const orderB = Number.parseInt(computedStyle(branchB).order, 10) || 0;
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
    const memo = planMemo === null || planMemo === void 0 ? void 0 : planMemo.order;
    const known = (_a = memo === null || memo === void 0 ? void 0 : memo.get(a)) === null || _a === void 0 ? void 0 : _a.get(b);
    if (known !== void 0)
      return known;
    const order = paintOrder(a, b);
    if (memo) {
      for (const [first, second, value] of [
        [a, b, order],
        [b, a, -order]
      ]) {
        const row = (_b = memo.get(first)) !== null && _b !== void 0 ? _b : /* @__PURE__ */ new Map();
        row.set(second, value);
        memo.set(first, row);
      }
    }
    return order;
  }
  function paintOrder(a, b) {
    var _a, _b;
    const topA = remembered(planMemo === null || planMemo === void 0 ? void 0 : planMemo.topLayer, a, () => activeTopLayerAncestor(a));
    const topB = remembered(planMemo === null || planMemo === void 0 ? void 0 : planMemo.topLayer, b, () => activeTopLayerAncestor(b));
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
    if (isComposedAncestorOf(a, b))
      return paintsBelowAncestor(b, a) ? 1 : -1;
    if (isComposedAncestorOf(b, a))
      return paintsBelowAncestor(a, b) ? -1 : 1;
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
  class StyleScope {
    constructor(hasShadowRoots = () => false) {
      this.hasShadowRoots = hasShadowRoots;
      this.sheets = [];
      this.nonLocal = [];
      this.subjects = [];
      this.containerRules = [];
      this.stateAnchors = "";
      this.matches = /* @__PURE__ */ new Map();
      this.containers = /* @__PURE__ */ new Map();
      this.stale = true;
      this.indexed = false;
      this.whole = false;
      this.changed = false;
      this.inputs = /* @__PURE__ */ new Map();
      this.touched = emptyTouched();
    }
    get scoped() {
      return !this.stale && this.whole && !this.hasShadowRoots();
    }
    invalidateIndex() {
      this.stale = true;
    }
    /**
     * Records a DOM mutation since the last `collect()`. Attribute-only mutations
     * are filtered against the attributes and classes each rule actually reads;
     * structural mutations test all indexed rules.
     */
    noteChange(records) {
      this.changed = true;
      if (!this.touched)
        return;
      if (!records) {
        this.touched = null;
        return;
      }
      for (const record of records) {
        const target = record.target;
        const name = record.attributeName;
        if (record.type !== "attributes" || !name || typeof target.getAttribute !== "function") {
          this.touched = null;
          return;
        }
        if (name === "class") {
          const before = classTokens(record.oldValue);
          const now = classTokens(target.getAttribute("class"));
          for (const token of before)
            if (!now.has(token))
              this.touched.classes.add(token);
          for (const token of now)
            if (!before.has(token))
              this.touched.classes.add(token);
        } else if (name === "style") {
          this.touched.style = true;
        } else {
          this.touched.attributes.add(name.toLowerCase());
        }
      }
    }
    /**
     * Returns elements whose subtrees may have been restyled by an indexed rule
     * or container resize since the last call, or `'all'` if stylesheets changed.
     */
    collect() {
      var _a;
      if (!this.stale && this.sheetsChanged())
        this.stale = true;
      if (this.stale) {
        const first = !this.indexed;
        this.indexed = true;
        this.rebuild();
        if (this.whole)
          this.snapshot();
        this.changed = false;
        this.touched = emptyTouched();
        return first ? [] : "all";
      }
      if (!this.scoped) {
        if (this.changed)
          this.touched = null;
        return [];
      }
      const roots = [];
      if (this.changed) {
        this.changed = false;
        const touched = this.touched;
        this.touched = emptyTouched();
        const compare = (selector) => {
          var _a2;
          const now = new Set(queryAll(selector));
          const before = (_a2 = this.matches.get(selector)) !== null && _a2 !== void 0 ? _a2 : NONE;
          for (const element of now)
            if (!before.has(element))
              roots.push(element);
          for (const element of before)
            if (!now.has(element) && element.isConnected)
              roots.push(element);
          this.matches.set(selector, now);
        };
        let unmatched = [];
        const compareUnmatched = () => {
          if (unmatched.length > 1 && queryNone(unmatched.join(", ")))
            unmatched = [];
          for (const selector of unmatched)
            compare(selector);
          unmatched = [];
        };
        for (const selector of this.nonLocal) {
          if (touched && !reads(this.inputs.get(selector), touched))
            continue;
          if (((_a = this.matches.get(selector)) !== null && _a !== void 0 ? _a : NONE).size > 0) {
            compare(selector);
            continue;
          }
          unmatched.push(selector);
          if (unmatched.length === UNMATCHED_BATCH)
            compareUnmatched();
        }
        compareUnmatched();
        for (const subject of this.subjects)
          roots.push(...queryAll(subject));
        this.findContainers();
      }
      for (const [container, watched] of this.containers) {
        if (!container.isConnected) {
          this.containers.delete(container);
          continue;
        }
        const now = sizeKey(container, watched.type);
        if (now === watched.size)
          continue;
        watched.size = now;
        roots.push(container);
      }
      return roots;
    }
    rebuild() {
      var _a;
      this.stale = false;
      this.whole = false;
      this.nonLocal = [];
      this.subjects = [];
      this.containerRules = [];
      this.stateAnchors = "";
      this.matches.clear();
      this.containers.clear();
      this.inputs.clear();
      if (typeof document === "undefined" || !document.styleSheets)
        return;
      const sheets = [
        ...Array.from(document.styleSheets),
        ...(_a = document.adoptedStyleSheets) !== null && _a !== void 0 ? _a : []
      ];
      this.sheets = sheets;
      const nonLocal = /* @__PURE__ */ new Set();
      const subjects = /* @__PURE__ */ new Set();
      const containerRules = /* @__PURE__ */ new Set();
      const stateAnchors = /* @__PURE__ */ new Set();
      const walk = (rules, inContainer) => {
        var _a2, _b;
        for (const rule of Array.from(rules)) {
          const style = rule;
          if (typeof style.selectorText === "string") {
            if (style.cssRules && !Array.from(style.cssRules).every(onlyDeclarations))
              return false;
            for (const selector of splitSelectorList(style.selectorText)) {
              const queried = withoutPseudoElements(selector);
              if (queried === "")
                continue;
              if (inContainer)
                containerRules.add(queried);
              for (const anchor of stateAnchorsOf(queried))
                stateAnchors.add(queryable(anchor) ? anchor : "*");
              if (!isNonLocal(selector))
                continue;
              if (queryable(queried))
                nonLocal.add(queried);
              else {
                const subject = withoutPseudoClasses(lastCompound(queried));
                if (!queryable(subject))
                  return false;
                subjects.add(subject);
              }
            }
            continue;
          }
          const name = (_b = (_a2 = rule.constructor) === null || _a2 === void 0 ? void 0 : _a2.name) !== null && _b !== void 0 ? _b : "";
          if (name === "CSSScopeRule")
            return false;
          const imported = rule.styleSheet;
          if (imported) {
            let inner;
            try {
              inner = imported.cssRules;
            } catch (_c) {
              return false;
            }
            if (!walk(inner, inContainer))
              return false;
            continue;
          }
          const grouped = rule.cssRules;
          if (grouped && !walk(grouped, inContainer || name === "CSSContainerRule"))
            return false;
        }
        return true;
      };
      for (const sheet of sheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch (_b) {
          return;
        }
        if (!walk(rules, false))
          return;
      }
      this.nonLocal = [...nonLocal];
      for (const selector of nonLocal)
        this.inputs.set(selector, selectorInputs(selector));
      this.subjects = [...subjects];
      this.containerRules = [...containerRules];
      this.stateAnchors = [...stateAnchors].join(", ");
      this.whole = true;
    }
    /**
     * Returns elements and subtrees that may be restyled by an interaction state
     * change (`:hover`, `:active`, `:focus`, `:checked`) at `target`, or `'all'`
     * when stylesheets are not fully indexed.
     */
    stateReach(target) {
      var _a;
      if (!this.scoped || this.sheetsChanged())
        return "all";
      const own = [];
      const subtrees = [];
      try {
        for (let node = target; node; node = node.parentElement) {
          own.push(node);
          if (this.stateAnchors !== "" && node.matches(this.stateAnchors))
            subtrees.push((_a = node.parentElement) !== null && _a !== void 0 ? _a : node);
        }
      } catch (_b) {
        return "all";
      }
      return { own, subtrees };
    }
    sheetsChanged() {
      var _a;
      if (typeof document === "undefined" || !document.styleSheets)
        return false;
      const current = [
        ...Array.from(document.styleSheets),
        ...(_a = document.adoptedStyleSheets) !== null && _a !== void 0 ? _a : []
      ];
      return current.length !== this.sheets.length || current.some((sheet, index) => sheet !== this.sheets[index]);
    }
    snapshot() {
      for (const selector of this.nonLocal)
        this.matches.set(selector, new Set(queryAll(selector)));
      this.findContainers();
    }
    findContainers() {
      const found = /* @__PURE__ */ new Map();
      const visited = /* @__PURE__ */ new Set();
      for (const selector of this.containerRules) {
        for (const element of queryAll(selector)) {
          for (let node = element.parentElement; node; node = node.parentElement) {
            if (visited.has(node))
              break;
            visited.add(node);
            const style = computedStyle(node);
            const type = style.getPropertyValue("container-type").trim();
            if (type === "" || type === "normal")
              continue;
            const vertical = /^vertical|^sideways/.test(style.getPropertyValue("writing-mode").trim());
            found.set(node, `${type}${vertical ? " vertical" : ""}`);
          }
        }
      }
      for (const container of this.containers.keys())
        if (!found.has(container))
          this.containers.delete(container);
      for (const [container, type] of found) {
        if (!this.containers.has(container))
          this.containers.set(container, { type, size: sizeKey(container, type) });
      }
    }
  }
  function emptyTouched() {
    return { classes: /* @__PURE__ */ new Set(), attributes: /* @__PURE__ */ new Set(), style: false };
  }
  function classTokens(value) {
    return new Set((value !== null && value !== void 0 ? value : "").split(/\s+/).filter(Boolean));
  }
  const STRUCTURAL = /* @__PURE__ */ new Set([
    "has",
    "not",
    "is",
    "where",
    "matches",
    "nth-child",
    "nth-last-child",
    "nth-of-type",
    "nth-last-of-type",
    "first-child",
    "last-child",
    "only-child",
    "first-of-type",
    "last-of-type",
    "only-of-type",
    "empty",
    "root"
  ]);
  function selectorInputs(selector) {
    var _a, _b;
    if (selector.includes("\\"))
      return null;
    const unquoted = selector.replace(/"[^"]*"|'[^']*'/g, '""');
    const attributes = /* @__PURE__ */ new Set();
    let readable = true;
    const text = unquoted.replace(/\[[^\]]*\]/g, (bracket) => {
      var _a2;
      const name = (_a2 = /^\[\s*(?:[\w*-]*\|)?([\w-]+)\s*(?:[~|^$*]?=|\])/.exec(bracket)) === null || _a2 === void 0 ? void 0 : _a2[1];
      if (name)
        attributes.add(name.toLowerCase());
      else
        readable = false;
      return "[]";
    }).replace(/::[\w-]+/g, "");
    if (!readable)
      return null;
    if (text.includes("#"))
      attributes.add("id");
    const classes = /* @__PURE__ */ new Set();
    for (const name of (_a = text.match(/\.[^\s.#:[\]()>+~,*]+/g)) !== null && _a !== void 0 ? _a : [])
      classes.add(name.slice(1));
    let state = false;
    let focus = false;
    for (const name of (_b = text.match(/:[\w-]+/g)) !== null && _b !== void 0 ? _b : []) {
      const pseudo = name.slice(1).toLowerCase();
      if (STRUCTURAL.has(pseudo))
        continue;
      state = true;
      if (pseudo.startsWith("focus"))
        focus = true;
    }
    return { classes, attributes, state, focus };
  }
  function reads(inputs, touched) {
    if (!inputs)
      return true;
    for (const name of touched.classes)
      if (inputs.classes.has(name))
        return true;
    if (touched.classes.size > 0 && inputs.attributes.has("class"))
      return true;
    if (touched.style && (inputs.focus || inputs.attributes.has("style")))
      return true;
    if (touched.attributes.size > 0) {
      if (inputs.state)
        return true;
      for (const name of touched.attributes)
        if (inputs.attributes.has(name))
          return true;
    }
    return false;
  }
  function onlyDeclarations(rule) {
    if (typeof rule.selectorText === "string")
      return false;
    const nested = rule.cssRules;
    return nested === void 0 || Array.from(nested).every(onlyDeclarations);
  }
  function recordRoots(record) {
    var _a;
    const target = record.target;
    if (typeof ShadowRoot !== "undefined" && target instanceof ShadowRoot)
      return "all";
    const element = target instanceof Element ? target : target.parentElement;
    if (!element)
      return [];
    if (isStyleSource(element))
      return "all";
    if (record.type !== "childList")
      return [element];
    const roots = [element];
    for (const node of [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]) {
      if (!(node instanceof Element))
        continue;
      if (isStyleSource(node) || ((_a = node.querySelector) === null || _a === void 0 ? void 0 : _a.call(node, 'style, link[rel~="stylesheet"]')))
        return "all";
    }
    for (const node of Array.from(record.addedNodes))
      if (node instanceof Element)
        roots.push(node);
    return roots;
  }
  function isStyleSource(element) {
    var _a;
    const tag = element.tagName.toUpperCase();
    return tag === "STYLE" || tag === "LINK" && /(?:^|\s)stylesheet(?:\s|$)/i.test((_a = element.getAttribute("rel")) !== null && _a !== void 0 ? _a : "");
  }
  function queryAll(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (_a) {
      return [];
    }
  }
  const NONE = /* @__PURE__ */ new Set();
  const UNMATCHED_BATCH = 8;
  function queryNone(selectors) {
    try {
      return document.querySelectorAll(selectors).length === 0;
    } catch (_a) {
      return false;
    }
  }
  function queryable(selector) {
    if (selector === "")
      return false;
    try {
      document.querySelectorAll(selector);
      return true;
    } catch (_a) {
      return false;
    }
  }
  function sizeKey(element, type) {
    const box = element.getBoundingClientRect();
    const width = Math.round(box.width * 2);
    const height = Math.round(box.height * 2);
    if (!/\binline-size\b/.test(type))
      return `${width}x${height}`;
    return /\bvertical\b/.test(type) ? `${height}` : `${width}`;
  }
  function bare(selector) {
    return selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""').replace(/\[[^\]]*\]/g, "[]");
  }
  function readsState(compound) {
    var _a;
    for (const name of (_a = compound.match(/:[\w-]+/g)) !== null && _a !== void 0 ? _a : [])
      if (!STRUCTURAL.has(name.slice(1).toLowerCase()))
        return true;
    return false;
  }
  function stateAnchorsOf(selector) {
    const compounds = [];
    let depth = 0;
    let quote = "";
    let start = 0;
    for (let index = 0; index <= selector.length; index += 1) {
      const character = selector[index];
      if (quote !== "") {
        if (character === "\\")
          index += 1;
        else if (character === quote)
          quote = "";
      } else if (character === '"' || character === "'")
        quote = character;
      else if (character === "(" || character === "[")
        depth += 1;
      else if (character === ")" || character === "]")
        depth -= 1;
      else if (index === selector.length || depth === 0 && /[\s>+~]/.test(character)) {
        const compound = selector.slice(start, index).trim();
        if (compound !== "")
          compounds.push(compound);
        start = index + 1;
      }
    }
    const anchors = [];
    compounds.forEach((compound, index) => {
      if (!readsState(bare(compound)))
        return;
      if (index < compounds.length - 1)
        anchors.push(withoutPseudoClasses(compound));
      else if (/:has\(\s*[+~]|:(?:is|where|not|matches)\([^)]*[\s>+~]/i.test(bare(compound)))
        anchors.push("*");
    });
    return anchors;
  }
  function isNonLocal(selector) {
    const text = bare(selector);
    return /[+~]/.test(text) || /:(?:has|nth-|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|empty)/i.test(text);
  }
  function splitSelectorList(text) {
    const out = [];
    let depth = 0;
    let quote = null;
    let current = "";
    for (const character of text) {
      if (quote) {
        current += character;
        if (character === quote)
          quote = null;
        continue;
      }
      if (character === '"' || character === "'")
        quote = character;
      else if (character === "(" || character === "[")
        depth += 1;
      else if (character === ")" || character === "]")
        depth -= 1;
      else if (character === "," && depth === 0) {
        if (current.trim())
          out.push(current.trim());
        current = "";
        continue;
      }
      current += character;
    }
    if (current.trim())
      out.push(current.trim());
    return out;
  }
  function withoutPseudoElements(selector) {
    return selector.replace(/::[\w-]+(?:\([^)]*\))?/g, "").replace(/:(?:before|after|first-line|first-letter)\b/gi, "").trim();
  }
  function lastCompound(selector) {
    let depth = 0;
    let start = 0;
    const text = bare(selector);
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === "(" || character === "[")
        depth += 1;
      else if (character === ")" || character === "]")
        depth -= 1;
      else if (depth === 0 && /[\s>+~]/.test(character))
        start = index + 1;
    }
    return selector.slice(start).trim();
  }
  function withoutPseudoClasses(compound) {
    let out = "";
    let depth = 0;
    let skipping = false;
    for (const character of compound) {
      if (!skipping && depth === 0 && character === ":") {
        skipping = true;
        continue;
      }
      if (skipping) {
        if (character === "(")
          depth += 1;
        else if (character === ")")
          depth -= 1;
        else if (depth === 0 && /[.#[:]/.test(character)) {
          skipping = false;
          if (character === ":") {
            skipping = true;
            continue;
          }
          out += character;
        }
        continue;
      }
      out += character;
    }
    return out.trim() || "*";
  }
  function timingEnabled() {
    return globalThis.__nativeIslandsTiming === true;
  }
  function recordTiming(name, start) {
    if (!timingEnabled())
      return;
    performance.measure(`native-islands:${name}`, { start, end: performance.now() });
  }
  function coversViewport(layer) {
    if (layer.el === document.documentElement)
      return true;
    if (layer.el === document.body && bodyBackgroundPropagates())
      return true;
    if (layer.scrollPath.length > 0)
      return false;
    const rect = layer.visualRect;
    const x = layer.coordinateSpace === "document" ? window.scrollX : 0;
    const y = layer.coordinateSpace === "document" ? window.scrollY : 0;
    return rect.x <= x + 0.5 && rect.y <= y + 0.5 && rect.x + rect.w >= x + window.innerWidth - 0.5 && rect.y + rect.h >= y + window.innerHeight - 0.5;
  }
  const MOVING_UNDER_UNDERLAY = "web paint animating under a native island below the WebView suspends it";
  const UNFOLLOWED_STICKY = {
    reason: "web layers in a sticky box native cannot follow cannot use native cutouts",
    mayMoveWithoutRefresh: true
  };
  function round3(value) {
    return Math.round(value * 1e3) / 1e3;
  }
  function edgeStrip(cover, island) {
    const spansX = cover.x <= island.x && cover.x + cover.w >= island.x + island.w;
    const spansY = cover.y <= island.y && cover.y + cover.h >= island.y + island.h;
    return spansX && (cover.y <= island.y || cover.y + cover.h >= island.y + island.h) || spansY && (cover.x <= island.x || cover.x + cover.w >= island.x + island.w);
  }
  const clipsProtectedSurface = (native) => !!(native.handle.requiresUnobscuredSurface && native.handle.supportsProtectedSurfaceClip);
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
  const MAX_PAINT_PASSES = 8;
  const MOTION_SIT_OUT_MS = 1e3;
  const IDLE_FOLLOW_FRAMES = 30;
  const IDLE_FOLLOW_MS = 150;
  const WATCH_FRAMES = 30;
  const ACTIVE_WATCH_MS = 1e3;
  const IDLE_WATCH_MS = 250;
  const SCROLL_IDLE_MS = 100;
  const SCROLL_PLAN_INTERVAL_MS = 250;
  const MAX_REFUSALS = 3;
  const REFUSAL_WINDOW_MS = 2e3;
  const APPLY_LATENCY_SAMPLES = 12;
  const MAX_MOTION_LEAD_FRAMES = 2;
  let sceneReadScope = null;
  function withSceneReadScope(read) {
    const previous = sceneReadScope;
    sceneReadScope = {
      ancestors: /* @__PURE__ */ new WeakMap(),
      visibility: /* @__PURE__ */ new WeakMap(),
      styleVisibility: /* @__PURE__ */ new WeakMap(),
      scrollports: /* @__PURE__ */ new WeakMap(),
      scrollOffsets: /* @__PURE__ */ new WeakMap(),
      horizontalTravel: /* @__PURE__ */ new WeakMap(),
      clippedBounds: /* @__PURE__ */ new WeakMap()
    };
    try {
      return withBoundsReadScope(() => withCompositionReadScope(read));
    } finally {
      sceneReadScope = previous;
    }
  }
  const above = (a, b) => {
    const paintOrder2 = comparePaintOrder(a.el, b.el);
    if (paintOrder2 !== 0)
      return paintOrder2 > 0;
    return a.z !== b.z ? a.z > b.z : a.dom > b.dom;
  };
  const touchable = (layer) => {
    const style = computedStyle(layer.el);
    return style.visibility === "visible" && style.pointerEvents !== "none" && inertAncestor(layer.el) === null;
  };
  function movesAgainst(layer, native) {
    var _a;
    return ((_a = layer.movers) !== null && _a !== void 0 ? _a : []).some((target) => !isComposedAncestor(target, native.el));
  }
  function animatesAgainst(layer, native) {
    var _a;
    return ((_a = layer.animators) !== null && _a !== void 0 ? _a : []).some((target) => !isComposedAncestor(target, native.el));
  }
  function animatesAgainstCut(layer, native) {
    var _a;
    return ((_a = layer.cutAnimators) !== null && _a !== void 0 ? _a : []).some((target) => !isComposedAncestor(target, native.el));
  }
  function reachFrom(layer, native) {
    return movesAgainst(layer, native) ? Object.assign(Object.assign({}, layer), { paintEscapesRect: true }) : layer;
  }
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
  function ownBoxPaints(element) {
    const style = computedStyle(element);
    const visible = (color) => {
      var _a;
      return ((_a = colorAlpha(color)) !== null && _a !== void 0 ? _a : 1) > 0;
    };
    const border = ["Top", "Right", "Bottom", "Left"].some((side) => Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none" && visible(style[`border${side}Color`]));
    return visible(style.backgroundColor) || style.backgroundImage !== "" && style.backgroundImage !== "none" || border || style.boxShadow !== "" && style.boxShadow !== "none" || hasOuterDecoration(style) || hasVisiblePseudoElement(element, true);
  }
  function paintsUnderIsland(ancestor, island, rect, repainted) {
    let budget = 256;
    const visit = (element) => {
      const ownPaint = !repainted.has(element) && ownBoxPaints(element);
      if (--budget < 0 || ownPaint || directTextIntersects(element, rect))
        return true;
      let onPath = false;
      for (const child of Array.from(element.children)) {
        if (child === island) {
          onPath = true;
        } else if (isComposedAncestor(child, island)) {
          onPath = true;
          if (visit(child))
            return true;
        } else if (isElementVisible(child) && intersects(docRect(child), rect)) {
          return true;
        }
      }
      return !onPath;
    };
    return visit(ancestor);
  }
  function borderContains(element, rect) {
    const style = computedStyle(element);
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
    const value = Number.parseInt(computedStyle(el).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }
  let scriptScrollersAtRest = false;
  function scrollsOnlyFromScript(style) {
    return ![style.overflowX, style.overflowY].some((value) => value === "auto" || value === "scroll");
  }
  function physicalScrollOffset(element) {
    const cached = sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.scrollOffsets.get(element);
    if (cached)
      return cached;
    const style = computedStyle(element);
    if (scriptScrollersAtRest && scrollsOnlyFromScript(style))
      return { x: 0, y: 0 };
    const horizontalReversed = style.direction === "rtl" || style.flexDirection === "row-reverse";
    const verticalReversed = style.flexDirection === "column-reverse";
    const offset = {
      x: round2(horizontalReversed ? element.scrollWidth - element.clientWidth + element.scrollLeft : element.scrollLeft),
      y: round2(verticalReversed ? element.scrollHeight - element.clientHeight + element.scrollTop : element.scrollTop)
    };
    sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.scrollOffsets.set(element, offset);
    return offset;
  }
  function coordinateBasis(element, discovered = scrollPath(element)) {
    var _a;
    return {
      coordinateSpace: ((_a = fixedOrStickyAncestor(element)) === null || _a === void 0 ? void 0 : _a.viewportFixed) ? "viewport" : "document",
      scrollPath: discovered
    };
  }
  function basisRect(element, basis) {
    return basis.coordinateSpace === "viewport" ? rectInScrollPathCoordinates(viewportRect(element), basis.scrollPath) : rectInsideScrollPath(element, basis.scrollPath);
  }
  function scrollPath(element) {
    return independentScrollContainers(element).reverse();
  }
  function sameScrollPath(left, right) {
    return left.length === right.length && left.every((element, index) => element === right[index]);
  }
  function commonScrollPrefixLength(left, right) {
    const shared = Math.min(left.length, right.length);
    let index = 0;
    while (index < shared && left[index] === right[index])
      index += 1;
    return index;
  }
  function clippedPaintBound(side) {
    const cached = side.el && (sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.clippedBounds.get(side.el));
    if (cached && sameCoordinatePath(cached, side))
      return cached.rect;
    const rect = readClippedPaintBound(side);
    if (side.el)
      sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.clippedBounds.set(side.el, {
        coordinateSpace: side.coordinateSpace,
        scrollPath: side.scrollPath.slice(),
        rect
      });
    return rect;
  }
  function readClippedPaintBound(side) {
    var _a;
    let ancestor = side.el ? composedParentElement(side.el) : null;
    while (ancestor) {
      const style = computedStyle(ancestor);
      if (["hidden", "clip"].includes(style.overflowX) && ["hidden", "clip"].includes(style.overflowY) && ["", "0", "0px"].includes(style.getPropertyValue("overflow-clip-margin").trim()) && ((_a = fixedOrStickyAncestor(ancestor)) === null || _a === void 0 ? void 0 : _a.position) !== "sticky" && sameCoordinatePath(side, coordinateBasis(ancestor))) {
        return docRect(ancestor);
      }
      ancestor = composedParentElement(ancestor);
    }
    return null;
  }
  function escapingPaintBound(side) {
    var _a;
    const clip = clippedPaintBound(side);
    if (clip || !side.el || ((_a = side.movers) === null || _a === void 0 ? void 0 : _a.length))
      return clip;
    const el = side.el;
    return planMemo$1("textPaintBound", el, () => {
      var _a2;
      const style = computedStyle(el);
      if (el.childNodes.length === 0 || Array.from(el.childNodes).some((node) => node.nodeType !== Node.TEXT_NODE) || el.shadowRoot || el.getRootNode() instanceof ShadowRoot || style.display.includes("list-item") || ((_a2 = fixedOrStickyAncestor(el)) === null || _a2 === void 0 ? void 0 : _a2.position) === "sticky" || hasOuterDecoration(style) || style.textShadow !== "" && style.textShadow !== "none" || hasVisiblePseudoElement(el, true) || typeof document.createRange !== "function")
        return null;
      for (let node = el; node; node = composedParentElement(node)) {
        const filter = computedStyle(node).filter;
        if (filter !== "" && filter !== "none" || typeof node.getAnimations !== "function" || node.getAnimations().length)
          return null;
      }
      const range = document.createRange();
      range.selectNodeContents(el);
      const bounds = readBounds(el, range.getBoundingClientRect());
      range.detach();
      return union(docRect(el), {
        x: bounds.left + window.scrollX,
        y: bounds.top + window.scrollY,
        w: bounds.width,
        h: bounds.height
      });
    });
  }
  function reachableBound(side, sharedDepth) {
    var _a;
    const outermostUnmatched = side.scrollPath[sharedDepth];
    if (outermostUnmatched !== void 0) {
      const scrollport = scrollContainerRect(outermostUnmatched);
      if (!scrollport || side.scrollPath.length !== sharedDepth + 1 || side.paintEscapesRect || !side.paintRect)
        return scrollport;
      let travelX = sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.horizontalTravel.get(outermostUnmatched);
      if (travelX === void 0) {
        travelX = Math.max(0, outermostUnmatched.scrollWidth - outermostUnmatched.clientWidth);
        sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.horizontalTravel.set(outermostUnmatched, travelX);
      }
      if (!Number.isFinite(travelX))
        return scrollport;
      return Object.assign(Object.assign({}, scrollport), { x: side.paintRect.x - travelX, w: side.paintRect.w + travelX * 2 });
    }
    return side.paintEscapesRect ? escapingPaintBound(side) : (_a = side.paintRect) !== null && _a !== void 0 ? _a : null;
  }
  function sameCoordinatePath(left, right) {
    return left.coordinateSpace === right.coordinateSpace && sameScrollPath(left.scrollPath, right.scrollPath);
  }
  const CROSS_PATH_OVERLAP_REASON = "overlapping native islands from different scroll containers are unsupported";
  const COMPLEX_OVERLAP_REASON = "partially overlapping complex opaque regions require native path boolean support";
  function scrolledGeometry(placed) {
    const { rect, paintRect, coordinateSpace, scrollPath: scrollPath2 } = placed;
    if (coordinateSpace !== "document" || scrollPath2.length === 0 || !rect || !paintRect)
      return placed;
    const offset = scrollPathOffset(scrollPath2);
    const scrolled = Object.assign(Object.assign({}, paintRect), { x: round2(rect.x - offset.x), y: round2(rect.y - offset.y) });
    return Object.assign(Object.assign({}, placed), { paintRect: scrolled, visualRect: visibleRectInsideScrollPath(scrolled, scrollPath2) });
  }
  function sameBox(left, right) {
    return left !== null && right !== null && Math.abs(left.x - right.x) < 0.5 && Math.abs(left.y - right.y) < 0.5 && Math.abs(left.w - right.w) < 0.5 && Math.abs(left.h - right.h) < 0.5;
  }
  const SCOPED_STATE_EVENTS = /* @__PURE__ */ new Set([
    "pointerover",
    "pointerout",
    "pointerdown",
    "pointerup",
    "pointercancel",
    "focusin",
    "focusout",
    "input",
    "change"
  ]);
  function descendantsOf(root) {
    var _a, _b;
    if (typeof root.querySelectorAll === "function")
      return root.querySelectorAll("*");
    const found = [];
    const pending = Array.from((_a = root.children) !== null && _a !== void 0 ? _a : []);
    while (pending.length > 0) {
      const element = pending.pop();
      found.push(element);
      pending.push(...Array.from((_b = element.children) !== null && _b !== void 0 ? _b : []));
    }
    return found;
  }
  function outermost(roots) {
    const unique = Array.from(new Set(roots));
    return unique.filter((root) => !unique.some((other) => {
      var _a;
      return other !== root && ((_a = other.contains) === null || _a === void 0 ? void 0 : _a.call(other, root));
    }));
  }
  function hasResolvedGeometry(state) {
    return state.active && state.rect !== null && state.visualRect !== null;
  }
  function hasPlanGeometry(state) {
    return state.active && state.rect !== null && state.paintRect !== null;
  }
  function planned(natives, plane) {
    return natives.filter((native) => hasPlanGeometry(native) && (plane === void 0 || native.plane === plane));
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
    if (left.plane === "overlay" && right.plane === "overlay")
      return true;
    if (left.plane === right.plane)
      return false;
    return left.plane === "overlay" ? above(left, right) : above(right, left);
  }
  function unsupportedOverlapReason(left, right) {
    if (!intersects(left.visualRect, right.visualRect) || planeSeparatedOverlap(left, right))
      return null;
    if (left.plane === "underlay" && right.plane === "underlay" && stationaryCoordinatePaths(left, right))
      return null;
    if (sameCoordinatePath(left, right))
      return samePathOverlapReason(left, right);
    return CROSS_PATH_OVERLAP_REASON;
  }
  function visibleScrollport(scroller, scrollport, space) {
    let shown = scrollport;
    for (let node = composedParentElement(scroller); node && shown; node = composedParentElement(node)) {
      if (node === document.documentElement || node === document.body)
        break;
      const style = computedStyle(node);
      if (!["hidden", "clip", "auto", "scroll"].some((value) => style.overflowX === value || style.overflowY === value)) {
        continue;
      }
      const box = paddingBox(node);
      shown = intersection(shown, space === "viewport" ? box : Object.assign(Object.assign({}, box), { x: box.x + window.scrollX, y: box.y + window.scrollY }));
    }
    return shown;
  }
  function scrollingHoleCarries(native, layer) {
    const scroller = native.scrollPath[native.scrollPath.length - 1];
    if (!scroller || !(layer.el === scroller || isComposedAncestor(layer.el, scroller)))
      return false;
    const basis = coordinateBasis(scroller);
    return native.coordinateSpace === basis.coordinateSpace && sameScrollPath(native.scrollPath.slice(0, -1), basis.scrollPath) && staticallyAbove(layer, basis);
  }
  function stationaryCoordinatePaths(left, right) {
    if (sameCoordinatePath(left, right))
      return true;
    if (left.scrollPath.length > 0 || right.scrollPath.length > 0)
      return false;
    const root = document.scrollingElement;
    return root != null && root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight;
  }
  function retirementOf(previous, next) {
    var _a, _b;
    if (!previous)
      return null;
    const shown = new Set(next.components.filter((component) => component.active).map((component) => component.id));
    const retired = new Set(previous.components.filter((component) => component.active && !shown.has(component.id)).map((component) => component.id));
    if (retired.size === 0)
      return null;
    const keep = (regions) => regions && Object.fromEntries(Object.entries(regions).filter(([id]) => !retired.has(id)));
    return Object.assign(Object.assign({}, previous), { components: previous.components.map((component) => retired.has(component.id) ? Object.assign(Object.assign({}, component), { active: false }) : component), order: previous.order.filter((id) => !retired.has(id)), cutouts: (_a = keep(previous.cutouts)) !== null && _a !== void 0 ? _a : {}, exclusions: (_b = keep(previous.exclusions)) !== null && _b !== void 0 ? _b : {}, tints: keep(previous.tints), panes: previous.panes && Object.fromEntries(Object.entries(previous.panes).map(([id, pane]) => [
      id,
      pane.under !== void 0 && retired.has(pane.under) ? { color: pane.color } : pane
    ])) });
  }
  const FENCE_RANGE = 1024;
  const FENCE_SENTINEL_Y = 0.6875;
  function afterThisFrameReachesApp() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  function afterNextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
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
    if (layer.cutoutIssue !== null)
      return [];
    const found = [];
    for (const native of planned(natives, "underlay")) {
      if (sameCoordinatePath(native, layer)) {
        if (intersects(native.rect, layer.rect) && above(native, layer))
          found.push({ native, hole: native.rect });
        continue;
      }
      const visual = native.visualRect;
      if (visual === null || !intersects(visual, layer.visualRect) || !above(native, layer))
        continue;
      const hole = layer.coordinateSpace === "viewport" ? Object.assign(Object.assign({}, visual), { x: visual.x - window.scrollX, y: visual.y - window.scrollY }) : visual;
      found.push({ native, hole: Object.assign(Object.assign({}, rectInScrollPathCoordinates(hole, layer.scrollPath)), { r: native.rect.r }) });
    }
    return found;
  }
  function parseRgba(value) {
    const match = value.trim().match(/^rgba?\(([^)]*)\)$/i);
    if (!match)
      return null;
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part)))
      return null;
    const [red, green, blue, alpha = 1] = parts;
    return [red, green, blue, Math.min(1, Math.max(0, alpha))];
  }
  let colorProbe = null;
  function srgba(value) {
    const direct = parseRgba(value);
    if (direct)
      return direct;
    if (typeof document === "undefined" || typeof document.createElement !== "function")
      return null;
    if ((colorProbe === null || colorProbe === void 0 ? void 0 : colorProbe.document) !== document) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      colorProbe = { document, context: canvas.getContext("2d", { willReadFrequently: true }) };
    }
    const context = colorProbe.context;
    if (!context || typeof CSS !== "undefined" && !CSS.supports("color", value))
      return null;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    return [red, green, blue, alpha / 255];
  }
  function compositeColor(colors) {
    const alphas = colors.map(colorAlpha);
    if (alphas.some((alpha2) => alpha2 === null))
      return null;
    const base = Math.max(0, alphas.lastIndexOf(1));
    const shown = colors.slice(base).filter((_, index) => {
      var _a;
      return ((_a = alphas[base + index]) !== null && _a !== void 0 ? _a : 0) > 0;
    });
    if (shown.length === 1 && colorAlpha(shown[0]) === 1)
      return shown[0];
    let result = [0, 0, 0, 0];
    for (const color of shown) {
      const top = srgba(color);
      if (!top)
        return null;
      const alpha2 = top[3] + result[3] * (1 - top[3]);
      if (alpha2 === 0)
        continue;
      const channel = (index) => (top[index] * top[3] + result[index] * result[3] * (1 - top[3])) / alpha2;
      result = [channel(0), channel(1), channel(2), alpha2];
    }
    const [red, green, blue, alpha] = result;
    const byte = (value) => Math.round(Math.min(255, Math.max(0, value)));
    return `rgba(${byte(red)}, ${byte(green)}, ${byte(blue)}, ${round2(alpha)})`;
  }
  function staticallyAbove(outer, inner) {
    if (outer.coordinateSpace !== inner.coordinateSpace || outer.scrollPath.length > inner.scrollPath.length)
      return false;
    if (!sameScrollPath(outer.scrollPath, inner.scrollPath.slice(0, outer.scrollPath.length)))
      return false;
    return inner.scrollPath.slice(outer.scrollPath.length).every((element) => {
      const style = computedStyle(element);
      return [style.overflowX, style.overflowY].every((value) => value === "hidden" || value === "clip");
    });
  }
  function finishBackgroundTransitions(element) {
    var _a, _b;
    for (const animation of (_b = (_a = element.getAnimations) === null || _a === void 0 ? void 0 : _a.call(element)) !== null && _b !== void 0 ? _b : []) {
      const property = animation.transitionProperty;
      if (property === null || property === void 0 ? void 0 : property.startsWith("background"))
        animation.finish();
    }
  }
  const TRANSPARENT_PAINT = {
    color: "transparent",
    image: "none",
    size: "auto",
    position: "0% 0%",
    repeat: "repeat",
    origin: "padding-box",
    clip: "border-box",
    attachment: "scroll",
    blendMode: "normal",
    borderWidths: ["0px", "0px", "0px", "0px"]
  };
  function roundedHolesOverlap(holes) {
    return holes.some((left, index) => holes.slice(index + 1).some((right) => intersects(left, right) && (hasComplexOpaqueShape(left) || hasComplexOpaqueShape(right))));
  }
  function maskStyleKey(element) {
    const style = computedStyle(element);
    return JSON.stringify([
      element.style.cssText,
      ...MASK_PROPERTIES.map((property) => style.getPropertyValue(property))
    ]);
  }
  function backgroundValues(background) {
    var _a;
    const { rect, holes, unionMask, attachment, source } = background;
    const width = round2(rect.w);
    const height = round2(rect.h);
    const box = attachment === "local" ? "padding-box" : "border-box";
    const values = /* @__PURE__ */ new Map([
      ["background-color", "transparent"],
      ["background-repeat", "no-repeat"],
      ["background-origin", box],
      ["background-clip", box],
      ["background-attachment", attachment],
      ["background-blend-mode", "normal"]
    ]);
    if (source.image === "none" && !unionMask) {
      const images = [];
      const sizes = [];
      const positions = [];
      for (const tile of complementRects(rect, holes)) {
        images.push(`linear-gradient(${source.color}, ${source.color})`);
        sizes.push(`${round2(tile.w)}px ${round2(tile.h)}px`);
        positions.push(`${round2(tile.x - rect.x)}px ${round2(tile.y - rect.y)}px`);
      }
      for (const hole of holes) {
        const [topLeft, topRight, bottomRight, bottomLeft] = fitRadii((_a = hole.r) !== null && _a !== void 0 ? _a : SQUARE, hole.w, hole.h);
        const left = round2(hole.x - rect.x);
        const top = round2(hole.y - rect.y);
        for (const [radius, center, x, y] of [
          [topLeft, "100% 100%", left, top],
          [topRight, "0% 100%", round2(left + hole.w - topRight), top],
          [bottomLeft, "100% 0%", left, round2(top + hole.h - bottomLeft)],
          [bottomRight, "0% 0%", round2(left + hole.w - bottomRight), round2(top + hole.h - bottomRight)]
        ]) {
          if (radius <= 0)
            continue;
          images.push(`radial-gradient(circle at ${center}, transparent ${radius}px, ${source.color} ${radius}px)`);
          sizes.push(`${radius}px ${radius}px`);
          positions.push(`${x}px ${y}px`);
        }
      }
      if (images.length > 512)
        return null;
      values.set("background-image", images.length > 0 ? images.join(", ") : "none");
      values.set("background-size", sizes.length > 0 ? sizes.join(", ") : "auto");
      values.set("background-position", positions.length > 0 ? positions.join(", ") : "0px 0px");
      return values;
    }
    const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const path = escapeXml(knockoutPathData(rect, holes));
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`,
      ` viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`,
      unionMask ? knockoutMaskDefinition(rect, holes) : `<mask id="ni-knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><path fill="white" fill-rule="evenodd" d="${path}"/></mask>`,
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
    values.set("background-image", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    values.set("background-size", `${width}px ${height}px`);
    values.set("background-position", "0px 0px");
    return values;
  }
  function clipValues(clip, box = clip.rect) {
    if (clip.kind === "mask")
      return /* @__PURE__ */ new Map([
        ["mask-image", `url("data:image/svg+xml,${encodeURIComponent(knockoutMaskSvg(box, clip.holes))}")`],
        ["mask-size", "100% 100%"],
        ["mask-position", "0px 0px"],
        ["mask-repeat", "no-repeat"],
        ["mask-mode", "alpha"],
        ["mask-composite", "add"],
        ["mask-clip", "border-box"],
        ["mask-origin", "border-box"]
      ]);
    return /* @__PURE__ */ new Map([
      [
        "clip-path",
        clip.holes.some((hole) => opaqueContainsRect(hole, box)) ? "inset(50%)" : knockoutPath(box, clip.holes)
      ]
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
    const [topLeft, topRight, bottomRight, bottomLeft] = (_a = rect.r) !== null && _a !== void 0 ? _a : SQUARE;
    return {
      x: tenth(rect.x),
      y: tenth(rect.y),
      w: tenth(rect.w),
      h: tenth(rect.h),
      r: [tenth(topLeft), tenth(topRight), tenth(bottomRight), tenth(bottomLeft)]
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
    const scope = sceneReadScope;
    if (!scope)
      return readScrollContainerRect(element);
    const cached = scope.scrollports.get(element);
    if (cached !== void 0)
      return cached;
    const rect = readScrollContainerRect(element);
    scope.scrollports.set(element, rect);
    return rect;
  }
  function readScrollContainerRect(element) {
    const bounds = readBounds(element);
    const style = computedStyle(element);
    const radii = cssCornerRadii(style, bounds.width, bounds.height);
    if (radii === null)
      return null;
    const borderLeft = element.clientLeft;
    const borderTop = element.clientTop;
    const borderRight = Math.max(0, bounds.width - element.clientWidth - borderLeft);
    const borderBottom = Math.max(0, bounds.height - element.clientHeight - borderTop);
    const ownRadii = insetRadii(radii, Math.max(borderLeft, borderTop, borderRight, borderBottom));
    const inherited = inheritedCornerRadii(element, paddingBox(element));
    const [topLeft, topRight, bottomRight, bottomLeft] = ownRadii.map((radius, index) => Math.max(radius, inherited[index]));
    const innerRadii = [topLeft, topRight, bottomRight, bottomLeft];
    const left = bounds.left + window.scrollX + borderLeft;
    const top = bounds.top + window.scrollY + borderTop;
    const x = round2(left);
    const y = round2(top);
    return {
      x,
      y,
      w: round2(round2(left + Math.min(element.clientWidth, bounds.width - borderLeft)) - x),
      h: round2(round2(top + Math.min(element.clientHeight, bounds.height - borderTop)) - y),
      r: innerRadii
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
  function opaqueHexColor(value) {
    const color = srgba(value);
    if (!color || color[3] !== 1)
      return null;
    const channels = color.slice(0, 3).map((channel) => Math.round(channel));
    if (channels.some((channel) => channel < 0 || channel > 255))
      return null;
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  function isElementVisible(el) {
    const scope = sceneReadScope;
    if (!scope)
      return readElementVisibility(el);
    const cached = scope.visibility.get(el);
    if (cached !== void 0)
      return cached;
    const visible = readElementVisibility(el);
    scope.visibility.set(el, visible);
    return visible;
  }
  function styleVisibility(el) {
    var _a, _b;
    const cached = sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.styleVisibility.get(el);
    if (cached)
      return cached;
    const style = computedStyle(el);
    const parent = composedParentElement(el);
    const own = el.hidden || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden" || Number.parseFloat(style.opacity) === 0;
    const above2 = own || !parent ? null : styleVisibility(parent);
    const result = {
      hidden: own || ((_a = above2 === null || above2 === void 0 ? void 0 : above2.hidden) !== null && _a !== void 0 ? _a : false),
      automatic: style.contentVisibility === "auto" || ((_b = above2 === null || above2 === void 0 ? void 0 : above2.automatic) !== null && _b !== void 0 ? _b : false)
    };
    sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.styleVisibility.set(el, result);
    return result;
  }
  function readElementVisibility(el) {
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
    const { hidden, automatic } = styleVisibility(el);
    if (hidden)
      return false;
    if (automatic) {
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
    return planMemo$1("positionedAncestor", el, () => {
      const position = computedStyle(el).position;
      if ((position === "fixed" || position === "sticky") && !(el === document.body && document.documentElement.hasAttribute("data-ni-root-scroll"))) {
        return { element: el, position, viewportFixed: position === "fixed" && isViewportFixed(el) };
      }
      const parent = composedParentElement(el);
      return parent ? fixedOrStickyAncestor(parent) : null;
    });
  }
  function viewportReachableBound(side) {
    const pane = side.scrollPath[0];
    if (pane !== void 0) {
      const aperture = scrollContainerRect(pane);
      if (!aperture)
        return null;
      return Object.assign(Object.assign({}, aperture), { x: round2(aperture.x - window.scrollX), y: round2(aperture.y - window.scrollY) });
    }
    if (!side.paintEscapesRect)
      return side.rect;
    const clip = escapingPaintBound(side);
    return clip && Object.assign(Object.assign({}, clip), { x: round2(clip.x - window.scrollX), y: round2(clip.y - window.scrollY) });
  }
  function structuralSignature(payload, mode) {
    if (mode !== "bridge")
      return JSON.stringify(payload);
    return JSON.stringify(Object.assign(Object.assign({}, payload), { scrollContainers: payload.scrollContainers.map((container) => Object.assign(Object.assign({}, container), { offsetX: 0, offsetY: 0 })) }));
  }
  function rootScrollCanCross(documentRect, viewportRect2) {
    var _a, _b, _c;
    const root = document.documentElement;
    const body = document.body;
    const range = (_a = sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.rootScrollRange) !== null && _a !== void 0 ? _a : {
      x: Math.max(0, Math.max(root.scrollWidth, (_b = body === null || body === void 0 ? void 0 : body.scrollWidth) !== null && _b !== void 0 ? _b : 0) - window.innerWidth),
      y: Math.max(0, Math.max(root.scrollHeight, (_c = body === null || body === void 0 ? void 0 : body.scrollHeight) !== null && _c !== void 0 ? _c : 0) - window.innerHeight)
    };
    if (sceneReadScope)
      sceneReadScope.rootScrollRange = range;
    const { x: maxX, y: maxY } = range;
    const axisCanCross = (documentStart, documentSize, viewportStart, viewportSize, maximumOffset) => {
      const lowerOffset = documentStart - (viewportStart + viewportSize);
      const upperOffset = documentStart + documentSize - viewportStart;
      return Math.max(0, lowerOffset) < Math.min(maximumOffset, upperOffset) || maximumOffset === 0 && lowerOffset < 0 && upperOffset > 0;
    };
    return axisCanCross(documentRect.x, documentRect.w, viewportRect2.x, viewportRect2.w, maxX) && axisCanCross(documentRect.y, documentRect.h, viewportRect2.y, viewportRect2.h, maxY);
  }
  function canMoveIntoIntersection(left, right) {
    if (left.coordinateSpace === right.coordinateSpace) {
      const shared = commonScrollPrefixLength(left.scrollPath, right.scrollPath);
      const leftBound = reachableBound(left, shared);
      const rightBound = reachableBound(right, shared);
      return !leftBound || !rightBound || intersects(leftBound, rightBound);
    }
    if (left.visualRect && right.visualRect && intersects(left.visualRect, right.visualRect))
      return true;
    const documentSide = left.coordinateSpace === "document" ? left : right;
    const viewportSide = left.coordinateSpace === "viewport" ? left : right;
    const documentBound = reachableBound(documentSide, 0);
    const viewportBound = viewportReachableBound(viewportSide);
    if (!documentBound || !viewportBound)
      return true;
    return rootScrollCanCross(documentBound, viewportBound);
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
    if (/^(transform|transform-origin|transform-style|translate|scale|rotate|perspective|offset-.+)$/i.test(propertyName)) {
      return "local-composition";
    }
    if (/^(visibility|opacity|filter|backdrop-filter|mix-blend-mode|isolation|will-change|clip|clip-path|mask(?:-.+)?|background(?:-.+)?|border(?:-.+)?-radius|border-radius|z-index)$/i.test(propertyName)) {
      return "repaint";
    }
    if (/^(color|accent-color|caret-color|border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?-color|outline-color|column-rule-color|text-decoration(?:-.+)?|text-emphasis(?:-.+)?|text-underline-offset|fill(?:-opacity)?|stroke(?:-.+)?|stop-(?:color|opacity)|flood-(?:color|opacity)|lighting-color|box-shadow|text-shadow)$/i.test(propertyName)) {
      return "none";
    }
    return "global-layout";
  }
  function transitionImpact(target, propertyName) {
    const impact = effectImpactForProperty(propertyName);
    if (impact !== "global-layout")
      return impact;
    if (/^outline-(width|offset|style)$/.test(propertyName))
      return "repaint";
    if (/^(border(-(top|right|bottom|left))?-width|padding(-(top|right|bottom|left))?)$/.test(propertyName) && target instanceof HTMLElement && hasFixedBorderBox(target)) {
      return "repaint";
    }
    return impact;
  }
  function hasFixedBorderBox(el) {
    if (typeof CSSUnitValue === "undefined" || computedStyle(el).boxSizing !== "border-box")
      return false;
    const style = el.computedStyleMap();
    return ["width", "height"].every((property) => {
      const value = style.get(property);
      return value instanceof CSSUnitValue && value.unit === "px";
    });
  }
  function normalizedCssPropertyName(propertyName) {
    return propertyName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
  const INLINE_TRANSLATION = /(^|;\s*)transform:\s*translate3d\(\s*-?[\d.]+px,\s*-?[\d.]+px,\s*0(?:px)?\s*\)\s*(?=;|$)/;
  function translationOnly(before, after) {
    if (before === null || after === null)
      return false;
    const rest = (style) => {
      if (!INLINE_TRANSLATION.test(style))
        return null;
      const without = style.replace(INLINE_TRANSLATION, "$1");
      return without.includes("transform") ? null : without;
    };
    const restBefore = rest(before);
    return restBefore !== null && restBefore === rest(after);
  }
  function animationImpact(animation) {
    const transitionProperty = animation.transitionProperty;
    if (typeof transitionProperty === "string") {
      return transitionImpact(animationTarget(animation), transitionProperty);
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
          if (impact !== "local-composition" && propertyImpact !== "none")
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
    const scope = sceneReadScope;
    const cached = scope === null || scope === void 0 ? void 0 : scope.ancestors.get(element);
    if (cached)
      return cached.has(ancestor);
    let current = element;
    const visited = /* @__PURE__ */ new Set();
    while (current && !visited.has(current)) {
      if (current === ancestor && !scope)
        return true;
      visited.add(current);
      current = composedParentElement(current);
    }
    scope === null || scope === void 0 ? void 0 : scope.ancestors.set(element, visited);
    return visited.has(ancestor);
  }
  function hasComposedAncestorIn(element, ancestors) {
    const scope = sceneReadScope;
    const cached = scope === null || scope === void 0 ? void 0 : scope.ancestors.get(element);
    if (cached) {
      for (const ancestor of cached) {
        if (ancestors.has(ancestor))
          return true;
      }
      return false;
    }
    let current = element;
    let found = false;
    const visited = /* @__PURE__ */ new Set();
    while (current && !visited.has(current)) {
      visited.add(current);
      if (ancestors.has(current))
        found = true;
      current = composedParentElement(current);
    }
    scope === null || scope === void 0 ? void 0 : scope.ancestors.set(element, visited);
    return found;
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
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function" && this.scrollMode === "bridge") {
        window.removeEventListener("scroll", this.onDocumentScroll);
      }
      this.scrollMode = mode;
      this.rootScroll.setEnabled(mode === "root");
      if (typeof window !== "undefined" && typeof window.addEventListener === "function" && mode === "bridge") {
        window.addEventListener("scroll", this.onDocumentScroll, { passive: true });
      }
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
      this.stickyBoxes = /* @__PURE__ */ new Map();
      this.resizeObserver = null;
      this.scheduled = false;
      this.scrollerPaint = /* @__PURE__ */ new Map();
      this.held = /* @__PURE__ */ new Set();
      this.motionSamples = /* @__PURE__ */ new Map();
      this.frameInterval = 1e3 / 60;
      this.lastFrameTime = null;
      this.idleFollowFrames = 0;
      this.planRequested = false;
      this.watchFrames = 0;
      this.activeUntil = Number.NEGATIVE_INFINITY;
      this.idleWatch = null;
      this.lastPlanAt = Number.NEGATIVE_INFINITY;
      this.lastScrollAt = Number.NEGATIVE_INFINITY;
      this.plannedAnimations = /* @__PURE__ */ new WeakSet();
      this.resuming = [];
      this.resumeSince = /* @__PURE__ */ new Map();
      this.sittingOut = /* @__PURE__ */ new Map();
      this.sitOutTimer = null;
      this.following = false;
      this.paintWait = null;
      this.acknowledgedSignature = "";
      this.acknowledgedPlanes = /* @__PURE__ */ new Map();
      this.acknowledgedPlaneSequence = -1;
      this.plannedGeometry = /* @__PURE__ */ new Map();
      this.plannedCanvasColor = /* @__PURE__ */ new Map();
      this.acknowledgedGeometry = /* @__PURE__ */ new Map();
      this.lastPlannedGeometry = /* @__PURE__ */ new Map();
      this.acknowledgedCanvasColor = null;
      this.refusals = /* @__PURE__ */ new Map();
      this.pendingSignature = null;
      this.pendingLayout = null;
      this.planGeneration = 0;
      this.layoutWaiters = /* @__PURE__ */ new Set();
      this.transportSession = { state: "ready" };
      this.activeEffects = /* @__PURE__ */ new Map();
      this.watchedAnimations = /* @__PURE__ */ new WeakSet();
      this.effectRootDisposers = /* @__PURE__ */ new Map();
      this.automaticLayerClassifications = /* @__PURE__ */ new WeakMap();
      this.styleScope = new StyleScope(() => Array.from(this.effectRootDisposers.keys()).some((root) => typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot));
      this.scrollIds = /* @__PURE__ */ new WeakMap();
      this.trackedScrollContainers = /* @__PURE__ */ new Map();
      this.scrollDisposers = /* @__PURE__ */ new Map();
      this.nextScrollId = 1;
      this.scrollSequence = 0;
      this.layoutSequence = 0;
      this.emittedScrollTopology = /* @__PURE__ */ new Map();
      this.acknowledgedScrollLayout = null;
      this.scrollScheduled = false;
      this.scrollSettledPending = false;
      this.scrollEndTimer = null;
      this.onDocumentScroll = () => {
        this.scheduleScrollOffsets(false);
        this.scheduleScrollSettlement();
      };
      this.runtimeClips = /* @__PURE__ */ new Map();
      this.runtimeBackgrounds = /* @__PURE__ */ new Map();
      this.desiredPaint = /* @__PURE__ */ new Map();
      this.heldUnder = /* @__PURE__ */ new Map();
      this.pageHandoffs = /* @__PURE__ */ new Map();
      this.paneColors = /* @__PURE__ */ new Map();
      this.planCanvas = null;
      this.planEffects = [];
      this.animatedTargets = /* @__PURE__ */ new Set();
      this.backgroundSourcesDirty = false;
      this.runtimePaintStyles = /* @__PURE__ */ new WeakMap();
      this.anchoredHoles = [];
      this.runtimePaintAttributes = /* @__PURE__ */ new WeakMap();
      this.rejectedMasks = /* @__PURE__ */ new Map();
      this.rejectedBackgrounds = /* @__PURE__ */ new Set();
      this.nativeAcceptsPaneColor = false;
      this.nativeMotionStartsAtCommit = false;
      this.nativeAlphaGradient = false;
      this.nativePaintFence = false;
      this.fenceSentinel = null;
      this.fenceSequence = 0;
      this.lastSentPayload = null;
      this.nativeHolds = /* @__PURE__ */ new Map();
      this.appliedSequence = -1;
      this.freshAnimations = /* @__PURE__ */ new Set();
      this.planTimeline = null;
      this.startingMotion = null;
      this.pausedMotion = /* @__PURE__ */ new Set();
      this.heldMotion = /* @__PURE__ */ new WeakSet();
      this.sentStarts = /* @__PURE__ */ new WeakMap();
      this.planMotion = /* @__PURE__ */ new Map();
      this.applyLatencies = [];
      this.motionIds = /* @__PURE__ */ new WeakMap();
      this.nextMotionId = 1;
      this.commandsFollowLayouts = false;
      this.onAnyScroll = () => {
        this.lastScrollAt = performance.now();
        this.wake();
      };
      this.refresh = () => {
        this.planRequested = true;
        this.wake();
      };
      this.compositionObserver = new CompositionObserver(() => this.refresh(), void 0, onOpenRoot);
    }
    registerNative(handle) {
      var _a;
      if (this.natives.some((candidate) => candidate.el === handle.el))
        return;
      this.acknowledgedSignature = "";
      this.natives.push(handle);
      (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.observe(handle.el);
      if (this.transportSession.state === "failed") {
        handle.failNative(this.transportSession.error.message);
      }
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
    recreateNativeViews() {
      return this.republish();
    }
    prepareForPageHide() {
      this.releaseMotion();
      this.invalidatePendingPlan();
      this.acknowledgedPlanes.clear();
      this.acknowledgedGeometry.clear();
      this.plannedGeometry.clear();
      this.plannedCanvasColor.clear();
      this.acknowledgedCanvasColor = null;
      this.releaseRuntimePaint();
      this.rootScroll.clear();
    }
    /** Hold every composition request until reset has established this session's capabilities. */
    beginTransportReset() {
      this.releaseMotion();
      this.heldMotion = /* @__PURE__ */ new WeakSet();
      this.transportSession = { state: "pending" };
      this.acknowledgedScrollLayout = null;
      this.emittedScrollTopology.clear();
      this.held.clear();
      for (const handle of /* @__PURE__ */ new Set([...this.natives, ...this.nativeHolds.keys()]))
        handle.nativeReset();
      this.nativeHolds.clear();
      this.nativeAcceptsPaneColor = false;
      this.nativeMotionStartsAtCommit = false;
      this.nativeAlphaGradient = false;
      this.nativePaintFence = false;
      this.lastSentPayload = null;
      this.applyLatencies = [];
      this.invalidatePendingPlan();
      this.acknowledgedPlanes.clear();
      this.acknowledgedGeometry.clear();
      this.plannedGeometry.clear();
      this.plannedCanvasColor.clear();
      this.acknowledgedCanvasColor = null;
      this.releaseRuntimePaint();
    }
    completeTransportReset() {
      if (this.transportSession.state !== "pending")
        return;
      this.transportSession.state = "ready";
      if (this.nativePaintFence)
        this.writeFence();
      this.refresh();
    }
    failTransportReset(error) {
      this.releaseMotion();
      if (this.transportSession.state === "failed")
        return;
      this.transportSession = { state: "failed", error };
      this.invalidatePendingPlan();
      this.acknowledgedPlanes.clear();
      this.acknowledgedGeometry.clear();
      this.plannedGeometry.clear();
      this.plannedCanvasColor.clear();
      this.acknowledgedCanvasColor = null;
      this.releaseRuntimePaint();
      for (const waiter of this.layoutWaiters)
        waiter.reject(error);
      this.layoutWaiters.clear();
      for (const handle of this.natives) {
        handle.failNative(error.message);
      }
    }
    /** Forgets one element's classification, not its subtree's. */
    invalidateAutomaticLayer(element) {
      if (element instanceof HTMLElement)
        this.automaticLayerClassifications.delete(element);
      if (this.runtimeBackgrounds.has(element))
        this.backgroundSourcesDirty = true;
    }
    invalidateAutomaticLayers(root) {
      var _a;
      if (!root) {
        this.automaticLayerClassifications = /* @__PURE__ */ new WeakMap();
        this.rejectedMasks.clear();
        this.rejectedBackgrounds.clear();
        this.backgroundSourcesDirty = this.runtimeBackgrounds.size > 0;
        return;
      }
      if (root instanceof HTMLElement)
        this.automaticLayerClassifications.delete(root);
      for (const element of descendantsOf(root))
        this.automaticLayerClassifications.delete(element);
      for (const element of this.runtimeBackgrounds.keys()) {
        if (element === root || ((_a = root.contains) === null || _a === void 0 ? void 0 : _a.call(root, element)))
          this.backgroundSourcesDirty = true;
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
      const scrollId = this.scrollIds.get(el);
      if (!scrollId || !this.trackedScrollContainers.has(scrollId))
        (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.unobserve(el);
      this.refresh();
    }
    /**
     * Resolve once native has installed the current DOM composition. Installed,
     * not presented: the scene is in place for the next frame, and no frame is
     * awaited.
     */
    synchronize() {
      if (this.transportSession.state === "failed")
        return Promise.reject(this.transportSession.error);
      this.invalidateAutomaticLayers();
      return new Promise((resolve, reject) => {
        this.layoutWaiters.add({ resolve, reject });
        this.refresh();
      });
    }
    /** Bypass deduplication for native repair and await the applied scene. */
    republish() {
      this.invalidatePendingPlan();
      return this.synchronize();
    }
    start(onChange, onScroll) {
      if (this.onChange)
        return;
      this.onChange = onChange;
      this.onScroll = onScroll !== null && onScroll !== void 0 ? onScroll : null;
      setTopLayerRoots(() => [
        document,
        ...Array.from(this.effectRootDisposers.keys()).filter((root) => typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot)
      ]);
      this.mutationObserver = new MutationObserver((records) => this.handleDomMutations(records));
      this.mutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver((entries) => {
          if (!this.styleScope.scoped || entries.some((entry) => entry.target === document.documentElement))
            this.invalidateAutomaticLayers();
          this.refresh();
        });
        this.resizeObserver.observe(document.documentElement);
        for (const native of this.natives)
          this.resizeObserver.observe(native.el);
        for (const layer of this.layers)
          this.resizeObserver.observe(layer.el);
        for (const element of this.trackedScrollContainers.values())
          this.resizeObserver.observe(element);
      }
      this.observeEffectRoot(document);
      this.refresh();
    }
    /**
     * Moves the sentinel to the next fence, adding it first if the page has none,
     * and returns that fence. It is a 1x1 transparent composited box; native finds
     * its layer by the fixed y translation and reads the fence from x.
     */
    writeFence() {
      var _a;
      if (!((_a = this.fenceSentinel) === null || _a === void 0 ? void 0 : _a.isConnected)) {
        this.fenceSentinel = document.createElement("div");
        this.fenceSentinel.setAttribute("aria-hidden", "true");
        this.fenceSentinel.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;z-index:2147483647;will-change:transform";
        document.documentElement.append(this.fenceSentinel);
      }
      const fence = this.fenceSequence++ % FENCE_RANGE;
      this.fenceSentinel.style.transform = `translate(${fence / FENCE_RANGE}px, ${FENCE_SENTINEL_Y}px)`;
      return fence;
    }
    isFenceRecord(record) {
      if (!this.fenceSentinel)
        return false;
      if (record.target === this.fenceSentinel)
        return true;
      const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
      return record.type === "childList" && nodes.length > 0 && nodes.every((node) => node === this.fenceSentinel);
    }
    /** Document and shadow-root observers share the same paint-ownership rules. */
    handleDomMutations(records) {
      var _a, _b, _c, _d, _e;
      let changed = false;
      let uncovering = false;
      let reachesAll = false;
      const roots = [];
      const authored = [];
      for (const record of records) {
        if (this.isFenceRecord(record))
          continue;
        if (typeof ShadowRoot !== "undefined" && record.target instanceof ShadowRoot) {
          changed = true;
          reachesAll = true;
          continue;
        }
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (!target)
          continue;
        if (record.type === "attributes" && record.attributeName && target.getAttribute(record.attributeName) === record.oldValue)
          continue;
        const ownedPaint = record.type === "attributes" && target instanceof HTMLElement && (record.attributeName === "style" ? this.runtimePaintStyles.get(target) === target.style.cssText : record.attributeName !== null && ((_a = this.runtimePaintAttributes.get(target)) === null || _a === void 0 ? void 0 : _a.has(record.attributeName)) === true && ((_b = this.runtimePaintAttributes.get(target)) === null || _b === void 0 ? void 0 : _b.get(record.attributeName)) === target.getAttribute(record.attributeName));
        if (ownedPaint)
          continue;
        this.rejectedMasks.clear();
        this.rejectedBackgrounds.clear();
        if (target instanceof HTMLElement && record.type === "attributes") {
          const owns = (applied) => Array.from(applied).every(([property, value]) => target.style.getPropertyValue(property) === value && target.style.getPropertyPriority(property) === "");
          const runtimeClip = this.runtimeClips.get(target);
          const runtimeBackground = this.runtimeBackgrounds.get(target);
          const coveredPage = runtimeClip !== void 0 && record.attributeName !== "style" && record.attributeName !== "data-ni-runtime-clip" && ((_c = this.pageHandoffs.get(target)) === null || _c === void 0 ? void 0 : _c.state) === "covered";
          const holding = coveredPage && !!((_d = this.heldUnder.get(target)) === null || _d === void 0 ? void 0 : _d.some((native) => this.mayShowUnder(native.handle.islandId)));
          if (runtimeClip && (record.attributeName === "style" ? !owns(runtimeClip.applied) : record.attributeName === "data-ni-runtime-clip" ? !target.hasAttribute("data-ni-runtime-clip") : coveredPage && !holding))
            this.releaseRuntimeClip(target);
          if (holding)
            uncovering = true;
          if (runtimeBackground && record.attributeName === "style") {
            if (!owns(runtimeBackground.applied))
              this.releaseRuntimeBackground(target);
          } else if (runtimeBackground && record.attributeName === "data-ni-runtime-background" && !target.hasAttribute("data-ni-runtime-background")) {
            this.releaseRuntimeBackground(target);
          } else if (runtimeBackground && record.attributeName !== "style" && record.attributeName !== "data-ni-runtime-background") {
            this.backgroundSourcesDirty = true;
          }
        }
        changed = true;
        authored.push(record);
        if (record.type === "attributes" && record.attributeName === "style" && translationOnly(record.oldValue, target.getAttribute("style")))
          continue;
        const reached = recordRoots(record);
        if (reached === "all")
          reachesAll = true;
        else
          roots.push(...reached);
      }
      if (changed) {
        if (reachesAll)
          this.styleScope.invalidateIndex();
        if (reachesAll || !this.styleScope.scoped)
          this.invalidateAutomaticLayers();
        else {
          this.styleScope.noteChange(authored);
          for (const root of outermost(roots))
            this.invalidateAutomaticLayers(root);
        }
        this.refresh();
        if (uncovering)
          this.runFrame((_e = this.lastFrameTime) !== null && _e !== void 0 ? _e : performance.now());
      }
    }
    recordRuntimePaintAttribute(element, name) {
      let attributes = this.runtimePaintAttributes.get(element);
      if (!attributes)
        this.runtimePaintAttributes.set(element, attributes = /* @__PURE__ */ new Map());
      attributes.set(name, element.getAttribute(name));
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
      var _a, _b, _c;
      const next = new Map(containers.map((element) => [this.idForScrollContainer(element), element]));
      for (const [id, element] of this.trackedScrollContainers) {
        if (next.has(id))
          continue;
        (_a = this.scrollDisposers.get(id)) === null || _a === void 0 ? void 0 : _a();
        this.scrollDisposers.delete(id);
        this.trackedScrollContainers.delete(id);
        if (!this.natives.some((handle) => handle.el === element) && !this.layers.some((handle) => handle.el === element)) {
          (_b = this.resizeObserver) === null || _b === void 0 ? void 0 : _b.unobserve(element);
        }
      }
      for (const [id, element] of next) {
        if (!this.trackedScrollContainers.has(id))
          (_c = this.resizeObserver) === null || _c === void 0 ? void 0 : _c.observe(element);
        this.trackedScrollContainers.set(id, element);
        if (this.scrollDisposers.has(id))
          continue;
        if (this.innerScrollMode !== "bridge") {
          if (this.innerScrollMode !== "native" || !scrollsOnlyFromScript(computedStyle(element)))
            continue;
          const onScriptScroll = () => this.refresh();
          element.addEventListener("scroll", onScriptScroll, { passive: true });
          this.scrollDisposers.set(id, () => element.removeEventListener("scroll", onScriptScroll));
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
      const flush = () => {
        if (!this.scrollScheduled)
          return;
        this.scrollScheduled = false;
        const finalSample = this.scrollSettledPending;
        this.scrollSettledPending = false;
        void this.flushScrollOffsets(finalSample);
      };
      queueMicrotask(flush);
      requestAnimationFrame(flush);
    }
    scheduleScrollSettlement() {
      if (this.scrollEndTimer !== null)
        window.clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = window.setTimeout(() => {
        this.scrollEndTimer = null;
        this.scheduleScrollOffsets(true);
      }, 120);
    }
    /** Latest emitted generation; native holds it until installed. Repair awaits transport directly. */
    captureScrollOffsets(settled = false) {
      if (this.transportSession.state !== "ready")
        return null;
      if (this.trackedScrollContainers.size === 0)
        return null;
      const payload = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, createEnvelope()), { sequence: ++this.scrollSequence, layoutSeq: this.layoutSequence }), this.scrollMode === "bridge" ? { documentOffsetY: round2(window.scrollY) } : {}), { offsets: Array.from(this.trackedScrollContainers, ([id, element]) => Object.assign({ id }, physicalScrollOffset(element))) }), settled ? { settled: true } : {});
      return payload;
    }
    /** Publish offsets even when scene geometry is unchanged. */
    publishScrollOffsets() {
      if (this.scrollMode !== "bridge")
        return;
      void this.flushScrollOffsets(false);
    }
    flushScrollOffsets(settled) {
      const payload = this.onScroll ? this.captureScrollOffsets(settled) : null;
      if (!payload || !this.onScroll)
        return Promise.resolve();
      const installed = this.acknowledgedScrollLayout;
      if (installed && installed.sequence < this.layoutSequence) {
        const offsets = payload.offsets.filter(({ id }) => installed.topology.has(id) && installed.topology.get(id) === this.emittedScrollTopology.get(id));
        if (offsets.length > 0) {
          void this.onScroll(Object.assign(Object.assign({}, payload), { layoutSeq: installed.sequence, offsets })).catch(() => void 0);
          payload.sequence = ++this.scrollSequence;
        }
      }
      return this.onScroll(payload).catch(() => void 0);
    }
    observeEffectRoot(root) {
      if (this.effectRootDisposers.has(root))
        return;
      const target = root;
      const onTransitionRun = (event) => {
        if (event instanceof TransitionEvent) {
          const element = event.target;
          const getAnimations = element instanceof Element ? element.getAnimations : void 0;
          const transition = typeof getAnimations === "function" ? Array.from(getAnimations.call(element)).find((candidate) => candidate.transitionProperty === event.propertyName) : void 0;
          this.beginEffect(element, `transition:${event.propertyName}`, transitionImpact(element, event.propertyName), transition);
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
        const target2 = event.target;
        const getAnimations = target2.getAnimations;
        const animation = typeof getAnimations === "function" ? Array.from(getAnimations.call(target2, { subtree: true })).find((candidate) => {
          var _a;
          const effect = candidate.effect;
          return (effect === null || effect === void 0 ? void 0 : effect.target) === target2 && ((_a = effect.pseudoElement) !== null && _a !== void 0 ? _a : "") === event.pseudoElement && candidate.animationName === event.animationName && (candidate.playState === "running" || candidate.pending || this.pausedMotion.has(candidate));
        }) : void 0;
        this.beginEffect(event.target, `animation:${event.animationName}`, animation ? animationImpact(animation) : "global-layout", animation);
      };
      const onAnimationEnd = (event) => {
        if (event instanceof AnimationEvent) {
          this.endEffect(event.target, `animation:${event.animationName}`);
        }
      };
      const onLoad = (event) => {
        var _a;
        if (event.target instanceof HTMLStyleElement || event.target instanceof HTMLLinkElement && /(?:^|\s)stylesheet(?:\s|$)/i.test((_a = event.target.getAttribute("rel")) !== null && _a !== void 0 ? _a : "")) {
          this.styleScope.invalidateIndex();
          this.invalidateAutomaticLayers();
        }
        this.refresh();
      };
      const onStyleStateChange = (event) => {
        if (event.pointerType === "touch" && event.type !== "pointerup") {
          this.wake();
          return;
        }
        const reach = SCOPED_STATE_EVENTS.has(event.type) && event.target instanceof Element ? this.styleScope.stateReach(event.target) : "all";
        if (reach === "all")
          this.invalidateAutomaticLayers();
        else {
          for (const element of reach.own)
            this.invalidateAutomaticLayer(element);
          for (const root2 of outermost(reach.subtrees))
            this.invalidateAutomaticLayers(root2);
        }
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
      target.addEventListener("scroll", this.onAnyScroll, { capture: true, passive: true });
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
        target.removeEventListener("scroll", this.onAnyScroll, { capture: true });
        for (const eventName of styleStateEvents) {
          target.removeEventListener(eventName, onStyleStateChange, true);
          target.removeEventListener(eventName, onTopLayerState, true);
        }
      });
    }
    /**
     * Whether an animation's element holds an island, or is drawn over one native
     * shows above the WebView, which is cut for it. Over an island under the WebView
     * the page's own paint covers it, moving or not.
     */
    mayReachIsland(animation) {
      var _a, _b;
      const target = (_b = (_a = animation.effect) === null || _a === void 0 ? void 0 : _a.target) !== null && _b !== void 0 ? _b : null;
      if (!target)
        return true;
      const box = target.getBoundingClientRect();
      let stickyCover = null;
      for (let el = composedParentElement(target); el; el = composedParentElement(el)) {
        if (this.stickyBoxes.get(el)) {
          stickyCover = el.getBoundingClientRect();
          break;
        }
      }
      return this.natives.some((native) => {
        if (isComposedAncestor(target, native.el))
          return true;
        if (this.acknowledgedPlanes.get(native.islandId) !== "overlay")
          return false;
        if (stickyCover && box.top >= stickyCover.top - 1 && box.bottom <= stickyCover.bottom + 1)
          return false;
        const island = native.el.getBoundingClientRect();
        return box.left < island.right && island.left < box.right && box.top < island.bottom && island.top < box.bottom;
      });
    }
    /** Looks for animations every frame for `ACTIVE_WATCH_MS` from now. */
    wake() {
      this.activeUntil = performance.now() + ACTIVE_WATCH_MS;
      if (this.idleWatch !== null) {
        clearTimeout(this.idleWatch);
        this.idleWatch = null;
      }
      this.scheduleFrame();
    }
    unobserveEffectRoot(root) {
      var _a;
      (_a = this.effectRootDisposers.get(root)) === null || _a === void 0 ? void 0 : _a();
      this.effectRootDisposers.delete(root);
    }
    /** Avoid replanning effects already captured on their starting frame. */
    beginEffect(target, key, impact, animation) {
      var _a;
      if (!(target instanceof Element) || impact === "none")
        return;
      if (animation && !this.plannedAnimations.has(animation))
        this.holdMotion(animation);
      const effects = (_a = this.activeEffects.get(target)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Map();
      effects.set(key, impact);
      this.activeEffects.set(target, effects);
      if (!animation || !this.plannedAnimations.has(animation))
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
    /** Running and pending animations in the document and in the shadow roots islands and layers sit in. */
    runningAnimations() {
      const found = /* @__PURE__ */ new Set();
      const append = (animation) => {
        if (animation.playState === "running" || animation.pending || this.pausedMotion.has(animation))
          found.add(animation);
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
      return Array.from(found);
    }
    holdMotion(animation) {
      var _a, _b, _c;
      const target = (_a = animation.effect) === null || _a === void 0 ? void 0 : _a.target;
      if (!this.nativeMotionStartsAtCommit || this.pausedMotion.has(animation) || this.heldMotion.has(animation) || !target || !this.natives.some((handle) => isComposedAncestor(target, handle.el)))
        return;
      const siblings = Array.from(/* @__PURE__ */ new Set([animation, ...(_c = (_b = target.getAnimations) === null || _b === void 0 ? void 0 : _b.call(target, { subtree: true })) !== null && _c !== void 0 ? _c : []])).filter((sibling) => {
        var _a2;
        return ((_a2 = sibling.effect) === null || _a2 === void 0 ? void 0 : _a2.target) === target || animationTarget(sibling) === target;
      });
      const described = describeMotion(target, siblings.filter((sibling) => {
        var _a2;
        return !((_a2 = sibling.effect) === null || _a2 === void 0 ? void 0 : _a2.pseudoElement) && (sibling.playState === "running" || sibling.pending);
      }));
      if (!described || described.some((entry) => entry.payload.delay !== 0 || entry.payload.playbackRate <= 0))
        return;
      const start = animation.startTime;
      const session = this.transportSession;
      const held = /* @__PURE__ */ new Set();
      for (const sibling of siblings) {
        if (this.heldMotion.has(sibling) || sibling.startTime !== start || sibling.playState !== "running" && !sibling.pending)
          continue;
        sibling.pause();
        sibling.currentTime = 0;
        this.pausedMotion.add(sibling);
        this.heldMotion.add(sibling);
        held.add(sibling);
      }
      void afterNextPaint().then(() => {
        var _a2;
        if (session !== this.transportSession)
          return;
        if (!Array.from(held).some((sibling) => this.pausedMotion.has(sibling)))
          return;
        if ((_a2 = this.startingMotion) === null || _a2 === void 0 ? void 0 : _a2.animations.has(animation))
          this.startMotion(0);
        else
          this.releaseMotion(held);
      });
    }
    collectRunningEffects() {
      var _a;
      const running = [];
      for (const animation of this.runningAnimations()) {
        const impact = animationImpact(animation);
        const target = animationTarget(animation);
        if (!target || impact === "none")
          continue;
        this.watchAnimation(animation);
        const pseudo = !!((_a = animation.effect) === null || _a === void 0 ? void 0 : _a.pseudoElement);
        running.push({ target, impact, animation, pseudo });
      }
      for (const [target, effects] of this.activeEffects) {
        for (const [key, impact] of effects)
          running.push({ target, impact, key });
      }
      return running;
    }
    /**
     * Running effects that matter to composition. The runtime's own root scroll
     * wrapper moves the whole page and is followed natively.
     */
    compositionEffects() {
      return this.collectRunningEffects().filter(({ target }) => {
        var _a;
        return !((_a = target.parentElement) === null || _a === void 0 ? void 0 : _a.hasAttribute("data-ni-root-scroll-owner")) && !(document.documentElement.hasAttribute("data-ni-root-scroll-active") && target.parentElement === document.body);
      });
    }
    /**
     * Whether an effect can move an island: a layout change anywhere, or motion
     * without layout that carries an island with it, or a repaint of an ancestor,
     * which may fade it, when native applies the fade. Native follows only what it
     * is sent, so such a scene is planned again on every frame until it ends.
     */
    movesIslands(effects) {
      return effects.some((effect) => effect.impact === "global-layout" || // A pseudo-element's animation changes only its own box, and native
      // runs a described motion itself.
      !effect.pseudo && !this.planMotion.has(effect.target) && (effect.impact === "local-composition" || effect.impact === "repaint") && this.natives.some((handle) => isComposedAncestor(effect.target, handle.el)));
    }
    /**
     * The motion native can run, by the element it moves or fades. An element
     * qualifies only when every effect on it comes from an animation native can
     * reproduce: an effect known only from its event has nothing to describe.
     */
    describeMotions(effects) {
      var _a, _b;
      const motions = /* @__PURE__ */ new Map();
      const byTarget = /* @__PURE__ */ new Map();
      for (const effect of effects) {
        const list = (_a = byTarget.get(effect.target)) !== null && _a !== void 0 ? _a : [];
        list.push(effect);
        byTarget.set(effect.target, list);
      }
      for (const [target, list] of byTarget) {
        const animations = Array.from(new Set(list.flatMap((effect) => effect.animation && !effect.pseudo ? [effect.animation] : [])));
        const all = list.flatMap((effect) => effect.animation ? [effect.animation] : []);
        const explained = list.every((effect) => effect.animation !== void 0 || all.some((animation) => effect.key === `transition:${animation.transitionProperty}` || effect.key === `animation:${animation.animationName}`));
        if (!explained || animations.length === 0)
          continue;
        const entries = describeMotion(target, animations, this.nativeMotionStartsAtCommit);
        if (entries) {
          if (this.nativeMotionStartsAtCommit) {
            for (const entry of entries) {
              if (!((_b = entry.translation) === null || _b === void 0 ? void 0 : _b.anchored) && entry.animation.playState === "running" && typeof entry.animation.startTime === "number") {
                entry.payload.sampledTime = (entry.measuredAt - entry.animation.startTime) * entry.animation.playbackRate;
              }
            }
          }
          motions.set(target, entries);
        }
      }
      return motions;
    }
    /** Elements native moves with a translation only, whose paint it can cut where it is. */
    glidingTargets() {
      const glides = /* @__PURE__ */ new Set();
      for (const [target, entries] of this.planMotion) {
        if (entries.every((entry) => entry.payload.channel === "translate"))
          glides.add(target);
      }
      return glides;
    }
    /** Elements native fades through their motion, whose opacity a plan leaves out. */
    fadingTargets() {
      const fading = /* @__PURE__ */ new Set();
      for (const [target, entries] of this.planMotion) {
        if (entries.some((entry) => entry.payload.channel === "opacity"))
          fading.add(target);
      }
      return fading;
    }
    /** The motions carrying `element`, outermost first. */
    motionTargets(element) {
      if (this.planMotion.size === 0)
        return [];
      const targets = [];
      for (let current = element; current; current = composedParentElement(current)) {
        if (this.planMotion.has(current))
          targets.unshift(current);
      }
      return targets;
    }
    /** Whether native runs a fade carrying `element`, so its opacity needs no plan per frame. */
    fadedByNative(element) {
      return this.motionTargets(element).some((target) => {
        var _a;
        return (_a = this.planMotion.get(target)) === null || _a === void 0 ? void 0 : _a.some((entry) => entry.payload.channel === "opacity");
      });
    }
    /**
     * Hidden only because a fade native runs starts it at no opacity, as a
     * backdrop fading in does. It is planned from the start so native fades it in.
     */
    fadingInByNative(element) {
      if (element.children.length > 0 || !this.fadedByNative(element))
        return false;
      const parent = composedParentElement(element);
      if (parent instanceof HTMLElement && !isElementVisible(parent))
        return false;
      const style = computedStyle(element);
      return !element.hidden && style.display !== "none" && (style.visibility !== "hidden" || element.getAnimations().some((animation) => animation.transitionProperty === "visibility"));
    }
    idForMotion(element) {
      const existing = this.motionIds.get(element);
      if (existing)
        return existing;
      const id = `motion-${this.nextMotionId++}`;
      this.motionIds.set(element, id);
      return id;
    }
    /**
     * Native refused `payload` for `reason`. The islands the reason names sit out
     * the next plan and return once a layout is accepted without them; a reason
     * naming none just re-plans. Three refusals within two seconds are not a page
     * in motion, so those islands fail for good. Returns the islands to fail.
     */
    layoutRefused(payload, reason) {
      const ids = payload.components.map((component) => component.id);
      const named = ids.filter((id) => reason.includes(`'${id}'`));
      const now = performance.now();
      const strike = (key) => {
        var _a;
        const previous = this.refusals.get(key);
        if (previous && ((_a = payload.layoutSeq) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY) <= previous.seq)
          return false;
        const strikes = previous && now - previous.at < REFUSAL_WINDOW_MS ? previous.strikes + 1 : 1;
        this.refusals.set(key, { strikes, at: now, held: key !== null, reason, seq: this.layoutSequence });
        return strikes >= MAX_REFUSALS;
      };
      const failed = named.length > 0 ? named.filter(strike) : strike(null) ? ids : [];
      for (const id of failed)
        this.refusals.delete(id);
      if (failed.length > 0 && named.length === 0)
        this.refusals.delete(null);
      this.refresh();
      return failed;
    }
    /** Clears held islands once a layout without them is accepted. Returns whether any came back. */
    acceptRefusals(accepted) {
      var _a;
      let released = false;
      for (const [key, refusal] of this.refusals) {
        if (key === null) {
          this.refusals.delete(key);
        } else if (refusal.held) {
          if (((_a = accepted.layoutSeq) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY) <= refusal.seq)
            continue;
          refusal.held = false;
          released = true;
        } else if (accepted.components.some((component) => component.id === key && component.active)) {
          this.refusals.delete(key);
        }
      }
      return released;
    }
    invalidatePendingPlan() {
      this.acknowledgedSignature = "";
      this.planGeneration++;
      this.pendingSignature = null;
    }
    /** Plan requests, new animations and bounded follow frames. */
    scheduleFrame() {
      if (!this.onChange || this.transportSession.state !== "ready")
        return;
      if (this.scheduled)
        return;
      this.scheduled = true;
      requestAnimationFrame((frameTime) => {
        this.scheduled = false;
        this.runFrame(frameTime);
      });
    }
    /** One frame's work: follow what moves, and plan when the scene asks for it. */
    runFrame(frameTime) {
      var _a, _b, _c, _d;
      if (!this.onChange || this.transportSession.state !== "ready")
        return;
      if (!this.planRequested && document.visibilityState === "hidden")
        return;
      this.noteFrame(frameTime);
      this.followAnchoredHoles();
      const animations = this.runningAnimations();
      const scrolling = performance.now() - this.lastScrollAt < SCROLL_IDLE_MS;
      const fresh = [];
      for (const animation of animations) {
        if (this.plannedAnimations.has(animation))
          continue;
        if (scrolling && !this.mayReachIsland(animation)) {
          this.plannedAnimations.add(animation);
          continue;
        }
        fresh.push(animation);
      }
      const timeline = typeof ((_a = document.timeline) === null || _a === void 0 ? void 0 : _a.currentTime) === "number" ? document.timeline.currentTime : null;
      for (const animation of fresh) {
        if (startsThisFrame(animation, timeline, true))
          this.holdMotion(animation);
      }
      const started = fresh.length > 0;
      if (started)
        this.idleFollowFrames = 0;
      const follow = this.following && (this.idleFollowFrames < IDLE_FOLLOW_FRAMES || frameTime - this.lastPlanAt >= IDLE_FOLLOW_MS);
      if (!this.planRequested && !started && !follow) {
        const islands = this.natives.some((handle) => handle.canAttemptNative());
        if (this.following || islands && performance.now() < this.activeUntil || --this.watchFrames > 0)
          this.scheduleFrame();
        else if (islands && this.idleWatch === null)
          this.idleWatch = setTimeout(() => {
            this.idleWatch = null;
            this.scheduleFrame();
          }, IDLE_WATCH_MS);
        return;
      }
      const needsCreate = this.natives.some((handle) => {
        if (!handle.isActive() || !handle.canAttemptNative() || this.held.has(handle))
          return false;
        const box = handle.el.getBoundingClientRect();
        return box.bottom > -120 && box.top < window.innerHeight + 120 && box.right > -120 && box.left < window.innerWidth + 120;
      });
      if (!started && !follow && this.layoutWaiters.size === 0 && scrolling && (this.innerScrollMode === "bridge" ? !needsCreate : frameTime - this.lastPlanAt < SCROLL_PLAN_INTERVAL_MS)) {
        this.scheduleFrame();
        return;
      }
      if (this.paintWait) {
        void this.paintWait.then(this.refresh);
        return;
      }
      this.planRequested = false;
      this.lastPlanAt = frameTime;
      this.watchFrames = WATCH_FRAMES;
      this.freshAnimations = new Set(fresh);
      this.planTimeline = typeof ((_b = document.timeline) === null || _b === void 0 ? void 0 : _b.currentTime) === "number" ? document.timeline.currentTime : null;
      const paused = new Set(this.pausedMotion);
      for (const animation of animations)
        this.plannedAnimations.add(animation);
      const session = this.transportSession;
      let generation = this.planGeneration;
      const waiters = Array.from(this.layoutWaiters);
      const finishWaiters = (succeeded, error) => {
        if (session !== this.transportSession || session.state !== "ready" || generation !== this.planGeneration)
          return;
        for (const waiter of waiters) {
          if (!this.layoutWaiters.delete(waiter))
            continue;
          if (succeeded)
            waiter.resolve();
          else
            waiter.reject(error);
        }
      };
      const payload = this.resolve();
      const entering = payload.components.some((component) => component.active && component.plane === "underlay" && this.acknowledgedPlanes.get(component.id) === "overlay");
      const starting = this.startingMotion;
      const preparing = this.pausedMotion.size > 0 && starting !== null;
      if (!preparing)
        this.startMotion(entering ? 2 * this.frameInterval : 0);
      const following = this.nativeMotionStartsAtCommit && !entering && !started && !this.startingMotion;
      const resuming = this.resuming;
      this.resuming = [];
      for (const handle of Array.from(this.resumeSince.keys())) {
        if (!resuming.includes(handle))
          this.resumeSince.delete(handle);
      }
      const resume = () => {
        for (const handle of resuming) {
          this.resumeSince.delete(handle);
          if (handle.el.isConnected)
            this.presentInactive(handle, null);
        }
      };
      let signature = structuralSignature(payload, this.scrollMode);
      const unchanged = signature === ((_c = this.pendingSignature) !== null && _c !== void 0 ? _c : this.acknowledgedSignature);
      this.idleFollowFrames = this.following && unchanged ? this.idleFollowFrames + 1 : 0;
      if (!following)
        this.scheduleFrame();
      if (this.pendingSignature === null && signature === this.acknowledgedSignature) {
        this.publishScrollOffsets();
        finishWaiters(true);
        resume();
        if (this.acceptRefusals(payload))
          this.refresh();
        if (following)
          this.scheduleFrame();
        return;
      }
      if (signature === this.pendingSignature && this.pendingLayout) {
        this.publishScrollOffsets();
        void this.pendingLayout.then(() => {
          finishWaiters(true);
          resume();
        }, (error) => {
          finishWaiters(false, error);
        });
        if (following)
          this.scheduleFrame();
        return;
      }
      generation = ++this.planGeneration;
      this.pendingSignature = signature;
      const retirement = this.nativeMotionStartsAtCommit && !entering ? retirementOf(this.lastSentPayload, payload) : null;
      this.lastSentPayload = payload;
      const layoutSeq = ++this.layoutSequence;
      for (const handle of resuming) {
        if (!this.resumeSince.has(handle))
          this.resumeSince.set(handle, layoutSeq);
      }
      const sent = Object.assign(Object.assign({}, payload), { layoutSeq, offsetSeq: ++this.scrollSequence });
      this.plannedGeometry.set(layoutSeq, this.lastPlannedGeometry);
      this.plannedCanvasColor.set(layoutSeq, (_d = sent.canvasColor) !== null && _d !== void 0 ? _d : null);
      const scrollTopology = new Map((this.scrollMode === "bridge" ? sent.scrollContainers : []).map((container) => [
        container.id,
        JSON.stringify(Object.assign(Object.assign({}, container), { offsetX: 0, offsetY: 0 }))
      ]));
      this.emittedScrollTopology = scrollTopology;
      const deliver = (layout = sent) => {
        var _a2, _b2;
        if (session !== this.transportSession || generation !== this.planGeneration)
          return Promise.resolve();
        const sequence = layout.layoutSeq;
        const delivery = (_b2 = (_a2 = this.onChange) === null || _a2 === void 0 ? void 0 : _a2.call(this, layout)) !== null && _b2 !== void 0 ? _b2 : Promise.resolve();
        const ids = new Set(layout.components.map((component) => component.id));
        for (const handle of this.natives) {
          if (!ids.has(handle.islandId))
            continue;
          this.nativeHolds.set(handle, sequence);
          handle.nativeLayoutSent();
        }
        const creating = this.commandsFollowLayouts ? this.layoutApplied(layout) : null;
        return delivery.then(() => {
          var _a3, _b3, _c2, _d2;
          if (session === this.transportSession && session.state === "ready" && sequence > ((_b3 = (_a3 = this.acknowledgedScrollLayout) === null || _a3 === void 0 ? void 0 : _a3.sequence) !== null && _b3 !== void 0 ? _b3 : -1))
            this.acknowledgedScrollLayout = { sequence, topology: scrollTopology };
          if (session === this.transportSession && session.state === "ready" && sequence > this.acknowledgedPlaneSequence) {
            const planes = new Map(layout.components.filter((component) => component.active).map((component) => [component.id, component.plane]));
            const raised = Array.from(this.acknowledgedPlanes).some(([id, plane]) => plane === "underlay" && planes.get(id) !== "underlay") || Array.from(this.plannedGeometry).some(([planned2, geometry]) => planned2 < sequence && Array.from(geometry.keys()).some((id) => planes.get(id) !== "underlay"));
            this.acknowledgedPlaneSequence = sequence;
            this.acknowledgedGeometry = (_c2 = this.plannedGeometry.get(sequence)) !== null && _c2 !== void 0 ? _c2 : /* @__PURE__ */ new Map();
            for (const planned2 of this.plannedGeometry.keys()) {
              if (planned2 <= sequence)
                this.plannedGeometry.delete(planned2);
            }
            for (const planned2 of this.plannedCanvasColor.keys()) {
              if (planned2 <= sequence)
                this.plannedCanvasColor.delete(planned2);
            }
            this.acknowledgedPlanes = planes;
            this.acknowledgedCanvasColor = (_d2 = layout.canvasColor) !== null && _d2 !== void 0 ? _d2 : null;
            if (raised) {
              for (const [page, islands] of this.heldUnder) {
                const still = islands.filter((native) => this.mayShowUnder(native.handle.islandId));
                if (still.length > 0)
                  this.heldUnder.set(page, still);
                else
                  this.heldUnder.delete(page);
              }
              this.refresh();
            }
          }
          if (session !== this.transportSession)
            return;
          const created = creating !== null && creating !== void 0 ? creating : this.layoutApplied(layout);
          if (generation !== this.planGeneration) {
            if (layout === sent) {
              if (this.commandsFollowLayouts) {
                for (const [handle, since] of Array.from(this.resumeSince)) {
                  if (sequence < since)
                    continue;
                  const showing = layout.components.some((component) => component.id === handle.islandId && component.active);
                  if (!showing)
                    continue;
                  this.resumeSince.delete(handle);
                  if (handle.el.isConnected)
                    this.presentInactive(handle, null);
                }
              }
              if (session.state === "ready" && this.acceptRefusals(layout))
                this.refresh();
            }
            return;
          }
          return created;
        });
      };
      const prepare = () => {
        var _a2;
        if (session !== this.transportSession || generation !== this.planGeneration)
          return Promise.resolve();
        if (!preparing)
          return deliver();
        if (!starting || this.startingMotion !== starting || !Array.from(starting.animations).some((animation) => this.pausedMotion.has(animation) && animation.playState === "paused")) {
          signature = structuralSignature(payload, this.scrollMode);
          this.pendingSignature = signature;
          return deliver();
        }
        const held = new Set(starting.entries.map((entry) => entry.payload));
        const stationary = Object.assign(Object.assign({}, sent), { motions: (_a2 = sent.motions) === null || _a2 === void 0 ? void 0 : _a2.map((motion) => Object.assign(Object.assign({}, motion), { animations: motion.animations.map((animation) => held.has(animation) ? Object.assign(Object.assign({}, animation), { keyframes: animation.keyframes.map((frame) => Object.assign(Object.assign({}, frame), { value: animation.keyframes[0].value })) }) : animation) })) });
        return deliver(stationary).then(() => {
          if (session !== this.transportSession || generation !== this.planGeneration)
            return;
          if (this.startingMotion === starting)
            this.startMotion(0);
          sent.layoutSeq = ++this.layoutSequence;
          sent.offsetSeq = ++this.scrollSequence;
          signature = structuralSignature(payload, this.scrollMode);
          this.pendingSignature = signature;
          return deliver();
        });
      };
      if (retirement) {
        void deliver(Object.assign(Object.assign(Object.assign({}, retirement), { layoutSeq: ++this.layoutSequence, offsetSeq: ++this.scrollSequence }), this.nativePaintFence ? { fence: this.writeFence() } : {})).catch(() => void 0);
        sent.layoutSeq = ++this.layoutSequence;
        sent.offsetSeq = ++this.scrollSequence;
      }
      if (entering || this.nativeMotionStartsAtCommit) {
        const painting = (following ? afterThisFrameReachesApp() : afterNextPaint()).then(() => {
          if (this.paintWait === painting)
            this.paintWait = null;
        });
        this.paintWait = painting;
      }
      if (following)
        this.scheduleFrame();
      const apply = (this.paintWait ? this.paintWait.then(prepare) : prepare()).finally(() => {
        if (generation === this.planGeneration)
          this.releaseMotion(paused);
      });
      if (preparing) {
        const waiting = apply.then(() => void 0, () => void 0);
        this.paintWait = waiting;
        void waiting.then(() => {
          if (this.paintWait === waiting)
            this.paintWait = null;
        });
      }
      this.pendingLayout = apply;
      void apply.then(() => {
        finishWaiters(true);
      }, (error) => {
        finishWaiters(false, error);
      });
      void apply.then(() => {
        if (generation !== this.planGeneration) {
          if (session === this.transportSession)
            this.acknowledgedSignature = "";
          return;
        }
        resume();
        this.pendingSignature = null;
        this.pendingLayout = null;
        this.acknowledgedSignature = signature;
        if (this.acceptRefusals(sent))
          this.refresh();
      }).catch(() => {
        if (generation === this.planGeneration) {
          this.pendingSignature = null;
          this.pendingLayout = null;
        }
      });
    }
    buildNatives(refusedUnderlays = /* @__PURE__ */ new Set()) {
      const modalDialogs = activeModalDialogs();
      const fading = this.fadingTargets();
      for (const handle of this.natives)
        handle.reconcileObservedStyles();
      resetPaintOrderCache();
      return withSceneReadScope(() => {
        const states = this.natives.map((handle, dom) => {
          let inactiveReason = null;
          let active = handle.canAttemptNative() && isElementVisible(handle.el);
          const positionedAncestor = handle.canAttemptNative() ? fixedOrStickyAncestor(handle.el) : null;
          const discoveredScrollPath = active ? scrollPath(handle.el) : [];
          const basis = coordinateBasis(handle.el, discoveredScrollPath);
          const coordinateSpace = basis.coordinateSpace;
          const overlayOnly = handle.requiresUnobscuredSurface === true || refusedUnderlays.has(handle.el) || active && hasAncestorBackdropFilter(handle.el);
          const plane = coordinateSpace === "viewport" || overlayOnly ? "overlay" : "underlay";
          const coordinateScrollPath = basis.scrollPath;
          const modeledScrollPath = this.innerScrollMode === "unsupported" ? [] : coordinateScrollPath;
          const composition = active ? auditIslandComposition(handle.islandId, handle.el, modeledScrollPath) : [];
          const refusal = this.refusals.get(handle.islandId);
          if (refusal === null || refusal === void 0 ? void 0 : refusal.held) {
            inactiveReason = `native refused this island's last layout: ${refusal.reason}`;
            active = false;
          }
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
          const structuralIssue = composition[0];
          if (active && (structuralIssue === null || structuralIssue === void 0 ? void 0 : structuralIssue.code) === "zero_opacity") {
            active = false;
          } else if (active && structuralIssue) {
            inactiveReason = structuralIssue.message;
            active = false;
          }
          let activeScrollPath = active ? coordinateScrollPath : [];
          if (active && activeScrollPath.length > 0 && this.innerScrollMode === "unsupported") {
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
          let paintRect = null;
          if (active) {
            const bounds = basisRect(handle.el, { coordinateSpace, scrollPath: activeScrollPath });
            const viewportBounds = docRect(handle.el);
            paintRect = viewportBounds;
            visualRect = visibleRectInsideScrollPath(viewportBounds, activeScrollPath);
            const style = computedStyle(handle.el);
            const radii = cssCornerRadii(style, viewportBounds.w, viewportBounds.h);
            if (radii === null) {
              inactiveReason = "native islands require circular border-radius corners";
              active = false;
            } else {
              rect = Object.assign(Object.assign({}, bounds), { r: radii });
              const bridged = this.documentSpaceRect(rect, coordinateSpace);
              const empty = (bridged.w <= 0 || bridged.h <= 0) && isSafeBridgeRect(Object.assign(Object.assign({}, bridged), { w: 1, h: 1 }));
              if (empty || !isSafeBridgeRect(bridged)) {
                if (!empty)
                  inactiveReason = "native island geometry exceeds the shared safe coordinate or size range";
                active = false;
                rect = null;
                visualRect = null;
                paintRect = null;
              }
            }
          }
          return Object.assign({
            handle,
            el: handle.el,
            z: zIndex(handle.el),
            dom,
            active,
            interactive: handle.interactive && computedStyle(handle.el).pointerEvents !== "none" && inertAncestor(handle.el) === null,
            rect,
            visualRect,
            paintRect,
            plane,
            overlayOnly,
            coordinateSpace,
            scrollPath: activeScrollPath,
            motionDependencies: new Set(activeScrollPath),
            opacity: active ? inheritedOpacity(handle.el, fading) : 1,
            inactiveReason
          }, this.planMotion.size > 0 ? {
            movers: this.motionTargets(handle.el).filter((target) => {
              var _a;
              return (_a = this.planMotion.get(target)) === null || _a === void 0 ? void 0 : _a.some((entry) => entry.payload.channel === "translate");
            })
          } : {});
        });
        return states;
      });
    }
    // Corrects a document-space rect for the active root-scroll runway offset (see RootScrollRuntime),
    // matching what actually reaches native/gets validated. `getBoundingClientRect()`-derived rects
    // still add the live (possibly runway-inflated) window.scrollY; this subtracts that back out and
    // reintroduces the real logical page offset. A no-op outside 'document' coordinate space or
    // outside root-scroll mode, where window.scrollY was never synthetically offset to begin with.
    documentSpaceRect(rect, coordinateSpace) {
      return coordinateSpace === "document" && this.innerScrollMode === "root" ? canonicalScrollRect(Object.assign(Object.assign({}, rect), { y: round2(rect.y - window.scrollY + this.rootScroll.pageOffset()) })) : rect;
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
    gradientTint(layer, native) {
      var _a;
      if (!this.nativeAlphaGradient || !((_a = layer.overlayCutoutIssue) === null || _a === void 0 ? void 0 : _a.opaqueGradient) || native && (native.handle.requiresUnobscuredSurface || animatesAgainstCut(layer, native)))
        return null;
      return planMemo$1("alphaGradientTint", layer.el, () => {
        const stops = alphaGradientStops(layer.el, layer.rect.h);
        if (!stops)
          return null;
        const colors = [];
        for (const stop of stops) {
          const color = srgba(stop.color);
          if (!color)
            return null;
          colors.push(color);
        }
        const first = colors[0];
        if (!first || colors.some((color) => color[3] > 0 && first.slice(0, 3).some((value, i) => Math.abs(value - color[i]) > 1)))
          return null;
        return {
          color: [first[0], first[1], first[2], 1],
          alphaStops: stops.map((stop, index) => [stop.offset, colors[index][3]])
        };
      });
    }
    resolveHostPlanes(natives, layers) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const native of planned(natives, "underlay")) {
          const mustCrossWebView = this.underlayConflict(native, layers) !== null || layers.some((layer) => (layer.coordinateSpace === "viewport" || (animatesAgainst(layer, native) || this.holedAgainst(native, layer)) && isElementVisible(layer.el)) && canMoveIntoIntersection(reachFrom(native, layer), reachFrom(layer, native)) && above(native, layer)) || natives.some((other) => other !== native && other.plane === "overlay" && hasPlanGeometry(other) && canMoveIntoIntersection(native, other) && above(native, other));
          if (!mustCrossWebView)
            continue;
          native.plane = "overlay";
          changed = true;
        }
      }
      changed = true;
      while (changed) {
        changed = false;
        for (const native of planned(natives, "underlay")) {
          const webAbove = layers.some((layer) => (layer.overlayCutoutIssue !== null || animatesAgainstCut(layer, native)) && !this.gradientTint(layer, native) && isElementVisible(layer.el) && canMoveIntoIntersection(reachFrom(layer, native), reachFrom(native, layer)) && above(layer, native) && !this.opaqueWebCover(layer, native, layers));
          const underlayNativeAbove = natives.some((other) => other !== native && other.plane === "underlay" && hasPlanGeometry(other) && canMoveIntoIntersection(other, native) && above(other, native));
          if (webAbove || underlayNativeAbove)
            continue;
          native.plane = "overlay";
          changed = true;
        }
      }
    }
    /**
     * Web paint above an overlay is cut out of it as a box, so see-through paint
     * hides the island instead of blending with it, except a backdrop, which the
     * island is drawn over. Only a layer native cannot follow, such as a sticky one,
     * is refused.
     */
    detectOverlayCutoutConflicts(natives, layers) {
      for (const native of planned(natives, "overlay")) {
        if (clipsProtectedSurface(native))
          continue;
        const reaches = (layer) => !layer.translucentFill && canMoveIntoIntersection(reachFrom(layer, native), reachFrom(native, layer)) && above(layer, native) && !this.opaqueWebCover(layer, native, layers);
        const issue = layers.find((layer) => {
          var _a;
          return ((_a = layer.overlayCutoutIssue) === null || _a === void 0 ? void 0 : _a.mayMoveWithoutRefresh) === true && reaches(layer);
        });
        if (issue === null || issue === void 0 ? void 0 : issue.overlayCutoutIssue) {
          suspendNative(native, issue.overlayCutoutIssue.reason);
          continue;
        }
        if (layers.some((layer) => animatesAgainstCut(layer, native) && reaches(layer)))
          this.following = true;
        if (!native.handle.requiresUnobscuredSurface && layers.some((layer) => layer.translucentFill && !this.fadedByNative(layer.el) && animatesAgainstCut(layer, native) && canMoveIntoIntersection(reachFrom(layer, native), reachFrom(native, layer)) && above(layer, native))) {
          this.following = true;
        }
      }
      for (const native of planned(natives, "underlay")) {
        const moving = layers.some((layer) => (animatesAgainst(layer, native) || this.holedAgainst(native, layer)) && isElementVisible(layer.el) && canMoveIntoIntersection(reachFrom(native, layer), reachFrom(layer, native)) && above(native, layer));
        if (moving)
          suspendNative(native, MOVING_UNDER_UNDERLAY);
      }
    }
    /**
     * Whether native moves `native` against paint below it that the page would
     * hole for it. A hole stays where the page cut it, so an island in motion
     * native runs cannot show through one. The body is not holed when native
     * paints the page canvas.
     */
    holedAgainst(native, layer) {
      var _a;
      return movesAgainst(native, layer) && layer.cutoutIssue === null && !((_a = this.planCanvas) === null || _a === void 0 ? void 0 : _a.elements.has(layer.el));
    }
    protectedWebRegion(native, layer) {
      var _a, _b, _c, _d, _e;
      if (!above(layer, native) || !isElementVisible(layer.el) || !canMoveIntoIntersection(layer, native))
        return;
      const horizontalScroll = [document.documentElement, document.body, ...native.scrollPath, ...layer.scrollPath].some((element) => element.scrollWidth > element.clientWidth + 1);
      const positioned = fixedOrStickyAncestor(layer.el);
      const owner = layer.scrollPath[layer.scrollPath.length - 1];
      const ownerBox = owner && readBounds(owner);
      const stickyParent = positioned === null || positioned === void 0 ? void 0 : positioned.element.parentElement;
      if (!horizontalScroll && (positioned === null || positioned === void 0 ? void 0 : positioned.position) === "sticky" && positioned.element !== layer.el && native.coordinateSpace === "document" && sameCoordinatePath(layer, native) && computedStyle(positioned.element).bottom === "0px" && owner && ownerBox && stickyParent && Math.abs(ownerBox.top) <= 1 && ownerBox.height >= window.innerHeight - 1 && readBounds(stickyParent).height >= owner.scrollHeight - 1 && readBounds(positioned.element).top > native.rect.y + native.rect.h)
        return;
      if (!horizontalScroll && layer.coordinateSpace === "viewport" && layer.scrollPath.length === 0) {
        const box2 = readBounds(layer.el);
        const paintRight = box2.left + Math.max(box2.width, layer.el.scrollWidth);
        if (paintRight < readBounds(native.el).left && !((_c = (_b = (_a = layer.el).getAnimations) === null || _b === void 0 ? void 0 : _b.call(_a, { subtree: true })) !== null && _c !== void 0 ? _c : []).some((animation) => animation.playState === "running") && [layer.el, ...layer.el.querySelectorAll("*")].every((element) => {
          const style2 = computedStyle(element);
          return readBounds(element).right < readBounds(native.el).left && style2.textShadow === "none" && style2.filter === "none";
        }))
          return;
      }
      const sticky = positioned === null || positioned === void 0 ? void 0 : positioned.element;
      const style = computedStyle(sticky !== null && sticky !== void 0 ? sticky : layer.el);
      const scroller = layer.scrollPath[layer.scrollPath.length - 1];
      const scrollBox = scroller && readBounds(scroller);
      const box = sticky && readBounds(sticky);
      const color = style.backgroundColor.replace(/\s/g, "");
      if (!horizontalScroll && sticky && style.position === "sticky" && style.top === "0px" && /^rgb\(\d+,\d+,\d+\)$/.test(color) && scroller && scrollBox && box && sticky.parentElement && Math.abs(scrollBox.left) <= 1 && Math.abs(scrollBox.top) <= 1 && scrollBox.width >= window.innerWidth - 1 && scrollBox.height >= window.innerHeight - 1 && readBounds(sticky.parentElement).height >= scroller.scrollHeight - 1 && Math.abs(box.top - scrollBox.top) <= 1 && box.left <= 0 && box.right >= window.innerWidth - 1) {
        if (sticky === layer.el && !hasComplexOpaqueShape(layer.rect)) {
          return { rect: viewportRect(sticky), coordinateSpace: "viewport", scrollPath: [], el: sticky };
        }
        if (!layer.paintEscapesRect && contains(viewportRect(sticky), viewportRect(layer.el)))
          return;
      }
      const layerRadius = Math.max(...(_d = layer.rect.r) !== null && _d !== void 0 ? _d : SQUARE);
      const [, , nativeBottomRight, nativeBottomLeft] = (_e = native.rect.r) !== null && _e !== void 0 ? _e : SQUARE;
      const nativeRadius = Math.min(nativeBottomRight, nativeBottomLeft);
      if (!horizontalScroll && layerRadius > 0 && nativeRadius >= layerRadius && sameCoordinatePath(layer, native) && layer.rect.y >= native.rect.y + native.rect.h - nativeRadius && layer.rect.y < native.rect.y + native.rect.h && layer.rect.x + layerRadius <= native.rect.x + nativeRadius && layer.rect.x + layer.rect.w - layerRadius >= native.rect.x + native.rect.w - nativeRadius && !layer.paintEscapesRect && colorAlpha(computedStyle(layer.el).backgroundColor) === 1)
        return Object.assign(Object.assign({}, layer), { rect: Object.assign(Object.assign({}, layer.rect), { r: SQUARE }) });
      if (hasComplexOpaqueShape(layer.rect) || layer.cutoutIssue !== null || layer.overlayCutoutIssue !== null)
        return null;
      if (sameCoordinatePath(layer, native)) {
        if (!intersects(layer.rect, native.rect))
          return;
        return edgeStrip(layer.rect, native.rect) ? layer : null;
      }
      const viewport = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
      if (!horizontalScroll && layer.coordinateSpace === "viewport" && layer.scrollPath.length === 0 && native.coordinateSpace === "document" && edgeStrip(layer.rect, viewport))
        return layer;
      return null;
    }
    protectedCoveredByAncestor(native, layer, layers) {
      return !layer.paintEscapesRect && layers.some((cover) => cover !== layer && isComposedAncestor(cover.el, layer.el) && stationaryCoordinatePaths(cover, layer) && opaqueContainsRect(cover.visualRect, layer.visualRect) && !!this.protectedWebRegion(native, cover));
    }
    opaqueWebCover(layer, native, layers) {
      return layers.some((cover) => {
        var _a, _b;
        const opaque = this.opaqueLayerRect(cover);
        return cover !== layer && // A sticky cover is cut where native moves it, and covers only what
        // moves with the same sticky box.
        (cover.cutoutIssue === null || !!cover.sticky) && !animatesAgainst(cover, native) && above(cover, native) && isElementVisible(cover.el) && (opaque !== null && ((_a = cover.sticky) !== null && _a !== void 0 ? _a : null) === ((_b = layer.sticky) !== null && _b !== void 0 ? _b : null) && stationaryCoordinatePaths(cover, layer) && opaqueContainsRect(opaque, layer.visualRect) && // Paint that can leave the layer's box stays inside the opaque surface
        // only under a clipping ancestor.
        (!reachFrom(layer, native).paintEscapesRect || isComposedAncestor(cover.el, layer.el) && computedStyle(cover.el).overflow === "hidden") || this.stickyCoverClipsDescendant(cover, layer));
      });
    }
    opaqueLayerRect(layer) {
      var _a;
      const height = layer.overlayCutoutIssue === null ? layer.visualRect.h : layer.overlayCutoutIssue.opaqueGradient ? opaqueGradientDepth(layer.el, layer.visualRect.h) : null;
      if (height === null)
        return null;
      const [topLeft, topRight] = (_a = layer.visualRect.r) !== null && _a !== void 0 ? _a : SQUARE;
      return height >= layer.visualRect.h ? layer.visualRect : Object.assign(Object.assign({}, layer.visualRect), { h: height, r: [topLeft, topRight, 0, 0] });
    }
    /**
     * The whole nested aperture stays inside the opaque part of its sticky cover:
     * all of it, or the top of a bar that fades out below.
     */
    stickyCoverClipsDescendant(cover, layer) {
      var _a, _b;
      const scroller = layer.scrollPath[cover.scrollPath.length];
      const opaque = this.opaqueLayerRect(cover);
      if (opaque === null || !cover.sticky || layer.overlayCutoutIssue !== UNFOLLOWED_STICKY || layer.paintEscapesRect || movesAgainst(layer, cover) || animatesAgainst(layer, cover) || cover.coordinateSpace !== layer.coordinateSpace || !scroller || !cover.scrollPath.every((element, index) => element === layer.scrollPath[index]) || !isComposedAncestor(cover.el, scroller) || !isComposedAncestor(scroller, layer.el) || ((_a = fixedOrStickyAncestor(cover.el)) === null || _a === void 0 ? void 0 : _a.element) !== ((_b = fixedOrStickyAncestor(layer.el)) === null || _b === void 0 ? void 0 : _b.element) || !sameCoordinatePath(cover, coordinateBasis(scroller)) || touchable(layer) && !touchable(cover))
        return false;
      const style = computedStyle(scroller);
      if (!["hidden", "clip", "auto", "scroll"].includes(style.overflowX) || !["hidden", "clip", "auto", "scroll"].includes(style.overflowY) || !["", "0", "0px"].includes(style.getPropertyValue("overflow-clip-margin").trim()))
        return false;
      for (let node = scroller; node && node !== cover.el; node = composedParentElement(node)) {
        const inherited = computedStyle(node);
        if (establishesFixedContainingBlock(node) || Number.parseFloat(inherited.opacity) !== 1 || paintEscapesBorderBox(node) || hasOuterDecoration(inherited) || !["", "0", "0px"].includes(inherited.getPropertyValue("overflow-clip-margin").trim()))
          return false;
      }
      const aperture = scrollContainerRect(scroller);
      return aperture !== null && opaqueContainsRect(opaque, aperture);
    }
    resolveWebUnderlays(natives, layers) {
      var _a, _b, _c;
      const overlayNatives = planned(natives, "overlay");
      if (overlayNatives.length === 0)
        return;
      const firstOverlay = overlayNatives[0];
      const boundedRect = (rect) => rect != null && [rect.x, rect.y, rect.w, rect.h, rect.x + rect.w, rect.y + rect.h].every(Number.isFinite) && rect.w > 0 && rect.h > 0;
      const uniformPath = firstOverlay !== void 0 && overlayNatives.every((native) => {
        var _a2, _b2, _c2;
        return !native.paintEscapesRect && ((_b2 = (_a2 = native.movers) === null || _a2 === void 0 ? void 0 : _a2.length) !== null && _b2 !== void 0 ? _b2 : 0) === 0 && ((_c2 = fixedOrStickyAncestor(native.el)) === null || _c2 === void 0 ? void 0 : _c2.position) !== "sticky" && boundedRect(native.paintRect) && sameCoordinatePath(firstOverlay, native);
      });
      const boundedLayers = [];
      const fallbackLayers = [];
      if (uniformPath && firstOverlay) {
        for (const layer of layers) {
          if (!layer.sticky && !layer.paintEscapesRect && ((_b = (_a = layer.movers) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) === 0 && ((_c = fixedOrStickyAncestor(layer.el)) === null || _c === void 0 ? void 0 : _c.position) !== "sticky" && boundedRect(layer.paintRect) && sameCoordinatePath(firstOverlay, layer)) {
            boundedLayers.push(layer);
          } else {
            fallbackLayers.push(layer);
          }
        }
      }
      const useBoundedScan = boundedLayers.length > 0;
      let maxHeight = 0;
      if (useBoundedScan) {
        boundedLayers.sort((left, right) => left.paintRect.y - right.paintRect.y);
        for (const layer of boundedLayers)
          maxHeight = Math.max(maxHeight, layer.paintRect.h);
      }
      const needsWebAboveLayer = (layer, native) => (layer.overlayCutoutIssue !== null || animatesAgainstCut(layer, native)) && !this.gradientTint(layer, native) && canMoveIntoIntersection(reachFrom(layer, native), reachFrom(native, layer)) && above(layer, native) && !this.opaqueWebCover(layer, native, layers);
      for (const native of overlayNatives) {
        let needsWebAbove = false;
        if (useBoundedScan) {
          let low = 0;
          let high = boundedLayers.length;
          while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (boundedLayers[middle].paintRect.y + maxHeight <= native.paintRect.y)
              low = middle + 1;
            else
              high = middle;
          }
          const bottom = native.paintRect.y + native.paintRect.h;
          for (let index = low; index < boundedLayers.length && boundedLayers[index].paintRect.y < bottom; index++) {
            if (needsWebAboveLayer(boundedLayers[index], native)) {
              needsWebAbove = true;
              break;
            }
          }
          if (!needsWebAbove)
            needsWebAbove = fallbackLayers.some((layer) => needsWebAboveLayer(layer, native));
        } else {
          needsWebAbove = layers.some((layer) => needsWebAboveLayer(layer, native));
        }
        if (!needsWebAbove)
          continue;
        const group = /* @__PURE__ */ new Set([native]);
        for (const upper of group) {
          for (const lower of natives) {
            if (hasPlanGeometry(lower) && lower.plane === "overlay" && canMoveIntoIntersection(upper, lower) && above(upper, lower))
              group.add(lower);
          }
        }
        const safe = Array.from(group).every((candidate) => !candidate.overlayOnly && this.underlayConflict(candidate, layers) === null && !candidate.scrollPath.some((element) => this.rootScroll.isRouted(element)) && layers.every((layer) => !canMoveIntoIntersection(reachFrom(candidate, layer), reachFrom(layer, candidate)) || (above(candidate, layer) ? !animatesAgainst(layer, candidate) && !this.holedAgainst(candidate, layer) && (stationaryCoordinatePaths(candidate, layer) || scrollingHoleCarries(candidate, layer)) : auditWebLayerCutoutComposition(layer.el, layer.scrollPath, true, layer.coordinateSpace === "viewport", true, false, candidate.el) === null)));
        if (safe)
          for (const candidate of group)
            candidate.plane = "underlay";
      }
    }
    /**
     * How a layer moves with the sticky box it sits in, or null when native cannot
     * follow it: a scroller between them, a box stuck to a viewport it does not
     * scroll with, or insets that are not pixels.
     */
    stickyMotion(el, basis) {
      var _a;
      const box = fixedOrStickyAncestor(el);
      if ((box === null || box === void 0 ? void 0 : box.position) !== "sticky")
        return null;
      const boxBasis = coordinateBasis(box.element);
      if (boxBasis.coordinateSpace !== basis.coordinateSpace || !sameScrollPath(boxBasis.scrollPath, basis.scrollPath)) {
        return null;
      }
      let motion = this.stickyBoxes.get(box.element);
      if (motion === void 0) {
        motion = this.measureStickyBox(box.element, boxBasis);
        this.stickyBoxes.set(box.element, motion);
      }
      return motion && motion.scroller === ((_a = basis.scrollPath[basis.scrollPath.length - 1]) !== null && _a !== void 0 ? _a : null) ? motion : null;
    }
    measureStickyBox(box, basis) {
      var _a;
      const scroller = (_a = independentScrollContainers(box)[0]) !== null && _a !== void 0 ? _a : null;
      const parent = composedParentElement(box);
      if (!parent || scroller === null && basis.coordinateSpace !== "document")
        return null;
      const style = computedStyle(box);
      const inset = (value) => value === "auto" ? void 0 : /^-?[\d.]+px$/.test(value) ? Number.parseFloat(value) : null;
      const insets = {
        top: inset(style.top),
        right: inset(style.right),
        bottom: inset(style.bottom),
        left: inset(style.left)
      };
      if (Object.values(insets).some((value) => value === null))
        return null;
      const current = basisRect(box, basis);
      const natural = this.inFlow(box, () => basisRect(box, basis));
      const parentBox = readBounds(parent);
      const parentStyle = computedStyle(parent);
      const edge = (name) => Number.parseFloat(parentStyle.getPropertyValue(name)) || 0;
      const boundsDoc = parent === scroller ? {
        x: parentBox.left + window.scrollX + parent.clientLeft - parent.scrollLeft,
        y: parentBox.top + window.scrollY + parent.clientTop - parent.scrollTop,
        w: parent.scrollWidth,
        h: parent.scrollHeight
      } : {
        x: parentBox.left + window.scrollX + edge("border-left-width") + edge("padding-left"),
        y: parentBox.top + window.scrollY + edge("border-top-width") + edge("padding-top"),
        w: parentBox.width - edge("border-left-width") - edge("border-right-width") - edge("padding-left") - edge("padding-right"),
        h: parentBox.height - edge("border-top-width") - edge("border-bottom-width") - edge("padding-top") - edge("padding-bottom")
      };
      const toBasis = (rect) => rectInScrollPathCoordinates(basis.coordinateSpace === "viewport" ? Object.assign(Object.assign({}, rect), { x: rect.x - window.scrollX, y: rect.y - window.scrollY }) : rect, basis.scrollPath);
      const safe = (rect) => ({
        x: round2(rect.x),
        y: round2(rect.y),
        w: round2(Math.max(rect.w, 0)),
        h: round2(Math.max(rect.h, 0))
      });
      return {
        scroller,
        natural,
        bounds: safe(toBasis(boundsDoc)),
        shift: { x: round2(current.x - natural.x), y: round2(current.y - natural.y) },
        insets: Object.fromEntries(Object.entries(insets).filter(([, value]) => value !== void 0)),
        reach: boundsDoc
      };
    }
    /**
     * Reads `read` with the box back in flow, then drops this service's own
     * style records so the measurement is not taken for a page change.
     */
    inFlow(box, read) {
      var _a, _b;
      const hadStyle = box.hasAttribute("style");
      const value = box.style.getPropertyValue("position");
      const priority = box.style.getPropertyPriority("position");
      const scrollers = independentScrollContainers(box);
      if (document.scrollingElement)
        scrollers.push(document.scrollingElement);
      const offsets = scrollers.map((element) => [element.scrollLeft, element.scrollTop]);
      box.style.setProperty("position", "static", "important");
      try {
        const previous = sceneReadScope;
        sceneReadScope = null;
        try {
          return withCompositionReadScope(() => withoutBoundsReadScope(read));
        } finally {
          sceneReadScope = previous;
        }
      } finally {
        if (value)
          box.style.setProperty("position", value, priority);
        else
          box.style.removeProperty("position");
        if (!hadStyle && box.getAttribute("style") === "")
          box.removeAttribute("style");
        scrollers.forEach((element, index) => {
          const [left, top] = offsets[index];
          if (element.scrollLeft !== left)
            element.scrollLeft = left;
          if (element.scrollTop !== top)
            element.scrollTop = top;
        });
        const pending = ((_b = (_a = this.mutationObserver) === null || _a === void 0 ? void 0 : _a.takeRecords()) !== null && _b !== void 0 ? _b : []).filter((record) => record.target !== box || record.attributeName !== "style");
        if (pending.length > 0)
          queueMicrotask(() => this.handleDomMutations(pending));
      }
    }
    /** `effects` are running transitions and animations; see `LayerState.movers` and `LayerState.animators`. */
    buildLayers(effects = []) {
      var _a, _b, _c;
      this.stickyBoxes.clear();
      const under = (impact, element) => {
        return effects.filter((effect) => (impact === null ? effect.impact !== "global-layout" : effect.impact === impact) && isComposedAncestor(effect.target, element)).map((effect) => effect.target);
      };
      const moves = (element) => under("local-composition", element);
      const animates = (element) => under(null, element);
      const glides = this.glidingTargets();
      const cutAnimates = (element) => effects.filter((effect) => effect.impact !== "global-layout" && (effect.pseudo || !glides.has(effect.target)) && isComposedAncestor(effect.target, element)).map((effect) => effect.target);
      const explicitElements = new Set(this.layers.map((layer) => layer.el));
      const layers = this.layers.filter((layer) => layer.el.isConnected && (isElementVisible(layer.el) || this.fadingInByNative(layer.el))).map((layer, dom2) => {
        var _a2, _b2, _c2;
        const style = computedStyle(layer.el);
        const positionedAncestor = fixedOrStickyAncestor(layer.el);
        const basis = coordinateBasis(layer.el);
        const { coordinateSpace, scrollPath: layerScrollPath } = basis;
        const allowFixedPosition = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "fixed";
        const sticky = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" ? this.stickyMotion(layer.el, basis) : null;
        const box = docRect(layer.el);
        const radius = cssCornerRadii(style, box.w, box.h);
        const wholeLayerIssue = auditWebLayerCutoutComposition(layer.el, layerScrollPath, false, allowFixedPosition);
        const backgroundPaint = layer.el.children.length > 0 && (radius === null || wholeLayerIssue !== null || hasOuterDecoration(style)) ? (_b2 = (_a2 = this.runtimeBackgrounds.get(layer.el)) === null || _a2 === void 0 ? void 0 : _a2.source) !== null && _b2 !== void 0 ? _b2 : separableBackgroundPaint(style) : null;
        const overlayClassification = automaticWebLayerCutoutIssue(layer.el, (_c2 = layerScrollPath[layerScrollPath.length - 1]) !== null && _c2 !== void 0 ? _c2 : null, allowFixedPosition, true, true);
        return {
          el: layer.el,
          z: zIndex(layer.el),
          dom: dom2,
          rect: Object.assign(Object.assign({}, basisRect(layer.el, basis)), { r: radius !== null && radius !== void 0 ? radius : SQUARE }),
          visualRect: Object.assign(Object.assign({}, box), { r: radius !== null && radius !== void 0 ? radius : SQUARE }),
          paintRect: sticky ? union(box, sticky.reach) : box,
          sticky,
          paintEscapesRect: paintEscapesBorderBox(layer.el),
          movers: moves(layer.el),
          animators: animates(layer.el),
          cutAnimators: cutAnimates(layer.el),
          translucentFill: isTranslucentFill(layer.el, this.fadedByNative(layer.el)),
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
          } : (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" && !sticky ? UNFOLLOWED_STICKY : overlayClassification
        };
      }).filter((layer) => hasArea(layer.rect));
      if (!this.compositionEnabled || this.natives.length === 0)
        return layers;
      const nativeElements = new Set(this.natives.map((native) => native.el));
      const bodyPaintsCanvas = !this.runtimeBackgrounds.has(document.documentElement) && bodyBackgroundPropagates();
      const nativeBounds = this.natives.filter((native) => native.el.isConnected && (isElementVisible(native.el) || this.fadingInByNative(native.el))).map((native) => {
        const basis = coordinateBasis(native.el);
        const { coordinateSpace, scrollPath: nativeScrollPath } = basis;
        const rect = basisRect(native.el, basis);
        return {
          el: native.el,
          z: zIndex(native.el),
          dom: 0,
          rect,
          visualRect: docRect(native.el),
          paintRect: docRect(native.el),
          paintEscapesRect: false,
          coordinateSpace,
          scrollPath: nativeScrollPath
        };
      });
      let dom = layers.length;
      for (const element of this.automaticLayerCandidates()) {
        if (!element.isConnected || explicitElements.has(element) || nativeElements.has(element) || hasComposedAncestorIn(element, nativeElements) || !(isElementVisible(element) || this.fadingInByNative(element))) {
          continue;
        }
        const positionedAncestor = fixedOrStickyAncestor(element);
        const basis = coordinateBasis(element);
        const { coordinateSpace, scrollPath: layerScrollPath } = basis;
        const allowFixedPosition = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "fixed";
        const runtimeBackground = this.runtimeBackgrounds.get(element);
        const sourceBackground = (_a = runtimeBackground === null || runtimeBackground === void 0 ? void 0 : runtimeBackground.source) !== null && _a !== void 0 ? _a : separableBackgroundPaint(computedStyle(element));
        const isViewportRoot = element === document.body || element === document.documentElement;
        const paintsDocumentCanvas = element === document.documentElement || element === document.body && bodyPaintsCanvas;
        const backgroundPaint = sourceBackground !== null && (element.children.length > 0 || isViewportRoot) ? sourceBackground : null;
        const scroller = (_b = layerScrollPath[layerScrollPath.length - 1]) !== null && _b !== void 0 ? _b : null;
        const known = this.automaticLayerClassifications.get(element);
        const classification = (known === null || known === void 0 ? void 0 : known.scroller) === scroller && geometryHolds(known.facts) ? known : void 0;
        const cached = classification === null || classification === void 0 ? void 0 : classification.issue;
        let issue;
        if (backgroundPaint !== null) {
          issue = auditWebLayerCutoutComposition(element, layerScrollPath, true, allowFixedPosition);
        } else if (cached === void 0) {
          const recorded = recordGeometry(() => automaticWebLayerCutoutIssue(element, scroller, allowFixedPosition));
          issue = recorded.value;
          this.automaticLayerClassifications.set(element, {
            scroller,
            issue: issue === void 0 ? false : issue,
            facts: recorded.facts
          });
        } else {
          issue = cached === false ? void 0 : cached;
        }
        if (issue === void 0)
          continue;
        const visualRect = paintsDocumentCanvas ? documentCanvasRect() : docRect(element);
        const rect = paintsDocumentCanvas ? visualRect : basisRect(element, { coordinateSpace, scrollPath: layerScrollPath });
        const sticky = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" ? this.stickyMotion(element, basis) : null;
        const reach = {
          rect,
          visualRect,
          paintRect: sticky ? union(visualRect, sticky.reach) : visualRect,
          paintEscapesRect: paintEscapesBorderBox(element),
          movers: moves(element),
          animators: animates(element),
          cutAnimators: cutAnimates(element),
          coordinateSpace,
          scrollPath: layerScrollPath,
          sticky
        };
        const layerViewport = scrollPathViewport(layerScrollPath);
        if (!hasArea(rect) || !nativeBounds.some((native) => canMoveIntoIntersection(reachFrom(reach, native), native) || layerViewport !== null && intersects(layerViewport, native.visualRect))) {
          continue;
        }
        const entry = this.automaticLayerClassifications.get(element);
        const current = (entry === null || entry === void 0 ? void 0 : entry.scroller) === scroller ? entry : void 0;
        let overlay = (current === null || current === void 0 ? void 0 : current.overlay) !== void 0 && geometryHolds((_c = current.overlayFacts) !== null && _c !== void 0 ? _c : []) ? current.overlay : void 0;
        if (overlay === void 0) {
          const strict = recordGeometry(() => automaticWebLayerCutoutIssue(element, scroller, allowFixedPosition, true, true));
          overlay = strict.value === void 0 ? false : strict.value;
          if (current) {
            current.overlay = overlay;
            current.overlayFacts = strict.facts;
          }
        }
        const overlayClassification = overlay === false ? void 0 : overlay;
        const overlayCutoutIssue = overlayClassification === void 0 ? {
          reason: "web paint above an overlay island must be opaque across its bounded box",
          mayMoveWithoutRefresh: false
        } : (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" && !sticky ? UNFOLLOWED_STICKY : overlayClassification;
        const radius = paintsDocumentCanvas ? SQUARE : cssCornerRadii(computedStyle(element), rect.w, rect.h);
        layers.push(Object.assign(Object.assign({}, reach), { el: element, z: zIndex(element), dom: dom++, rect: Object.assign(Object.assign({}, rect), { r: radius !== null && radius !== void 0 ? radius : SQUARE }), visualRect: Object.assign(Object.assign({}, visualRect), { r: radius !== null && radius !== void 0 ? radius : SQUARE }), translucentFill: isTranslucentFill(element, this.fadedByNative(element)), backgroundPaint, cutoutIssue: radius === null ? {
          reason: "automatically detected web surfaces require a uniform pixel border-radius",
          mayMoveWithoutRefresh: false
        } : issue, overlayCutoutIssue }));
      }
      return layers;
    }
    detectBackgroundPaintConflicts(natives, layers) {
      var _a;
      for (const layer of layers) {
        if (!layer.backgroundPaint || this.scrollerPaint.has(layer.el))
          continue;
        const style = computedStyle(layer.el);
        const backgroundClips = style.backgroundClip.split(",").map((value) => value.trim()).filter(Boolean);
        const backgroundClip = (_a = backgroundClips[backgroundClips.length - 1]) !== null && _a !== void 0 ? _a : "border-box";
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.visualRect || !intersects(native.visualRect, layer.visualRect) || !above(native, layer)) {
            continue;
          }
          if (canClipLayerAsUnit(layer, native.handle.el))
            continue;
          const unsafe = backgroundClip !== "border-box" || directTextIntersects(layer.el, native.visualRect) || hasVisiblePseudoElement(layer.el, true) || /\binset\b/i.test(style.boxShadow) || style.boxShadow !== "none" && style.boxShadow !== "" && !contains(layer.visualRect, native.visualRect) || !borderContains(layer.el, native.visualRect);
          if (!unsafe)
            continue;
          native.inactiveReason = "overlapping web paint cannot be separated from its background";
          native.active = false;
          native.rect = null;
          native.visualRect = null;
        }
      }
    }
    underlayConflict(native, layers) {
      var _a;
      if (!this.compositionEnabled || !native.active || !native.rect || !native.visualRect)
        return null;
      for (const layer of layers) {
        const issue = (_a = layer.cutoutIssue) !== null && _a !== void 0 ? _a : !isSafeBridgeRect(layer.rect) ? {
          reason: "opaque web surface geometry exceeds the shared safe coordinate or size range",
          mayMoveWithoutRefresh: false
        } : null;
        if (!issue || !issue.mayMoveWithoutRefresh && !intersects(native.visualRect, layer.visualRect) || !above(native, layer)) {
          continue;
        }
        const covered = layers.some((cover) => cover !== layer && cover.cutoutIssue === null && !cover.translucentFill && // Few layers contain another, so the boxes are compared first.
        opaqueContainsRect(cover.visualRect, layer.visualRect) && isElementVisible(cover.el) && above(cover, native));
        if (covered)
          continue;
        if (isComposedAncestor(layer.el, native.el) && !paintsUnderIsland(layer.el, native.el, native.visualRect, this.scrollerPaint)) {
          continue;
        }
        return issue.reason;
      }
      return null;
    }
    detectLayerCoordinateConflicts(natives, layers) {
      for (const native of planned(natives, "underlay")) {
        const reason = this.underlayConflict(native, layers);
        if (reason !== null)
          suspendNative(native, reason);
      }
    }
    resolveMotionDependencies(natives, layers) {
      for (const native of natives) {
        native.motionDependencies = new Set(native.scrollPath);
        if (!hasPlanGeometry(native))
          continue;
        for (const layer of layers) {
          if (sameCoordinatePath(layer, native) || !pathsMayCross(native.paintRect, native.scrollPath, layer.paintRect, layer.scrollPath)) {
            continue;
          }
          addSymmetricPathDifference(native.motionDependencies, native.scrollPath, layer.scrollPath);
        }
        for (const other of natives) {
          if (other === native || !hasPlanGeometry(other) || sameCoordinatePath(other, native) || !pathsMayCross(native.paintRect, native.scrollPath, other.paintRect, other.scrollPath)) {
            continue;
          }
          addSymmetricPathDifference(native.motionDependencies, native.scrollPath, other.scrollPath);
        }
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
      if (element.hasAttribute("data-ni-runtime-clip")) {
        element.removeAttribute("data-ni-runtime-clip");
        this.recordRuntimePaintAttribute(element, "data-ni-runtime-clip");
      }
      this.runtimePaintStyles.set(element, element.style.cssText);
      this.runtimeClips.delete(element);
      resetPaintOrderCache();
    }
    releaseRuntimeBackground(element) {
      this.scrollerPaint.delete(element);
      this.paneColors.delete(element);
      const state = this.runtimeBackgrounds.get(element);
      if (!state)
        return;
      for (const property of BACKGROUND_PROPERTIES) {
        if (element.style.getPropertyValue(property) !== state.applied.get(property) || element.style.getPropertyPriority(property) !== "")
          continue;
        const original = state.original.get(property);
        if (original === null || original === void 0 ? void 0 : original.value) {
          element.style.setProperty(property, original.value, original.priority);
        } else {
          element.style.removeProperty(property);
        }
      }
      if (element.hasAttribute("data-ni-runtime-background")) {
        element.removeAttribute("data-ni-runtime-background");
        this.recordRuntimePaintAttribute(element, "data-ni-runtime-background");
      }
      this.runtimePaintStyles.set(element, element.style.cssText);
      finishBackgroundTransitions(element);
      this.runtimeBackgrounds.delete(element);
    }
    releaseRuntimeBackgrounds() {
      for (const element of this.runtimeBackgrounds.keys())
        this.releaseRuntimeBackground(element);
      this.backgroundSourcesDirty = false;
    }
    releaseRuntimePaint() {
      this.anchoredHoles = [];
      for (const element of this.runtimeClips.keys())
        this.releaseRuntimeClip(element);
      this.releaseRuntimeBackgrounds();
      this.desiredPaint = /* @__PURE__ */ new Map();
      this.heldUnder.clear();
      this.pageHandoffs.clear();
    }
    /**
     * Writes a desired background. False, and released, when an authored style overrides it
     * or the background cannot be written with holes.
     */
    writeBackground(element, background) {
      let state = this.runtimeBackgrounds.get(element);
      if (!state) {
        state = {
          original: new Map(BACKGROUND_PROPERTIES.map((property) => [
            property,
            { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }
          ])),
          applied: /* @__PURE__ */ new Map(),
          source: background.source
        };
        this.runtimeBackgrounds.set(element, state);
      }
      const values = backgroundValues(background);
      if (!values)
        return false;
      for (const [property, value] of values) {
        if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== "") {
          element.style.setProperty(property, value);
        }
      }
      state.applied = new Map(BACKGROUND_PROPERTIES.map((property) => [property, element.style.getPropertyValue(property)]));
      if (!element.hasAttribute("data-ni-runtime-background")) {
        element.setAttribute("data-ni-runtime-background", "");
        this.recordRuntimePaintAttribute(element, "data-ni-runtime-background");
      }
      this.runtimePaintStyles.set(element, element.style.cssText);
      finishBackgroundTransitions(element);
      const applied = computedStyle(element);
      const transparent = applied.backgroundColor === "transparent" || applied.backgroundColor === "rgba(0, 0, 0, 0)";
      const image = values.get("background-image");
      if (transparent && (image === "none" ? applied.backgroundImage === "none" : applied.backgroundImage !== "" && applied.backgroundImage !== "none"))
        return true;
      this.releaseRuntimeBackground(element);
      this.rejectedBackgrounds.add(element);
      return false;
    }
    /** Writes a desired clip. False, and released, when an authored mask overrides it. */
    writeClip(element, clip) {
      const values = clipValues(clip);
      let state = this.runtimeClips.get(element);
      if (!state) {
        state = {
          kind: clip.kind,
          original: new Map(Array.from(values.keys(), (property) => [
            property,
            { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }
          ])),
          applied: /* @__PURE__ */ new Map()
        };
        this.runtimeClips.set(element, state);
      }
      let changed = false;
      for (const [property, value] of values) {
        if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== "") {
          element.style.setProperty(property, value);
          changed = true;
        }
      }
      if (changed)
        resetPaintOrderCache();
      state.applied = new Map(Array.from(values.keys(), (property) => [property, element.style.getPropertyValue(property)]));
      if (!element.hasAttribute("data-ni-runtime-clip")) {
        element.setAttribute("data-ni-runtime-clip", "");
        this.recordRuntimePaintAttribute(element, "data-ni-runtime-clip");
      }
      this.runtimePaintStyles.set(element, element.style.cssText);
      if (clip.kind === "mask" && !runtimeOwnsMask(element, computedStyle(element))) {
        this.releaseRuntimeClip(element);
        this.rejectedMasks.set(element, maskStyleKey(element));
        return false;
      }
      return true;
    }
    /** See `ScrollingHoles`. Islands whose paint cannot be moved are suspended. */
    planScrollingHoles(natives, layers, relocatedCanvas) {
      var _a, _b;
      const plan = { scrollports: /* @__PURE__ */ new Map(), backgrounds: /* @__PURE__ */ new Map() };
      const groups = /* @__PURE__ */ new Map();
      const refuse = (native) => {
        if (!native.holding)
          suspendNative(native, "a hole cut in web paint cannot follow the scroller that moves this island");
      };
      for (const layer of layers) {
        if (relocatedCanvas.has(layer.el))
          continue;
        const candidates = new Set(knockoutCandidates(natives, layer).map(({ native }) => native));
        if (layer.cutoutIssue === null) {
          for (const native of planned(natives, "underlay")) {
            if (scrollingHoleCarries(native, layer) && canMoveIntoIntersection(reachFrom(native, layer), reachFrom(layer, native)) && above(native, layer))
              candidates.add(native);
          }
        }
        for (const native of candidates) {
          if (stationaryCoordinatePaths(native, layer))
            continue;
          const scroller = native.scrollPath[native.scrollPath.length - 1];
          if (scroller)
            groups.set(scroller, ((_a = groups.get(scroller)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Set()).add(native));
          else
            refuse(native);
        }
      }
      for (const [scroller, group] of groups) {
        const basis = coordinateBasis(scroller);
        const documentPort = scrollContainerRect(scroller);
        const scrollport = documentPort && basis.coordinateSpace === "viewport" ? Object.assign(Object.assign({}, documentPort), { x: round2(documentPort.x - window.scrollX), y: round2(documentPort.y - window.scrollY) }) : documentPort;
        const islands = Array.from(group).filter((native) => native.active);
        const ownLayer = layers.find((layer) => layer.el === scroller);
        const outside = layers.filter((layer) => layer.el !== scroller && !relocatedCanvas.has(layer.el) && isComposedAncestor(layer.el, scroller) && layer.backgroundPaint !== null);
        let ownPaint = this.scrollerPaint.get(scroller);
        if (ownPaint === void 0 || !this.runtimeBackgrounds.has(scroller)) {
          const own = computedStyle(scroller);
          ownPaint = own.backgroundImage === "none" ? own.backgroundColor : null;
          this.scrollerPaint.set(scroller, ownPaint);
        }
        const color = scrollport && ownPaint !== null ? compositeColor([
          ...outside.slice().sort((left, right) => comparePaintOrder(left.el, right.el)).map((layer) => {
            var _a2, _b2;
            return (_b2 = (_a2 = layer.backgroundPaint) === null || _a2 === void 0 ? void 0 : _a2.color) !== null && _b2 !== void 0 ? _b2 : "";
          }),
          ownPaint
        ]) : null;
        const movable = scrollport !== null && color !== null && islands.every((native) => native.coordinateSpace === basis.coordinateSpace && sameScrollPath(native.scrollPath.slice(0, -1), basis.scrollPath)) && outside.every((layer) => {
          var _a2;
          const shown = visibleScrollport(scroller, scrollport, basis.coordinateSpace);
          const cut = shown && rectInScrollPathCoordinates(shown, layer.scrollPath);
          return cut !== null && ((_a2 = layer.backgroundPaint) === null || _a2 === void 0 ? void 0 : _a2.image) === "none" && staticallyAbove(layer, basis) && layer.rect.x <= cut.x + 0.5 && layer.rect.y <= cut.y + 0.5 && layer.rect.x + layer.rect.w >= cut.x + cut.w - 0.5 && layer.rect.y + layer.rect.h >= cut.y + cut.h - 0.5;
        }) && // Its own background holds these holes, so none can be cut in it for islands outside it.
        !(ownLayer && knockoutCandidates(natives, ownLayer).some(({ native }) => stationaryCoordinatePaths(native, ownLayer))) && // Paint under the scroller that is not moved into it would be covered.
        !layers.some((layer) => layer.el !== scroller && !isComposedAncestor(layer.el, scroller) && !isComposedAncestor(scroller, layer.el) && comparePaintOrder(layer.el, scroller) < 0 && isElementVisible(layer.el) && documentPort !== null && intersects(layer.visualRect, documentPort));
        if (!movable || scrollport === null || color === null) {
          for (const native of islands)
            refuse(native);
          continue;
        }
        for (const layer of outside) {
          const hole = Object.assign(Object.assign({}, rectInScrollPathCoordinates(scrollport, layer.scrollPath)), { r: scrollport.r });
          plan.scrollports.set(layer.el, [...(_b = plan.scrollports.get(layer.el)) !== null && _b !== void 0 ? _b : [], { hole, islands }]);
        }
        const origin = rectInScrollPathCoordinates(scrollport, basis.scrollPath);
        plan.backgrounds.set(scroller, {
          rect: { x: origin.x, y: origin.y, w: round2(scroller.scrollWidth), h: round2(scroller.scrollHeight) },
          color,
          islands
        });
      }
      return plan;
    }
    /** Keeps each anchored hole where native shows its island while the layer it is cut in moves. */
    followAnchoredHoles() {
      var _a;
      for (const anchored of this.anchoredHoles) {
        const { el, channel } = anchored;
        const desired = (_a = this.desiredPaint.get(el)) === null || _a === void 0 ? void 0 : _a[channel];
        const applied = channel === "clip" ? this.runtimeClips.get(el) : this.runtimeBackgrounds.get(el);
        if (!el.isConnected || !desired || !applied)
          continue;
        const box = docRect(el);
        if (Math.abs(box.x - anchored.rect.x) < 0.25 && Math.abs(box.y - anchored.rect.y) < 0.25)
          continue;
        anchored.rect = Object.assign(Object.assign({}, anchored.rect), { x: box.x, y: box.y });
        if (channel === "clip")
          this.writeClip(el, Object.assign(Object.assign({}, desired), { rect: anchored.rect }));
        else
          this.writeBackground(el, Object.assign(Object.assign({}, desired), { rect: anchored.rect }));
      }
    }
    /** Whether an authored mask was found to override the runtime's on this layer, in its current mask style. */
    maskRejected(element) {
      const rejected = this.rejectedMasks.get(element);
      if (rejected === void 0)
        return false;
      if (rejected === maskStyleKey(element))
        return true;
      this.rejectedMasks.delete(element);
      return false;
    }
    /**
     * What this plan paints in web layers so islands under the WebView show
     * through them, and which islands cannot show because their hole cannot be
     * cut. It reads the page and writes nothing: `reconcilePaint` does. Suspending
     * an island changes the holes the rest need, so it decides again until
     * nothing more is suspended. Also returns the islands each page keeps holes
     * for; see `heldUnder`.
     */
    desirePaint(natives, layers, covered, handoffs) {
      var _a;
      const clippedLayers = [...layers, ...covered];
      const current = new Set(clippedLayers.map((layer) => layer.el));
      for (const element of this.rejectedMasks.keys()) {
        if (!current.has(element))
          this.rejectedMasks.delete(element);
      }
      for (const [element, clip] of this.runtimeClips) {
        if (clip.kind === "mask" && !runtimeOwnsMask(element, computedStyle(element)))
          this.rejectedMasks.set(element, maskStyleKey(element));
      }
      for (; ; ) {
        let suspended = false;
        const suspend = (native, reason) => {
          if (!native.active || native.holding)
            return;
          suspendNative(native, reason);
          suspended = true;
        };
        const paint = /* @__PURE__ */ new Map();
        const held = /* @__PURE__ */ new Map();
        const desire = (element) => {
          let entry = paint.get(element);
          if (!entry)
            paint.set(element, entry = {});
          return entry;
        };
        const separable = (element, background) => !this.rejectedBackgrounds.has(element) && backgroundValues(background) !== null;
        const anchoring = natives.some((native) => native.holding);
        let relocated = /* @__PURE__ */ new Set();
        const stack = this.planCanvas;
        if (stack && natives.some((native) => native.active && native.plane === "underlay")) {
          const canvas = layers.filter((layer) => stack.elements.has(layer.el)).flatMap(({ el, rect, backgroundPaint }) => backgroundPaint === null ? [] : [{ el, rect, backgroundPaint }]).map((layer) => ({
            el: layer.el,
            background: {
              rect: layer.rect,
              holes: [layer.rect],
              unionMask: false,
              attachment: "scroll",
              source: layer.backgroundPaint,
              anchored: false
            }
          }));
          if (canvas.every(({ el, background }) => separable(el, background))) {
            for (const { el, background } of canvas)
              desire(el).background = background;
            relocated = stack.elements;
          }
        }
        for (const layer of layers) {
          if (relocated.has(layer.el) || !this.maskRejected(layer.el))
            continue;
          const candidates = knockoutCandidates(natives, layer);
          if (!roundedHolesOverlap(candidates.map((candidate) => candidate.hole)))
            continue;
          for (const { native } of candidates)
            suspend(native, "authored mask properties override native knockout geometry");
        }
        const scrolling = this.compositionEnabled ? withSceneReadScope(() => this.planScrollingHoles(
          // A hole held elsewhere stays out of the scroller, which moves with the page.
          natives.filter((native) => !native.holding || native.heldInPlace),
          layers,
          relocated
        )) : { scrollports: /* @__PURE__ */ new Map(), backgrounds: /* @__PURE__ */ new Map() };
        for (const layer of clippedLayers) {
          if (relocated.has(layer.el))
            continue;
          const handoff = handoffs.get(layer.el);
          const hidden = (handoff === null || handoff === void 0 ? void 0 : handoff.state) === "covered";
          const kept = handoff && !hidden ? handoff.islands : [];
          if (scrolling.backgrounds.has(layer.el) && kept.length === 0)
            continue;
          const keptCandidates = knockoutCandidates(kept, Object.assign(Object.assign({}, layer), { cutoutIssue: null }));
          const holeCandidates = [
            ...knockoutCandidates(natives, layer).filter(({ native }) => (native.holding || stationaryCoordinatePaths(native, layer)) && !kept.some((old) => old.handle === native.handle)),
            ...keptCandidates
          ];
          const clipCandidates = kept.length > 0 ? keptCandidates : holeCandidates;
          const scrollports = (_a = scrolling.scrollports.get(layer.el)) !== null && _a !== void 0 ? _a : [];
          const rawHoles = this.compositionEnabled ? hidden ? [layer.rect] : [
            ...clipCandidates.map((candidate) => candidate.hole),
            ...kept.length === 0 ? scrollports.map(({ hole }) => hole) : []
          ] : [];
          const unionMask = roundedHolesOverlap(rawHoles);
          const holes = unionMask ? rawHoles : disjointHoles(rawHoles);
          if (holes.length === 0)
            continue;
          const clipLayerAsUnit = hidden || kept.length > 0 || layer.backgroundPaint !== null && scrollports.length === 0 && holeCandidates.every(({ native }) => canClipLayerAsUnit(layer, native.handle.el));
          const backgroundCandidates = kept.length > 0 ? holeCandidates.filter(({ native }) => !kept.some((old) => old.handle === native.handle)) : holeCandidates;
          const backgroundHoles = kept.length > 0 ? [...backgroundCandidates.map(({ hole }) => hole), ...scrollports.map(({ hole }) => hole)] : holes;
          const backgroundMask = kept.length > 0 ? roundedHolesOverlap(backgroundHoles) : unionMask;
          if (layer.backgroundPaint && (!clipLayerAsUnit || kept.length > 0 && backgroundHoles.length > 0)) {
            const background = {
              rect: layer.rect,
              holes: kept.length > 0 && !backgroundMask ? disjointHoles(backgroundHoles) : backgroundHoles,
              unionMask: backgroundMask,
              attachment: "scroll",
              source: layer.backgroundPaint,
              anchored: anchoring
            };
            if (separable(layer.el, background))
              desire(layer.el).background = background;
            else
              for (const native of [
                ...backgroundCandidates.map(({ native: native2 }) => native2),
                ...scrollports.flatMap(({ islands }) => islands)
              ])
                suspend(native, "the page background cannot be separated from its web content");
            if (!clipLayerAsUnit)
              continue;
          }
          const kind = !hidden && (unionMask || clipCandidates.some(({ native }) => !native.interactive)) ? "mask" : "path";
          if (kind === "mask" && this.maskRejected(layer.el)) {
            for (const { native } of clipCandidates)
              suspend(native, "authored mask properties override native knockout geometry");
            continue;
          }
          desire(layer.el).clip = { kind, rect: layer.rect, holes, anchored: anchoring && !hidden };
          if (hidden)
            held.set(layer.el, planned(natives, "underlay").map((native) => Object.assign({}, native)));
          else if (kept.length > 0)
            held.set(layer.el, kept);
        }
        for (const [scroller, { rect, color, islands }] of scrolling.backgrounds) {
          const paneColor = this.nativeAcceptsPaneColor ? opaqueHexColor(color) : null;
          const holes = islands.filter((native) => native.active).map((native) => native.rect);
          const unionMask = !paneColor && roundedHolesOverlap(holes);
          const background = Object.assign({ rect, holes: paneColor ? [rect] : unionMask ? holes : disjointHoles(holes), unionMask, attachment: "local", source: Object.assign(Object.assign({}, TRANSPARENT_PAINT), { color }), anchored: false }, paneColor && { paneColor });
          if (separable(scroller, background))
            desire(scroller).background = background;
          else
            for (const native of islands)
              suspend(native, "the page background cannot be separated from its web content");
        }
        if (!suspended)
          return { paint, held };
      }
    }
    /**
     * The only writer of runtime paint in a plan. Applies each desired channel and
     * releases every applied one the plan does not want, restoring the authored
     * value. Outside a plan, paint is only ever released: see `handleDomMutations`
     * and `releaseRuntimePaint`. Returns false when a write did not take
     * or a clip came or went on a layer whose stacking context that changes, which
     * changes paint order: the plan then decides again.
     */
    reconcilePaint(paint) {
      var _a, _b;
      let settled = true;
      for (const [element, clip] of this.runtimeClips) {
        const wanted = (_a = paint.get(element)) === null || _a === void 0 ? void 0 : _a.clip;
        if ((wanted === null || wanted === void 0 ? void 0 : wanted.kind) === clip.kind)
          continue;
        const before = establishesStackingContext(element);
        this.releaseRuntimeClip(element);
        if (establishesStackingContext(element) !== before)
          settled = false;
      }
      for (const element of this.runtimeBackgrounds.keys()) {
        if (!((_b = paint.get(element)) === null || _b === void 0 ? void 0 : _b.background))
          this.releaseRuntimeBackground(element);
      }
      for (const [element, { clip, background }] of paint) {
        if (background && !this.writeBackground(element, background))
          settled = false;
        if (!clip)
          continue;
        const before = this.runtimeClips.has(element) ? null : establishesStackingContext(element);
        if (!this.writeClip(element, clip))
          settled = false;
        else if (before !== null && establishesStackingContext(element) !== before)
          settled = false;
      }
      this.desiredPaint = new Map(paint);
      this.anchoredHoles = [];
      this.paneColors.clear();
      for (const [el, { clip, background }] of paint) {
        if ((clip === null || clip === void 0 ? void 0 : clip.anchored) && this.runtimeClips.has(el))
          this.anchoredHoles.push({ el, channel: "clip", rect: clip.rect });
        if ((background === null || background === void 0 ? void 0 : background.anchored) && this.runtimeBackgrounds.has(el))
          this.anchoredHoles.push({ el, channel: "background", rect: background.rect });
        if ((background === null || background === void 0 ? void 0 : background.paneColor) && this.runtimeBackgrounds.has(el))
          this.paneColors.set(el, background.paneColor);
      }
      return settled;
    }
    /**
     * Paints this plan's holes: decides, writes, and decides again while a write
     * fails or moves paint order, at most `MAX_PAINT_PASSES` times.
     */
    applyPaint(natives, layers, covered = [], handoffs = /* @__PURE__ */ new Map()) {
      for (let pass = 1; ; pass++) {
        const { paint, held } = this.desirePaint(natives, layers, covered, handoffs);
        if (this.reconcilePaint(paint) || pass === MAX_PAINT_PASSES) {
          this.heldUnder = held;
          return;
        }
      }
    }
    coveredWebLayers(layers) {
      if (!this.compositionEnabled)
        return [];
      const viewport = { x: window.scrollX, y: window.scrollY, w: window.innerWidth, h: window.innerHeight };
      const covers = layers.filter((layer) => {
        var _a, _b, _c;
        const paint = (_a = layer.backgroundPaint) !== null && _a !== void 0 ? _a : separableBackgroundPaint(computedStyle(layer.el));
        return layer.cutoutIssue === null && (paint === null || paint === void 0 ? void 0 : paint.image) === "none" && colorAlpha(paint.color) === 1 && ((_c = (_b = layer.animators) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) === 0 && document.scrollingElement != null && stationaryCoordinatePaths(layer, { coordinateSpace: "viewport", scrollPath: [] }) && opaqueContainsRect(layer.visualRect, viewport) && this.natives.some((native) => native.el.isConnected && comparePaintOrder(layer.el, native.el) < 0);
      });
      const covered = layers.filter((layer) => covers.some((cover) => above(cover, layer)) && establishesStackingContext(layer.el) && !this.natives.some((native) => isElementVisible(native.el) && isComposedAncestor(layer.el, native.el)));
      const elements = new Set(covered.map((layer) => layer.el));
      return covered.filter((layer) => {
        const parent = composedParentElement(layer.el);
        return parent === null || !hasComposedAncestorIn(parent, elements);
      });
    }
    /**
     * The layers under every island that paint the whole viewport one solid
     * color, from the bottom, and the color the top one shows. Native paints that
     * color behind the WebView instead, so they need no holes, and an island that
     * moves, as a page does in a push, moves against no hole.
     */
    canvasStack(natives, layers) {
      var _a, _b, _c, _d;
      const islands = natives.filter((native) => native.active);
      const elements = /* @__PURE__ */ new Set();
      let color = null;
      let top = null;
      const candidates = layers.filter((layer) => layer.backgroundPaint !== null && coversViewport(layer)).sort((left, right) => comparePaintOrder(left.el, right.el));
      for (const layer of candidates) {
        const paint = layer.backgroundPaint;
        if (layer.el === document.documentElement && paint && colorAlpha(paint.color) === 0 && paint.image === "none")
          continue;
        const solid = (paint === null || paint === void 0 ? void 0 : paint.image) === "none" ? opaqueHexColor(paint.color) : null;
        if (!solid || layer.cutoutIssue !== null || ((_b = (_a = layer.animators) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0 || ((_d = (_c = layer.movers) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 0 || !islands.every((native) => isComposedAncestor(layer.el, native.el) || comparePaintOrder(layer.el, native.el) < 0))
          break;
        elements.add(layer.el);
        color = solid;
        top = layer.el;
      }
      const stackTop = top;
      if (stackTop === null || color === null)
        return null;
      const exposed = layers.some((layer) => !elements.has(layer.el) && !isComposedAncestor(stackTop, layer.el) && comparePaintOrder(layer.el, stackTop) < 0);
      return exposed ? null : { color, elements };
    }
    /**
     * Islands native still shows under the WebView, because it has not yet
     * acknowledged them above it, count as underlays for the page's holes. The
     * page closing them first would paint over the island. That includes an
     * island under the WebView in a layout native has not acknowledged yet:
     * native still applies that layout before the one raising the island.
     */
    holdingUnderlays(natives) {
      const held = new Map(Array.from(this.heldUnder.values()).flatMap((islands) => islands.map((native) => [native.handle, native])));
      const inFlight = /* @__PURE__ */ new Map();
      for (const geometry of this.plannedGeometry.values()) {
        for (const [id, placed] of geometry)
          inFlight.set(id, placed);
      }
      return natives.map((native) => {
        var _a, _b;
        const id = native.handle.islandId;
        const shown = this.acknowledgedPlanes.get(id) === "underlay";
        if (!native.active || native.plane !== "overlay" || !this.mayShowUnder(id))
          return native;
        const placed = (_b = (_a = held.get(native.handle)) !== null && _a !== void 0 ? _a : shown ? this.acknowledgedGeometry.get(id) : void 0) !== null && _b !== void 0 ? _b : inFlight.get(id);
        const old = placed && scrolledGeometry(placed);
        return Object.assign(Object.assign(Object.assign({}, native), { plane: "underlay" }), old && {
          holding: true,
          heldInPlace: !this.planEffects.some((effect) => effect.impact !== "repaint" && isComposedAncestor(effect.target, native.el)) && sameCoordinatePath(old, native) && sameBox(old.rect, native.rect),
          rect: old.rect,
          visualRect: old.visualRect,
          paintRect: old.paintRect,
          coordinateSpace: old.coordinateSpace,
          scrollPath: old.scrollPath
        });
      });
    }
    /** Each page's handoff for this plan: what covers it, and what native may still show under it. */
    planPageHandoffs(covered) {
      var _a;
      const handoffs = /* @__PURE__ */ new Map();
      for (const layer of covered)
        handoffs.set(layer.el, { state: "covered", islands: [] });
      for (const [page, recorded] of this.heldUnder) {
        if (handoffs.has(page))
          continue;
        const islands = recorded.filter((native) => this.mayShowUnder(native.handle.islandId));
        const state = ((_a = this.pageHandoffs.get(page)) === null || _a === void 0 ? void 0 : _a.state) === "covered" ? "uncovering" : islands.length > 0 ? "held" : "settled";
        handoffs.set(page, { state, islands });
      }
      return handoffs;
    }
    /** Whether native may show the island under the WebView: as acknowledged, or in a layout it has yet to acknowledge. */
    mayShowUnder(islandId) {
      if (this.acknowledgedPlanes.get(islandId) === "underlay")
        return true;
      return Array.from(this.plannedGeometry.values()).some((geometry) => geometry.has(islandId));
    }
    /** The canvas color of the latest layout sent that has one and native has not acknowledged. */
    inFlightCanvasColor() {
      let color = null;
      for (const planned2 of this.plannedCanvasColor.values())
        color = planned2 !== null && planned2 !== void 0 ? planned2 : color;
      return color;
    }
    planNatives(layers, refusedUnderlays, covered, handoffs) {
      var _a, _b, _c;
      const timed = timingEnabled();
      let checkpoint = timed ? performance.now() : 0;
      const natives = this.buildNatives(refusedUnderlays);
      this.planCanvas = this.canvasStack(natives, layers);
      const plannable = natives.filter((native) => native.active);
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
      resetPaintOrderCache();
      for (const native of natives) {
        if (native.scrollPath.some((element) => this.rootScroll.isRouted(element)))
          native.plane = "overlay";
      }
      if (timed) {
        recordTiming("natives:build", checkpoint);
        checkpoint = performance.now();
      }
      let conflictCheckpoint = checkpoint;
      withSceneReadScope(() => {
        this.resolveHostPlanes(natives, layers);
        if (timed) {
          recordTiming("natives:conflicts:resolveHostPlanes", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
        this.resolveWebUnderlays(natives, layers);
        if (timed) {
          recordTiming("natives:conflicts:resolveWebUnderlays", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
        this.suspendUnsupportedOverlaps(natives);
        if (timed) {
          recordTiming("natives:conflicts:suspendUnsupportedOverlaps", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
        this.detectBackgroundPaintConflicts(natives, layers);
        if (timed) {
          recordTiming("natives:conflicts:detectBackgroundPaintConflicts", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
        this.detectLayerCoordinateConflicts(natives, layers);
        if (timed) {
          recordTiming("natives:conflicts:detectLayerCoordinateConflicts", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
        this.detectOverlayCutoutConflicts(natives, layers);
        if (timed) {
          recordTiming("natives:conflicts:detectOverlayCutoutConflicts", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
        this.resolveMotionDependencies(natives, layers);
        if (timed) {
          recordTiming("natives:conflicts:resolveMotionDependencies", conflictCheckpoint);
          conflictCheckpoint = performance.now();
        }
      });
      if (timed) {
        recordTiming("natives:conflicts", checkpoint);
        checkpoint = performance.now();
      }
      const revealed = this.holdingUnderlays(natives);
      this.applyPaint(revealed, layers, covered, handoffs);
      if (timed) {
        recordTiming("natives:knockouts", checkpoint);
        checkpoint = performance.now();
      }
      resetPaintOrderCache();
      const canvasColor = (_b = (_a = this.planCanvas) === null || _a === void 0 ? void 0 : _a.color) !== null && _b !== void 0 ? _b : revealed.some((native) => native.holding) ? (_c = this.acknowledgedCanvasColor) !== null && _c !== void 0 ? _c : this.inFlightCanvasColor() : null;
      const refused = plannable.filter((native) => !native.active && native.plane === "underlay");
      if (timed)
        recordTiming("natives:canvas", checkpoint);
      return { natives, canvasColor, refusedUnderlays: new Set(refused.map((native) => native.el)) };
    }
    noteFrame(frameTime) {
      if (!Number.isFinite(frameTime))
        return;
      if (this.lastFrameTime !== null) {
        const interval = frameTime - this.lastFrameTime;
        if (interval >= 4 && interval <= 50)
          this.frameInterval = this.frameInterval * 0.9 + interval * 0.1;
      }
      this.lastFrameTime = frameTime;
    }
    presentInactive(handle, reason) {
      const previous = handle.el.getAttribute("data-native-islands-inactive");
      handle.setNativeInactive(reason);
      if (handle.el.getAttribute("data-native-islands-inactive") !== previous) {
        this.recordRuntimePaintAttribute(handle.el, "data-native-islands-inactive");
      }
    }
    /**
     * Native shows a plan about a frame after the page paints it, so a layer
     * moving over an island is cut where it is and where it will be a frame on,
     * from its velocity since the last plan. Its cutout then leads its edge
     * instead of trailing it, and the island does not draw over it.
     */
    leadMovingLayers(layers) {
      var _a;
      const now = performance.now();
      const moving = /* @__PURE__ */ new Set();
      for (const layer of layers) {
        if (!((_a = layer.movers) === null || _a === void 0 ? void 0 : _a.some((target) => !this.planMotion.has(target))))
          continue;
        moving.add(layer.el);
        const previous = this.motionSamples.get(layer.el);
        this.motionSamples.set(layer.el, { x: layer.visualRect.x, y: layer.visualRect.y, at: now });
        const elapsed = previous ? now - previous.at : 0;
        if (!previous || elapsed < 4 || elapsed > 100)
          continue;
        const ahead = this.frameInterval / elapsed;
        const x = round2((layer.visualRect.x - previous.x) * ahead);
        const y = round2((layer.visualRect.y - previous.y) * ahead);
        if (Math.abs(x) >= 0.5 || Math.abs(y) >= 0.5)
          layer.lead = { x, y };
      }
      for (const element of this.motionSamples.keys()) {
        if (!moving.has(element))
          this.motionSamples.delete(element);
      }
    }
    /**
     * Chooses the islands this plan sends. Native keeps a view for every island
     * it is sent and destroys the rest, so the showing islands come first, then
     * inactive ones native already holds, which keep their state for when they
     * show again. An island that has never shown, such as one in a tab not yet
     * opened, is not sent at all.
     */
    holdIslands(natives) {
      const held = /* @__PURE__ */ new Set();
      for (const native of natives) {
        if (native.active)
          held.add(native.handle);
      }
      for (const native of natives) {
        if (!native.active && native.handle.canAttemptNative() && this.held.has(native.handle))
          held.add(native.handle);
      }
      this.held = held;
    }
    /**
     * Tells each island native holds, or held, of a layout native has applied, or
     * will apply before anything sent after it: whether it holds the island.
     * Returns the creations that starts.
     */
    layoutApplied(layout) {
      const sequence = layout.layoutSeq;
      if (sequence <= this.appliedSequence)
        return Promise.resolve();
      this.appliedSequence = sequence;
      const ids = new Set(layout.components.map((component) => component.id));
      const creations = [];
      for (const [handle, sent] of this.nativeHolds) {
        const holds = ids.has(handle.islandId);
        const creation = handle.nativeLayoutApplied(holds);
        if (holds && creation)
          creations.push(creation);
        if (!holds && sequence > sent)
          this.nativeHolds.delete(handle);
      }
      return Promise.all(creations).then(() => void 0);
    }
    /** Native applied a layout `latency` ms after the page sent it; see `motionLead`. */
    noteLayoutApplied(latency) {
      if (!Number.isFinite(latency) || latency < 0)
        return;
      this.applyLatencies.push(latency);
      if (this.applyLatencies.length > APPLY_LATENCY_SAMPLES)
        this.applyLatencies.shift();
    }
    /**
     * How long native takes to apply a layout: the third longest of the recent
     * ones, or a frame before any is known, up to `MAX_MOTION_LEAD_FRAMES`. A
     * motion native runs starts that far after the plan, so native has the plan
     * before its first frame.
     */
    motionLead() {
      if (this.applyLatencies.length === 0)
        return this.frameInterval;
      const sorted = [...this.applyLatencies].sort((left, right) => right - left);
      return Math.min(sorted[Math.min(2, sorted.length - 1)], MAX_MOTION_LEAD_FRAMES * this.frameInterval);
    }
    /**
     * Starts the motion this plan found starting, when native can have the
     * layout: after it has applied one, plus `delay` before the layout is sent.
     * Every animation starting in this frame starts then, so what the page
     * started together moves together; see `startMotionAt`.
     */
    startMotion(delay) {
      const starting = this.startingMotion;
      this.startingMotion = null;
      if (!starting) {
        this.releaseMotion();
        return;
      }
      this.releaseMotion(starting.animations);
      const earliest = performance.now() + delay + this.motionLead();
      const at = this.nativeMotionStartsAtCommit ? performance.now() : round3(motionStartTime(earliest, this.lastFrameTime, this.frameInterval));
      if (!this.nativeMotionStartsAtCommit)
        startMotionAt(starting.animations, at);
      for (const entry of starting.entries) {
        const start = entry.animation.startTime;
        entry.payload.startTime = this.sentStart(entry.animation, typeof start === "number" ? start : at);
      }
    }
    sentStart(animation, start) {
      const own = typeof animation.startTime === "number" ? animation.startTime : null;
      const sent = this.sentStarts.get(animation);
      if (sent && (sent.own === own || sent.own === null && sent.guessed)) {
        sent.own = own;
        return sent.sent;
      }
      this.sentStarts.set(animation, { sent: start, own, guessed: own === null && animation.playState !== "paused" });
      return start;
    }
    releaseMotion(animations = this.pausedMotion) {
      for (const animation of animations) {
        if (!this.pausedMotion.delete(animation))
          continue;
        if (animation.playState === "paused")
          animation.play();
      }
    }
    /**
     * The motions a layout names. Motion starting in this frame is started by
     * `startMotion` once the plan knows when the layout is sent.
     */
    motionPayloads(targets, effects) {
      var _a, _b;
      const entries = Array.from(targets).flatMap((target) => {
        var _a2;
        return (_a2 = this.planMotion.get(target)) !== null && _a2 !== void 0 ? _a2 : [];
      });
      const starting = (animation) => this.pausedMotion.has(animation) || startsThisFrame(animation, this.planTimeline, this.freshAnimations.has(animation));
      const started = entries.filter((entry) => starting(entry.animation) || this.pausedMotion.has(entry.animation));
      this.startingMotion = null;
      if (started.length > 0 && this.nativeMotionStartsAtCommit && this.pausedMotion.size === 0) {
        for (const entry of started) {
          const start = entry.animation.startTime;
          entry.payload.startTime = typeof start === "number" ? start : (_a = this.planTimeline) !== null && _a !== void 0 ? _a : entry.payload.startTime;
        }
      } else if (started.length > 0) {
        this.startingMotion = {
          entries: started,
          animations: /* @__PURE__ */ new Set([
            ...started.map((entry) => entry.animation),
            ...effects.flatMap((effect) => effect.animation && starting(effect.animation) ? [effect.animation] : [])
          ])
        };
      }
      const deferred = new Set((_b = this.startingMotion) === null || _b === void 0 ? void 0 : _b.entries);
      for (const entry of entries) {
        if (!deferred.has(entry))
          entry.payload.startTime = this.sentStart(entry.animation, entry.payload.startTime);
      }
      return Array.from(targets, (target) => {
        var _a2;
        return {
          id: this.idForMotion(target),
          animations: ((_a2 = this.planMotion.get(target)) !== null && _a2 !== void 0 ? _a2 : []).map((entry) => entry.payload)
        };
      });
    }
    resolve() {
      const timed = timingEnabled();
      const start = timed ? performance.now() : 0;
      this.planMotion.clear();
      scriptScrollersAtRest = this.scrollMode === "native";
      try {
        return withScrollStructure(() => withPlanScope(() => withPaintOrderScope(() => withBoundsProjection((element, bounds) => this.motionBounds(element, bounds), () => this.resolveScene()))));
      } finally {
        scriptScrollersAtRest = false;
        if (timed)
          recordTiming("resolve", start);
      }
    }
    motionBounds(element, bounds) {
      var _a, _b;
      if (this.planMotion.size === 0)
        return bounds;
      let x = bounds.left;
      let y = bounds.top;
      for (const target of this.motionTargets(element)) {
        const sample = (_b = (_a = this.planMotion.get(target)) === null || _a === void 0 ? void 0 : _a.find((entry) => entry.translation)) === null || _b === void 0 ? void 0 : _b.translation;
        if (!sample)
          continue;
        const current = translationOf(getComputedStyle(target).getPropertyValue(sample.property), sample.property, sample.width, sample.height);
        if (!current)
          continue;
        x += (sample.x - current.x) * sample.scaleX;
        y += (sample.y - current.y) * sample.scaleY;
      }
      return x === bounds.left && y === bounds.top ? bounds : DOMRect.fromRect({ x, y, width: bounds.width, height: bounds.height });
    }
    resolveScene() {
      var _a, _b;
      const timed = timingEnabled();
      let checkpoint = timed ? performance.now() : 0;
      const layerStart = checkpoint;
      const reached = this.styleScope.collect();
      if (reached === "all")
        this.invalidateAutomaticLayers();
      else
        for (const root of outermost(reached))
          this.invalidateAutomaticLayers(root);
      if (this.backgroundSourcesDirty)
        this.releaseRuntimeBackgrounds();
      this.pruneDetachedEffects();
      this.compositionObserver.sync([
        ...this.natives.map((handle) => handle.el),
        ...this.layers.map((handle) => handle.el)
      ]);
      if (timed) {
        recordTiming("scene:observer", checkpoint);
        checkpoint = performance.now();
      }
      const effects = this.compositionEffects();
      this.planEffects = effects;
      const animated = new Set(effects.map((effect) => effect.target));
      for (const target of outermost([...animated, ...this.animatedTargets]))
        this.invalidateAutomaticLayers(target);
      this.animatedTargets = animated;
      if (timed) {
        recordTiming("scene:effects", checkpoint);
        checkpoint = performance.now();
      }
      this.planMotion = this.describeMotions(effects);
      if (timed) {
        recordTiming("scene:motions", checkpoint);
        checkpoint = performance.now();
      }
      const { layers, covered } = withSceneReadScope(() => {
        const all = this.buildLayers(effects);
        const covered2 = this.coveredWebLayers(all);
        const coveredElements = new Set(covered2.map((layer) => layer.el));
        return {
          layers: all.filter((layer) => activeTopLayerAncestor(layer.el) !== null || !hasComposedAncestorIn(layer.el, coveredElements)),
          covered: covered2
        };
      });
      if (timed) {
        recordTiming("scene:buildLayers", checkpoint);
        checkpoint = performance.now();
      }
      this.leadMovingLayers(layers);
      this.following = this.movesIslands(effects) || this.natives.some((handle) => handle.requiresUnobscuredSurface && this.motionTargets(handle.el).length > 0);
      if (timed) {
        recordTiming("scene:following", checkpoint);
        recordTiming("scene:layers", layerStart);
        checkpoint = performance.now();
      }
      const handoffs = this.planPageHandoffs(covered);
      const first = this.planNatives(layers, /* @__PURE__ */ new Set(), covered, handoffs);
      const { natives, canvasColor } = first.refusedUnderlays.size > 0 ? this.planNatives(layers, first.refusedUnderlays, covered, handoffs) : first;
      this.pageHandoffs = handoffs;
      this.lastPlannedGeometry = new Map(planned(natives, "underlay").map(({ handle, rect, visualRect, paintRect, coordinateSpace, scrollPath: scrollPath2 }) => [
        handle.islandId,
        { rect, visualRect, paintRect, coordinateSpace, scrollPath: scrollPath2 }
      ]));
      if (timed) {
        recordTiming("scene:natives", checkpoint);
        checkpoint = performance.now();
      }
      this.holdIslands(natives);
      if (timed)
        recordTiming("scene:presentation:hold", checkpoint);
      const presentationStart = checkpoint;
      if (timed)
        checkpoint = performance.now();
      this.resuming = [];
      const now = performance.now();
      const present = /* @__PURE__ */ new Set();
      for (const native of natives) {
        const { handle } = native;
        present.add(handle);
        const showingFallback = native.el.hasAttribute("data-native-islands-inactive");
        let reason = native.inactiveReason;
        if (reason !== null && effects.length > 0 && !showingFallback) {
          const since = (_a = this.sittingOut.get(handle)) !== null && _a !== void 0 ? _a : now;
          this.sittingOut.set(handle, since);
          if (now - since < MOTION_SIT_OUT_MS) {
            reason = null;
            (_b = this.sitOutTimer) !== null && _b !== void 0 ? _b : this.sitOutTimer = window.setTimeout(() => {
              this.sitOutTimer = null;
              this.refresh();
            }, MOTION_SIT_OUT_MS);
          }
        } else if (reason === null) {
          this.sittingOut.delete(handle);
        }
        if (reason === null && showingFallback && native.active) {
          this.resuming.push(handle);
          continue;
        }
        this.presentInactive(handle, reason);
      }
      for (const handle of this.sittingOut.keys()) {
        if (!present.has(handle))
          this.sittingOut.delete(handle);
      }
      if (timed) {
        recordTiming("scene:presentation:callbacks", checkpoint);
        checkpoint = performance.now();
      }
      resetPaintOrderCache();
      const order = natives.filter((native) => native.active).slice().sort((a, b) => {
        if (above(a, b))
          return 1;
        if (above(b, a))
          return -1;
        return 0;
      }).map((native) => native.handle.islandId);
      if (timed) {
        recordTiming("scene:presentation:order", checkpoint);
        recordTiming("scene:presentation", presentationStart);
        checkpoint = performance.now();
      }
      return withSceneReadScope(() => {
        let payloadCheckpoint = timed ? performance.now() : 0;
        const bridgeRect = (rect, coordinateSpace) => this.documentSpaceRect(rect, coordinateSpace);
        const sentMotions = /* @__PURE__ */ new Set();
        let regionScrollers = null;
        let motionPaths = null;
        let regionPayloads = null;
        const region = (source) => {
          const { coordinateSpace, scrollPath: scrollPath2, rect, sticky, el } = source;
          const cache = regionPayloads !== null && regionPayloads !== void 0 ? regionPayloads : regionPayloads = /* @__PURE__ */ new WeakMap();
          let payload = cache.get(source);
          for (const element of scrollPath2)
            regionScrollers === null || regionScrollers === void 0 ? void 0 : regionScrollers.add(element);
          const motion = motionPath(el);
          if (!payload) {
            payload = Object.assign({ rect: bridgeRect(sticky ? Object.assign(Object.assign({}, rect), { x: round2(rect.x - sticky.shift.x), y: round2(rect.y - sticky.shift.y) }) : rect, coordinateSpace), coordinateSpace, scrollPath: scrollPath2.map((element) => this.idForScrollContainer(element)) }, sticky && {
              sticky: Object.assign(Object.assign(Object.assign({}, sticky.scroller && { scroller: this.idForScrollContainer(sticky.scroller) }), { natural: bridgeRect(sticky.natural, coordinateSpace), bounds: bridgeRect(sticky.bounds, coordinateSpace) }), sticky.insets)
            });
            cache.set(source, payload);
          }
          return Object.assign(Object.assign(Object.assign(Object.assign({}, payload), { scrollPath: payload.scrollPath.slice() }), payload.sticky && { sticky: Object.assign({}, payload.sticky) }), motion);
        };
        const motionPath = (element) => {
          if (!element)
            return {};
          const cache = motionPaths !== null && motionPaths !== void 0 ? motionPaths : motionPaths = /* @__PURE__ */ new Map();
          let path = cache.get(element);
          if (!path) {
            const targets = this.motionTargets(element);
            path = { targets, ids: targets.map((target) => this.idForMotion(target)) };
            cache.set(element, path);
          }
          for (const target of path.targets)
            sentMotions.add(target);
          return path.ids.length > 0 ? { motionPath: path.ids.slice() } : {};
        };
        const nativeRegion = (native) => {
          for (const element of native.scrollPath)
            regionScrollers === null || regionScrollers === void 0 ? void 0 : regionScrollers.add(element);
          return Object.assign(Object.assign({}, motionPath(native.el)), { rect: bridgeRect(native.rect, native.coordinateSpace), coordinateSpace: native.coordinateSpace, scrollPath: native.scrollPath.map((element) => this.idForScrollContainer(element)) });
        };
        const leading = (layer) => {
          const { lead } = layer;
          if (!lead)
            return layer;
          const reach = (rect) => union(rect, Object.assign(Object.assign({}, rect), { x: rect.x + lead.x, y: rect.y + lead.y }));
          return Object.assign(Object.assign({}, layer), { rect: reach(layer.rect), visualRect: reach(layer.visualRect), paintRect: reach(layer.paintRect) });
        };
        let leadingLayers;
        const moving = (side, partner) => this.planMotion.size > 0 ? reachFrom(side, partner) : side;
        const cutouts = {};
        const exclusions = {};
        const tints = {};
        const fading = this.fadingTargets();
        let eligibleTintLayers;
        let tintColors = null;
        const tintColor = (layer) => {
          var _a2, _b2, _c;
          const cache = tintColors !== null && tintColors !== void 0 ? tintColors : tintColors = /* @__PURE__ */ new Map();
          if (cache.has(layer))
            return (_a2 = cache.get(layer)) !== null && _a2 !== void 0 ? _a2 : null;
          const color = (_c = (_b2 = this.gradientTint(layer)) === null || _b2 === void 0 ? void 0 : _b2.color) !== null && _c !== void 0 ? _c : srgba(computedStyle(layer.el).backgroundColor);
          if (!color) {
            cache.set(layer, null);
            return null;
          }
          const alpha = round3(color[3] * inheritedOpacity(layer.el, fading));
          const tint = alpha > 0 ? [...color.slice(0, 3).map(Math.round), alpha] : null;
          cache.set(layer, tint);
          return tint;
        };
        let touchableLayers;
        for (const native of natives) {
          if (!native.active || !native.rect)
            continue;
          cutouts[native.handle.islandId] = [];
          exclusions[native.handle.islandId] = [];
          if (!hasPlanGeometry(native))
            continue;
          regionScrollers = native.motionDependencies;
          const layerReach = /* @__PURE__ */ new Map();
          const canReachAbove = (layer) => {
            const known = layerReach.get(layer);
            if (known !== void 0)
              return known;
            const reaches = canMoveIntoIntersection(moving(layer, native), moving(native, layer)) && above(layer, native);
            layerReach.set(layer, reaches);
            return reaches;
          };
          const protectedRegions = (layer) => {
            if (movesAgainst(layer, native) && !layer.translucentFill && above(layer, native) && isElementVisible(layer.el) && canMoveIntoIntersection(reachFrom(layer, native), native)) {
              return [nativeRegion(native)];
            }
            if (layer.translucentFill)
              return [];
            const source = this.protectedWebRegion(native, layer);
            if (source)
              return [region(source)];
            return source === null && !this.protectedCoveredByAncestor(native, layer, layers) ? [region(layer)] : [];
          };
          let regionCheckpoint = timed ? performance.now() : 0;
          if (native.plane === "overlay") {
            cutouts[native.handle.islandId] = clipsProtectedSurface(native) ? layers.flatMap(protectedRegions) : (leadingLayers !== null && leadingLayers !== void 0 ? leadingLayers : leadingLayers = layers.map(leading)).filter((layer) => !layer.translucentFill && isElementVisible(layer.el) && canReachAbove(layer) && (layer.overlayCutoutIssue === null ? layer.cutoutIssue === null || !!layer.sticky : !layer.overlayCutoutIssue.mayMoveWithoutRefresh && !this.opaqueWebCover(layer, native, layers))).map((layer) => {
              var _a2;
              if (!this.gradientTint(layer, native))
                return region(layer);
              const height = opaqueGradientDepth(layer.el, layer.rect.h);
              if (height === null)
                return region(layer);
              const r = (_a2 = layer.rect.r) !== null && _a2 !== void 0 ? _a2 : SQUARE;
              return region(Object.assign(Object.assign({}, layer), { rect: Object.assign(Object.assign({}, layer.rect), { h: height, r: height < layer.rect.h ? [r[0], r[1], 0, 0] : r }) }));
            });
            if (timed) {
              recordTiming("regions:cutouts", regionCheckpoint);
              regionCheckpoint = performance.now();
            }
            const tinted = !native.handle.requiresUnobscuredSurface ? (eligibleTintLayers !== null && eligibleTintLayers !== void 0 ? eligibleTintLayers : eligibleTintLayers = layers.filter((layer) => (layer.translucentFill || !!this.gradientTint(layer)) && (isElementVisible(layer.el) || this.fadingInByNative(layer.el)))).flatMap((layer) => {
              if (!canReachAbove(layer))
                return [];
              const color = tintColor(layer);
              if (!color)
                return [];
              const gradient = this.gradientTint(layer, native);
              if (!layer.translucentFill && !gradient)
                return [];
              return [
                Object.assign(Object.assign(Object.assign({}, region(layer)), { color: color.slice() }), gradient ? { alphaStops: gradient.alphaStops } : {})
              ];
            }) : [];
            if (tinted.length > 0)
              tints[native.handle.islandId] = tinted;
            if (timed) {
              recordTiming("regions:tints", regionCheckpoint);
              regionCheckpoint = performance.now();
            }
          }
          const exclusionLayers = touchableLayers !== null && touchableLayers !== void 0 ? touchableLayers : touchableLayers = layers.filter(touchable);
          const reachingExclusions = exclusionLayers.filter(canReachAbove);
          exclusions[native.handle.islandId] = clipsProtectedSurface(native) ? exclusionLayers.flatMap(protectedRegions) : reachingExclusions.filter((layer) => layer.overlayCutoutIssue !== UNFOLLOWED_STICKY || !this.opaqueWebCover(layer, native, reachingExclusions)).map(region);
          for (const other of natives) {
            if (other !== native && hasPlanGeometry(other) && canMoveIntoIntersection(moving(other, native), moving(native, other)) && above(other, native)) {
              exclusions[native.handle.islandId].push(nativeRegion(other));
            }
          }
          if (timed)
            recordTiming("regions:exclusions", regionCheckpoint);
          if (native.handle.requiresUnobscuredSurface) {
            const cut = new Set(cutouts[native.handle.islandId].map((region2) => JSON.stringify(region2)));
            cutouts[native.handle.islandId].push(...exclusions[native.handle.islandId].filter((region2) => !cut.has(JSON.stringify(region2))));
          }
        }
        regionScrollers = null;
        if (timed) {
          recordTiming("payload:regions", payloadCheckpoint);
          payloadCheckpoint = performance.now();
        }
        const components = natives.filter((native) => this.held.has(native.handle)).map((native) => {
          const rect = native.rect && bridgeRect(native.rect, native.coordinateSpace);
          return Object.assign(Object.assign({ id: native.handle.islandId, type: native.handle.type, plane: native.plane, coordinateSpace: native.coordinateSpace, scrollPath: native.scrollPath.map((element) => this.idForScrollContainer(element)), motionDependencies: Array.from(native.motionDependencies, (element) => this.idForScrollContainer(element)), rect, interactive: native.interactive, active: native.active }, native.opacity < 1 ? { opacity: round2(native.opacity) } : {}), motionPath(native.el));
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
        if (timed) {
          recordTiming("payload:components", payloadCheckpoint);
          payloadCheckpoint = performance.now();
        }
        const activeScrollContainers = motionDependencies((native) => native.active).filter((element) => hasArea(scrollContainerRect(element)));
        this.syncScrollListeners(activeScrollContainers);
        const referencedScrollContainers = motionDependencies((native) => this.held.has(native.handle)).sort((left, right) => comparePaintOrder(right, left));
        const scrollContainers = [];
        for (const element of referencedScrollContainers) {
          const visualRect = scrollContainerRect(element);
          if (!hasArea(visualRect))
            continue;
          const basis = coordinateBasis(element);
          const ancestorPath = basis.scrollPath;
          const viewportFixed = this.innerScrollMode === "root" && this.rootScroll.isRouted(element);
          const originRect = basis.coordinateSpace === "viewport" ? Object.assign(Object.assign({}, visualRect), { x: round2(visualRect.x - window.scrollX), y: round2(visualRect.y - window.scrollY) }) : visualRect;
          let rect = rectInScrollPathCoordinates(viewportFixed ? Object.assign(Object.assign({}, originRect), { y: round2(visualRect.y - window.scrollY + this.rootScroll.pageOffset()) }) : originRect, ancestorPath);
          if (viewportFixed)
            rect = canonicalScrollRect(rect);
          const offset = physicalScrollOffset(element);
          scrollContainers.push(Object.assign({ id: this.idForScrollContainer(element), rect, scrollPath: ancestorPath.map((ancestor) => this.idForScrollContainer(ancestor)), coordinateSpace: basis.coordinateSpace, viewportFixed, contentWidth: round2(element.scrollWidth), contentHeight: round2(element.scrollHeight), offsetX: offset.x, offsetY: viewportFixed ? this.rootScroll.offsetFor(element) : offset.y }, motionPath(element)));
        }
        const sent = new Set(scrollContainers.map((container) => container.id));
        const panes = {};
        const ordered = order.map((id) => {
          var _a2;
          return (_a2 = natives.find((native) => native.handle.islandId === id)) === null || _a2 === void 0 ? void 0 : _a2.el;
        });
        for (const [pane, color] of this.paneColors) {
          const id = this.idForScrollContainer(pane);
          if (!sent.has(id))
            continue;
          const under = ordered.findIndex((el) => el !== void 0 && (isComposedAncestor(pane, el) || comparePaintOrder(el, pane) > 0));
          panes[id] = under < 0 ? { color } : { color, under: order[under] };
        }
        for (const component of components) {
          component.motionDependencies = component.motionDependencies.filter((id) => sent.has(id));
          if (!component.active && !component.scrollPath.every((id) => sent.has(id)))
            component.scrollPath = [];
        }
        const motions = this.motionPayloads(sentMotions, effects);
        if (timed) {
          recordTiming("payload:scroll", payloadCheckpoint);
          recordTiming("scene:payload", checkpoint);
        }
        return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, createEnvelope()), {
          components,
          documentRange: round2(this.rootScroll.pageRange()),
          scrollContainers,
          order,
          cutouts,
          exclusions
        }), canvasColor ? { canvasColor } : {}), Object.keys(panes).length > 0 ? { panes } : {}), motions.length > 0 ? { motions } : {}), Object.keys(tints).length > 0 ? { tints } : {});
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
  function scrollChannel(name) {
    const channel = name ? globalThis[`nativeIslandsScroll_${name}`] : void 0;
    return typeof (channel === null || channel === void 0 ? void 0 : channel.postMessage) === "function" ? channel : void 0;
  }
  function clockNow() {
    return Math.round(performance.now() * 1e3) / 1e3;
  }
  class NativeIslandsRuntime {
    constructor() {
      this.transport = createWebTransport();
      this.stacking = new StackingService((root) => this.observeShadowRoot(root), () => this.knownElements);
      this.transportDisposers = [];
      this.eventChannels = /* @__PURE__ */ new Map();
      this.eventListenerOrder = 0;
      this.knownLayers = /* @__PURE__ */ new WeakSet();
      this.knownElements = /* @__PURE__ */ new Set();
      this.transportPriority = Number.NEGATIVE_INFINITY;
      this.started = false;
      this.domObserver = null;
      this.shadowObservers = /* @__PURE__ */ new Map();
      this.pendingScrollOffsets = null;
      this.repairingScrollOffsets = false;
      this.applyingLayouts = 0;
      this.resetReady = Promise.resolve();
      this.resetPending = false;
      this.resetFailure = null;
      this.nativeHoldsEarlyOffsets = false;
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
      this.disposeEventSubscriptions();
      this.transport = transport;
      this.transportIdentity = options.identity;
      this.transportPriority = priority;
      this.stacking.compositionEnabled = transport.available;
      this.stacking.innerScrollMode = transport.innerScrollMode;
      this.stacking.commandsFollowLayouts = transport.ordered === true;
      this.attachEventSubscriptions();
      if (transport.available) {
        this.beginReset(transport, true);
        this.transportDisposers.push(this.listen("islandError", (event) => {
          if (event.island) {
            this.failIsland(event.island, typeof event.reason === "string" ? event.reason : "Native component failed.");
          }
        }));
        this.transportDisposers.push(
          // Deferred scroll failures name containers, not islands, so they route
          // to the scroll-failure path and never touch island lifecycle state.
          this.listen("scrollError", (event) => {
            const containers = event.containers;
            if (!Array.isArray(containers))
              return;
            this.stacking.failScrollContainers(containers.filter((id) => typeof id === "string"), typeof event.reason === "string" ? event.reason : "Native scroll synchronization failed.");
          })
        );
        this.transportDisposers.push(this.listen("scrollRejected", (event) => {
          const reason = typeof event.reason === "string" ? event.reason : "Native refused scroll offsets.";
          this.rejectScrollOffsets(new Error(reason), this.resetReady);
        }));
        if (typeof window !== "undefined") {
          const resetOnPageHide = () => {
            this.stacking.prepareForPageHide();
            this.beginReset(transport);
          };
          const reconcileOnPageShow = (event) => {
            if (event.persisted)
              void this.restoreAfterPageShow();
          };
          window.addEventListener("pagehide", resetOnPageHide);
          window.addEventListener("pageshow", reconcileOnPageShow);
          this.transportDisposers.push(() => window.removeEventListener("pagehide", resetOnPageHide));
          this.transportDisposers.push(() => window.removeEventListener("pageshow", reconcileOnPageShow));
        }
      }
      if (transport.available) {
        this.autostart();
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
    command(island, nativeComponent, method, properties, instance) {
      try {
        validateCommand(island, nativeComponent, method, properties);
      } catch (error) {
        return Promise.reject(error);
      }
      const reset = this.resetReady;
      return this.afterReset(() => {
        if (reset !== this.resetReady)
          return Promise.resolve();
        return this.transport.command(Object.assign(Object.assign(Object.assign({}, createEnvelope()), { island, islandType: nativeComponent, method, params: properties }), instance !== void 0 && { instance }));
      });
    }
    listen(eventName, listener, islandId) {
      var _a;
      let channel = this.eventChannels.get(eventName);
      const attach = !channel;
      if (!channel) {
        channel = { broadcast: /* @__PURE__ */ new Set(), islands: /* @__PURE__ */ new Map() };
        this.eventChannels.set(eventName, channel);
      }
      const entry = { callback: listener, order: this.eventListenerOrder++, active: true };
      const listeners = islandId === void 0 ? channel.broadcast : (_a = channel.islands.get(islandId)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Set();
      listeners.add(entry);
      if (islandId !== void 0)
        channel.islands.set(islandId, listeners);
      if (attach)
        this.attachEventSubscription(eventName, channel);
      return () => {
        var _a2;
        if (!entry.active)
          return;
        entry.active = false;
        listeners.delete(entry);
        if (islandId !== void 0 && listeners.size === 0)
          channel === null || channel === void 0 ? void 0 : channel.islands.delete(islandId);
        if (channel && channel.broadcast.size === 0 && channel.islands.size === 0) {
          (_a2 = channel.dispose) === null || _a2 === void 0 ? void 0 : _a2.call(channel);
          this.eventChannels.delete(eventName);
        }
      };
    }
    attachEventSubscriptions() {
      for (const [eventName, channel] of this.eventChannels)
        this.attachEventSubscription(eventName, channel);
    }
    attachEventSubscription(eventName, channel) {
      if (channel.dispose)
        return;
      channel.dispose = this.transport.on(eventName, createEnvelope(), (event) => {
        const targeted = typeof event.island === "string" ? channel.islands.get(event.island) : void 0;
        const listeners = [...channel.broadcast, ...targeted !== null && targeted !== void 0 ? targeted : []].sort((a, b) => a.order - b.order);
        for (const entry of listeners) {
          if (entry.active)
            entry.callback(event);
        }
      });
    }
    disposeEventSubscriptions() {
      var _a;
      for (const channel of this.eventChannels.values()) {
        (_a = channel.dispose) === null || _a === void 0 ? void 0 : _a.call(channel);
        channel.dispose = void 0;
      }
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
        const reset = this.resetReady;
        this.applyingLayouts++;
        const completeLayout = () => {
          if (reset !== this.resetReady)
            return;
          this.applyingLayouts--;
          if (!this.scrollOffsetsBlocked())
            this.flushScrollOffsets();
        };
        const sentAt = clockNow();
        return this.transport.applyLayout(Object.assign(Object.assign({}, payload), { sentAt })).catch((error) => {
          const reason = error instanceof Error && error.message ? `Native layout rejected: ${error.message}` : "Native layout rejected by the platform bridge.";
          if (reset === this.resetReady && !this.resetFailure) {
            for (const id of this.stacking.layoutRefused(payload, reason))
              this.failIsland(id, reason);
          }
          throw error;
        }).then((acknowledgement) => {
          if (reset !== this.resetReady)
            return;
          if (reset === this.resetReady && !this.resetFailure && (acknowledgement === null || acknowledgement === void 0 ? void 0 : acknowledgement.heldOffsets) === true) {
            this.nativeHoldsEarlyOffsets = true;
          }
          const appliedAt = acknowledgement === null || acknowledgement === void 0 ? void 0 : acknowledgement.appliedAt;
          if (typeof appliedAt === "number") {
            this.stacking.noteLayoutApplied(appliedAt - sentAt);
          }
          completeLayout();
        }, (error) => {
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
      for (const query of [
        "(prefers-color-scheme: dark)",
        "(prefers-contrast: more)",
        "(forced-colors: active)",
        "(prefers-reduced-motion: reduce)"
      ]) {
        window.matchMedia(query).addEventListener("change", () => {
          this.stacking.invalidateAutomaticLayers();
          this.refresh();
        });
      }
    }
    /**
     * Hold planning before invoking reset, including a synchronous custom reset.
     * A successful void result is a legacy backend; a rejection is a failed
     * session and must never be interpreted as a legacy success.
     */
    beginReset(transport, notifyAvailable = false) {
      this.resetPending = true;
      this.resetFailure = null;
      this.nativeHoldsEarlyOffsets = false;
      this.pendingScrollOffsets = null;
      this.repairingScrollOffsets = false;
      this.applyingLayouts = 0;
      this.stacking.beginTransportReset();
      const ready = Promise.resolve().then(() => transport.reset(createEnvelope())).then((capabilities) => {
        if (ready !== this.resetReady)
          return;
        this.nativeHoldsEarlyOffsets = (capabilities === null || capabilities === void 0 ? void 0 : capabilities.heldOffsets) === true;
        this.stacking.nativeAcceptsPaneColor = (capabilities === null || capabilities === void 0 ? void 0 : capabilities.paneColor) === true;
        this.stacking.nativeMotionStartsAtCommit = (capabilities === null || capabilities === void 0 ? void 0 : capabilities.motionStartsAtCommit) === true;
        this.stacking.nativeAlphaGradient = (capabilities === null || capabilities === void 0 ? void 0 : capabilities.tintAlphaGradient) === true;
        this.stacking.nativePaintFence = (capabilities === null || capabilities === void 0 ? void 0 : capabilities.paintFence) === true;
        if (notifyAvailable)
          this.stacking.notifyTransportAvailable();
        if (ready !== this.resetReady)
          return;
        this.resetPending = false;
        this.stacking.completeTransportReset();
      }).catch((error) => {
        const failure = new Error(error instanceof Error && error.message ? `Native initialization failed: ${error.message}` : "Native initialization failed while resetting the platform bridge.");
        if (ready === this.resetReady) {
          this.resetPending = false;
          this.resetFailure = failure;
          this.stacking.failTransportReset(failure);
        }
        throw failure;
      });
      this.resetReady = ready;
      void ready.catch(() => void 0);
    }
    async afterReset(action) {
      for (; ; ) {
        const ready = this.resetReady;
        try {
          await ready;
        } catch (error) {
          if (ready === this.resetReady)
            throw error;
        }
        if (ready === this.resetReady) {
          if (this.resetFailure)
            throw this.resetFailure;
          return action();
        }
      }
    }
    async restoreAfterPageShow() {
      let reset;
      try {
        await this.afterReset(() => {
          reset = this.resetReady;
          return this.stacking.recreateNativeViews();
        });
        if (reset === this.resetReady)
          this.stacking.refresh();
      } catch (error) {
        if (reset !== this.resetReady || this.resetFailure)
          return;
        const failure = new Error(error instanceof Error && error.message ? `Native restoration failed: ${error.message}` : "Native components could not be restored after page show.");
        this.resetFailure = failure;
        this.stacking.failTransportReset(failure);
      }
    }
    /** An old backend also needs its layout acknowledged before the next sample. */
    scrollOffsetsBlocked() {
      return this.resetPending || this.resetFailure !== null || this.applyingLayouts > 0 && !this.nativeHoldsEarlyOffsets;
    }
    enqueueScrollOffsets(payload) {
      if (this.resetPending || this.resetFailure)
        return Promise.resolve();
      this.pendingScrollOffsets = payload;
      this.flushScrollOffsets();
      return Promise.resolve();
    }
    /**
     * Native drops samples it has passed, so each frame's sample is sent without
     * waiting for the previous one to be acknowledged.
     */
    flushScrollOffsets() {
      const payload = this.pendingScrollOffsets;
      if (!payload || this.repairingScrollOffsets || this.scrollOffsetsBlocked())
        return;
      this.pendingScrollOffsets = null;
      const sample = Object.assign(Object.assign({}, payload), { sentAt: clockNow() });
      const channel = scrollChannel(this.transport.scrollChannel);
      if (channel) {
        channel.postMessage(JSON.stringify(sample));
        return;
      }
      const reset = this.resetReady;
      this.transport.applyScrollOffsets(sample).catch((error) => this.rejectScrollOffsets(error, reset));
    }
    /** Refusals arrive in send order, so any sent before a repair arrive during it. */
    rejectScrollOffsets(error, reset) {
      if (reset !== this.resetReady || this.resetPending || this.resetFailure || this.repairingScrollOffsets)
        return;
      void this.repairScrollOffsets(error, reset);
    }
    async repairScrollOffsets(error, reset) {
      this.repairingScrollOffsets = true;
      try {
        await this.repairScrollSynchronization(error, reset);
      } finally {
        if (reset === this.resetReady) {
          this.repairingScrollOffsets = false;
          this.flushScrollOffsets();
        }
      }
    }
    /**
     * Republishes the scene and sends one repair sample against it, awaiting the
     * transport rather than the queue, which resolves as soon as it stores a
     * payload. Awaiting the transport means the sample was accepted, which may
     * mean held for a layout still in flight, not that it has been presented.
     *
     * Usually native does not know a container this scene introduced, which a
     * fresh scene and sample resolve. Exactly one repair is attempted: a second
     * forced layout would only repeat, so a refused repair takes the islands down
     * instead of looping.
     */
    async repairScrollSynchronization(error, reset) {
      var _a, _b;
      const reason = error instanceof Error && error.message ? `Native scroll synchronization failed: ${error.message}` : "Native scroll synchronization failed.";
      let repair = null;
      try {
        await this.stacking.republish();
        if (reset !== this.resetReady || this.resetFailure)
          return;
        repair = this.stacking.captureScrollOffsets();
        if (repair)
          await this.transport.applyScrollOffsets(repair);
      } catch (_c) {
        if (reset !== this.resetReady || this.resetFailure)
          return;
        this.stacking.failScrollContainers((_b = (_a = repair !== null && repair !== void 0 ? repair : this.pendingScrollOffsets) === null || _a === void 0 ? void 0 : _a.offsets.map((offset) => offset.id)) !== null && _b !== void 0 ? _b : [], reason);
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
        this.stacking.handleDomMutations(records);
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
  const MAX_COMMAND_FAILURES = 3;
  const COMMAND_FAILURE_WINDOW_MS = 2e3;
  const WEB_PRESENTATION_OVERRIDES = /* @__PURE__ */ new Map([
    ["background-clip", "text"],
    ["-webkit-background-clip", "text"],
    ["border-image-source", "linear-gradient(transparent, transparent)"],
    ["border-image-slice", "1"],
    ["user-select", "none"],
    ["-webkit-user-select", "none"],
    ["-webkit-touch-callout", "none"]
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    installCommandLifecycleListeners();
    if (!options.tagName.includes("-")) {
      throw new TypeError("tagName must be a valid custom-element name.");
    }
    if (!options.nativeComponent.trim()) {
      throw new TypeError("nativeComponent must not be empty.");
    }
    const firstFrame = options.firstFrame && {
      event: options.firstFrame.event,
      timeoutMs: (_a = options.firstFrame.timeoutMs) !== null && _a !== void 0 ? _a : 2e3
    };
    if (firstFrame && (!firstFrame.event.trim() || !Number.isFinite(firstFrame.timeoutMs) || firstFrame.timeoutMs <= 0)) {
      throw new TypeError("firstFrame requires a native event and a positive timeoutMs.");
    }
    const observedAttributes = [...new Set((_b = options.observedAttributes) !== null && _b !== void 0 ? _b : [])];
    const observedStyles = [
      ...new Set(((_c = options.observedStyles) !== null && _c !== void 0 ? _c : []).map((property) => property.trim()).filter(Boolean))
    ];
    const structuralSignature2 = JSON.stringify({
      isInteractive: (_d = options.isInteractive) !== null && _d !== void 0 ? _d : false,
      accessibility: (_e = options.accessibility) !== null && _e !== void 0 ? _e : "web",
      requiresUnobscuredSurface: (_f = options.requiresUnobscuredSurface) !== null && _f !== void 0 ? _f : false,
      supportsProtectedSurfaceClip: (_g = options.supportsProtectedSurfaceClip) !== null && _g !== void 0 ? _g : false,
      observedAttributes: [...observedAttributes].sort(),
      observedStyles: [...observedStyles].sort(),
      preserveChildren: (_h = options.preserveChildren) !== null && _h !== void 0 ? _h : false,
      firstFrame: firstFrame && Object.assign(Object.assign({}, firstFrame), ((_j = options.firstFrame) === null || _j === void 0 ? void 0 : _j.startWhen) && { startWhen: true }),
      events: Object.entries((_k = options.events) !== null && _k !== void 0 ? _k : {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    });
    const existingDefinition = definitionState.definitions.get(options.tagName);
    if (existingDefinition) {
      if (existingDefinition.nativeComponent === options.nativeComponent) {
        if (existingDefinition.structuralSignature !== void 0 && existingDefinition.handlers !== void 0) {
          if (existingDefinition.structuralSignature !== structuralSignature2) {
            throw new Error(`<${options.tagName}> is already registered with a different definition contract.`);
          }
          existingDefinition.handlers.getProperties = options.getProperties;
          existingDefinition.handlers.renderFallback = options.renderFallback;
          existingDefinition.handlers.firstFrameStartWhen = (_l = options.firstFrame) === null || _l === void 0 ? void 0 : _l.startWhen;
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
      renderFallback: options.renderFallback,
      firstFrameStartWhen: (_m = options.firstFrame) === null || _m === void 0 ? void 0 : _m.startWhen
    };
    const reflectedAttributes = /* @__PURE__ */ new Set();
    const contract = {
      tagName: options.tagName,
      commands: ["create", "update"],
      observedAttributes,
      requiresUnobscuredSurface: (_o = options.requiresUnobscuredSurface) !== null && _o !== void 0 ? _o : false,
      supportsProtectedSurfaceClip: (_p = options.supportsProtectedSurfaceClip) !== null && _p !== void 0 ? _p : false
    };
    registerIslandContract(options.nativeComponent, contract);
    class DefinedNativeIsland extends HTMLElement {
      constructor() {
        var _a2, _b2, _c2;
        super();
        this.islandId = `native-island-${++definitionState.islandSequence}`;
        this.type = options.nativeComponent;
        this.interactive = (_a2 = options.isInteractive) !== null && _a2 !== void 0 ? _a2 : false;
        this.requiresUnobscuredSurface = (_b2 = options.requiresUnobscuredSurface) !== null && _b2 !== void 0 ? _b2 : false;
        this.supportsProtectedSurfaceClip = (_c2 = options.supportsProtectedSurfaceClip) !== null && _c2 !== void 0 ? _c2 : false;
        this.connected = false;
        this.mountGeneration = 0;
        this.activated = false;
        this.lifecycle = new IslandLifecycle(firstFrame !== void 0);
        this.firstFrameTimer = null;
        this.firstFrameTimedOut = false;
        this.firstFrameDeadlineStarted = false;
        this.failedCommand = null;
        this.commandFailures = [];
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
        return this.connected && !this.failed && nativeIslandsRuntime.available;
      }
      get failed() {
        return this.lifecycle.state === "failed";
      }
      get drawn() {
        return !firstFrame || this.lifecycle.state === "drawn";
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
        if (!this.connected || this.failed || this.activated)
          return;
        this.activateNative();
        nativeIslandsRuntime.refresh();
      }
      activateNative() {
        var _a2, _b2;
        if (!this.connected || this.failed || this.activated || !nativeIslandsRuntime.available)
          return;
        this.activated = true;
        if (this.drawn)
          this.presentNative();
        else
          this.renderFallback();
        if (firstFrame) {
          this.eventDisposers.push(nativeIslandsRuntime.listen(firstFrame.event, (event) => {
            if (!this.connected || !this.lifecycle.transition({ type: "drawn", instance: event.instance }))
              return;
            this.cancelFirstFrameTimer();
            if (this.firstFrameTimedOut && this.failedCommand === null)
              this.removeAttribute("data-native-islands-error");
            this.firstFrameTimedOut = false;
            if (this.nativeInactiveReason === null)
              this.presentNative();
            nativeIslandsRuntime.refresh();
          }, this.islandId));
        }
        for (const [nativeEvent, domEvent] of Object.entries((_a2 = options.events) !== null && _a2 !== void 0 ? _a2 : {})) {
          this.eventDisposers.push(nativeIslandsRuntime.listen(nativeEvent, (event) => {
            const detail = Object.assign({}, event);
            delete detail.island;
            delete detail.instance;
            this.dispatchEvent(new CustomEvent(domEvent, {
              bubbles: true,
              composed: true,
              detail
            }));
          }, this.islandId));
        }
        if (this.lifecycle.holdsView)
          void this.send("create");
        else
          (_b2 = handlers.getProperties) === null || _b2 === void 0 ? void 0 : _b2.call(handlers, this);
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
          this.lifecycle.transition({ type: "restarted" });
          this.failedCommand = null;
          this.commandFailures = [];
          this.nativeInactiveReason = null;
          this.activated = false;
          this.cancelFirstFrameTimer();
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
        if (this.activated) {
          this.scheduleUpdate();
        } else if (!nativeIslandsRuntime.available) {
          this.renderFallback();
        }
      }
      failNative(reason) {
        var _a2;
        if (!this.lifecycle.transition({ type: "failed" }))
          return;
        this.cancelFirstFrameTimer();
        this.activated = false;
        this.failedCommand = null;
        for (const dispose of this.eventDisposers.splice(0))
          dispose();
        (_a2 = this.accessibilityFace) === null || _a2 === void 0 ? void 0 : _a2.remove();
        this.accessibilityFace = null;
        this.reportError(reason);
      }
      reportError(reason, code) {
        this.setAttribute("data-native-islands-error", "");
        nativeIslandsRuntime.refresh();
        this.dispatchEvent(new CustomEvent("nativeislanderror", {
          bubbles: true,
          composed: true,
          detail: code ? { reason, code } : { reason }
        }));
      }
      nativeLayoutSent() {
        this.lifecycle.transition({ type: "sent" });
      }
      nativeLayoutApplied(holds) {
        if (!this.lifecycle.transition({ type: "applied", holds }))
          return holds ? this.creation : void 0;
        this.mountGeneration += 1;
        this.failedCommand = null;
        if (!holds) {
          this.creation = void 0;
          this.cancelFirstFrameTimer();
          if (firstFrame && this.connected)
            this.renderFallback();
          return;
        }
        if (!this.activated)
          return;
        if (!this.drawn)
          this.waitForFirstFrame();
        return this.creation = this.send("create");
      }
      nativeReset() {
        if (!this.lifecycle.transition({ type: "reset" }))
          return;
        this.mountGeneration += 1;
        this.creation = void 0;
        this.failedCommand = null;
        this.cancelFirstFrameTimer();
        if (firstFrame && this.connected)
          this.renderFallback();
      }
      showWebImplementation() {
        this.cancelFirstFrameTimer();
        this.activated = false;
        for (const dispose of this.eventDisposers.splice(0))
          dispose();
        if (this.connected)
          this.renderFallback();
      }
      setNativeInactive(reason) {
        const retry = this.lifecycle.holdsView ? this.failedCommand : null;
        if (retry) {
          this.failedCommand = null;
          void this.send(retry);
        }
        if (this.nativeInactiveReason === reason)
          return;
        this.nativeInactiveReason = reason;
        if (reason === null) {
          this.removeAttribute("data-native-islands-inactive");
          if (this.activated)
            this.presentNative();
        } else {
          this.setAttribute("data-native-islands-inactive", "");
          this.renderFallback();
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
        if (this.activated) {
          this.scheduleUpdate();
        } else if (!nativeIslandsRuntime.available) {
          this.renderFallback();
        }
      }
      readObservedStyleSnapshot() {
        const style = computedStyle(this);
        return JSON.stringify(observedStyles.map((property) => style.getPropertyValue(property)));
      }
      properties() {
        var _a2;
        if (observedStyles.length > 0) {
          this.observedStyleSnapshot = this.readObservedStyleSnapshot();
        }
        return (_a2 = handlers.getProperties) === null || _a2 === void 0 ? void 0 : _a2.call(handlers, this);
      }
      /**
       * Sends `create` or `update` to native. Transient failures are retried on
       * the next layout pass; three failures within `COMMAND_FAILURE_WINDOW_MS`
       * permanently fail the island.
       */
      async send(method) {
        const generation = this.mountGeneration;
        try {
          const properties = this.properties();
          this.startFirstFrameDeadline();
          await nativeIslandsRuntime.command(this.islandId, options.nativeComponent, method, properties, method === "create" ? this.lifecycle.instance : void 0);
        } catch (error) {
          if (!this.connected || generation !== this.mountGeneration || this.failed)
            return;
          const reason = error instanceof Error ? error.message : "Native command failed.";
          const now = Date.now();
          this.commandFailures = this.commandFailures.filter((at) => now - at < COMMAND_FAILURE_WINDOW_MS);
          this.commandFailures.push(now);
          if (this.commandFailures.length >= MAX_COMMAND_FAILURES) {
            this.failNative(reason);
            return;
          }
          this.failedCommand = this.failedCommand === "create" ? "create" : method;
          this.reportError(reason);
          return;
        }
        if (generation === this.mountGeneration && !this.failed && this.failedCommand === null && !this.firstFrameTimedOut && this.getAttribute("data-native-islands-error") !== null) {
          this.removeAttribute("data-native-islands-error");
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
          if (!this.connected || this.failed || !nativeIslandsRuntime.available || definitionState.commandsSuspended || commandGeneration !== definitionState.commandGeneration) {
            return;
          }
          if (((_a2 = options.accessibility) !== null && _a2 !== void 0 ? _a2 : "web") === "web" && refreshPresentation && this.drawn) {
            this.renderAccessibilityFace();
          }
          if (this.lifecycle.holdsView)
            void this.send("update");
        });
      }
      presentNative() {
        var _a2;
        if (!this.drawn)
          return;
        this.restoreFallbackPresentation();
        if (((_a2 = options.accessibility) !== null && _a2 !== void 0 ? _a2 : "web") === "web") {
          this.renderAccessibilityFace();
        }
        this.hideWebPresentation();
      }
      waitForFirstFrame() {
        this.cancelFirstFrameTimer();
        this.firstFrameDeadlineStarted = false;
        this.renderFallback();
      }
      startFirstFrameDeadline() {
        var _a2;
        if (!firstFrame || this.drawn || this.firstFrameDeadlineStarted || ((_a2 = handlers.firstFrameStartWhen) === null || _a2 === void 0 ? void 0 : _a2.call(handlers, this)) === false)
          return;
        this.firstFrameDeadlineStarted = true;
        this.firstFrameTimer = setTimeout(() => {
          this.firstFrameTimer = null;
          this.firstFrameTimedOut = true;
          this.reportError(`Native first frame was not reported within ${firstFrame.timeoutMs} ms.`, "firstFrameTimeout");
        }, firstFrame.timeoutMs);
      }
      cancelFirstFrameTimer() {
        if (this.firstFrameTimer !== null)
          clearTimeout(this.firstFrameTimer);
        this.firstFrameTimer = null;
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
      structuralSignature: structuralSignature2,
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
  function callForCapabilities(action, payload) {
    const exec = cordovaWindow()?.cordova?.exec;
    if (!exec) {
      return Promise.reject(Object.assign(new Error("Cordova is not available."), { code: "unavailable" }));
    }
    return new Promise((resolve, reject) => {
      exec(
        (result) => resolve(result),
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
      innerScrollMode: platform() === "ios" ? "native" : platform() === "android" ? "bridge" : "unsupported",
      scrollChannel: SERVICE,
      applyLayout(payload) {
        return callForCapabilities("applyLayout", payload);
      },
      applyScrollOffsets(payload) {
        return call("applyScrollOffsets", payload);
      },
      async command(request) {
        await call("command", request);
      },
      reset(envelope) {
        return callForCapabilities("reset", envelope);
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
    installFallbackStyles(styleRootFor(element));
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
=======
(function(){"use strict";class Ho{constructor(t,e){this.timeoutMs=t,this.onTimeout=e,this.phase={name:"idle"},this.timedOut=!1}rearm(){this.cancel(),this.phase={name:"idle"}}start(t){if(this.phase.name!=="idle"||!t())return;const e=setTimeout(()=>{this.phase={name:"spent"},this.timedOut=!0,this.onTimeout()},this.timeoutMs);this.phase={name:"running",timer:e}}cancel(){this.phase.name==="running"&&(clearTimeout(this.phase.timer),this.phase={name:"spent"})}drawn(){this.cancel();const t=this.timedOut;return this.timedOut=!1,t}}function me(s,t){const e=Symbol.for(`@capacitor/native-islands/${s}`),n=typeof window>"u"?globalThis:window,i=n[e];if(i!==void 0)return i;const o=t();return n[e]=o,o}const Pt=me("hosts/v1",()=>({hosts:new WeakSet,changes:new WeakMap}));function Vo(s,t){const e=Pt.changes.get(s);e!=="all"&&(t===null?Pt.changes.set(s,"all"):e?e.add(t):Pt.changes.set(s,new Set([t])))}function Uo(s){Pt.hosts.add(s)}function Yo(s){const t=s.parentElement;return t&&Pt.hosts.has(t)?t:null}function Xo(s,t){if(t&&Pt.hosts.has(s))return!0;for(let e=s,n=s.parentElement;n;e=n,n=n.parentElement)if(Pt.hosts.has(n))return e.hasAttribute("data-native-islands-hosted");return!1}const cs=me("contracts/v1",()=>new Map);function Go(s,t){const e=cs.get(s);if(!e){cs.set(s,t);return}if(JSON.stringify(e)!==JSON.stringify(t))throw new Error(`Native component "${s}" is already registered by <${e.tagName}>.`)}class Ko{constructor(t){this.firstFrame=t,this.state="pending",this.instance=1}get holdsView(){return this.state==="created"||this.state==="drawn"}transition(t){const e=this.next(t);return e===null?!1:((e==="released"&&this.holdsView||t.type==="restarted")&&(this.instance+=1),this.state=e,!0)}next(t){const{state:e}=this;if(e==="failed")return t.type==="restarted"?"pending":null;switch(t.type){case"sent":return e==="pending"||e==="released"?"staged":null;case"applied":return t.holds?this.holdsView?null:this.firstFrame?"created":"drawn":this.holdsView?"released":null;case"drawn":return e==="created"&&t.instance===this.instance?"drawn":null;case"failed":return"failed";case"reset":return e==="pending"?null:"released";case"restarted":return null}}}const dn=new Map([["background-clip","text"],["-webkit-background-clip","text"],["border-image-source","linear-gradient(transparent, transparent)"],["border-image-slice","1"],["user-select","none"],["-webkit-user-select","none"],["-webkit-touch-callout","none"]]),Jo=new Map([["position","absolute"],["width","1px"],["height","1px"],["padding","0"],["margin","-1px"],["overflow","hidden"],["clip","rect(0, 0, 0, 0)"],["clip-path","inset(50%)"],["white-space","nowrap"],["border","0"],["pointer-events","none"]]);class Zo{constructor(t,e){this.element=t,this.options=e,this.nativePaint=null,this.fallbackAttributes=new Map,this.fallbackOnClick=null,this.accessibilityFace=null}showWeb(){var t;const{element:e}=this;this.restoreWebPaint(),this.undoFallback();const n=new Map(e.getAttributeNames().map(o=>[o,e.getAttribute(o)])),i=e.onclick;this.options.render(e);for(const o of new Set([...n.keys(),...e.getAttributeNames()])){if(o==="data-native-islands-fallback")continue;const r=(t=n.get(o))!==null&&t!==void 0?t:null,a=e.getAttribute(o);r!==a&&this.fallbackAttributes.set(o,{before:r,after:a})}i!==e.onclick&&(this.fallbackOnClick={before:i,after:e.onclick}),e.setAttribute("data-native-islands-fallback","")}showNative(){this.undoFallback(),this.refreshAccessibility(),this.hideWebPaint()}refreshAccessibility(){var t;if(!this.options.webAccessibility)return;(t=this.accessibilityFace)===null||t===void 0||t.remove();const e=document.createElement("div");for(const n of this.element.getAttributeNames()){if(n==="id"||n==="style"||n==="data-native-islands-fallback")continue;const i=this.element.getAttribute(n);i!==null&&e.setAttribute(n,i)}this.options.render(e),e.setAttribute("data-native-islands-accessibility-face","");for(const[n,i]of Jo)e.style.setProperty(n,i,"important");this.element.append(e),this.accessibilityFace=e}removeAccessibility(){var t;(t=this.accessibilityFace)===null||t===void 0||t.remove(),this.accessibilityFace=null}restoreWebPaint(){const t=this.nativePaint;if(!t)return;const{style:e}=this.element;for(const[n,i]of dn){if(e.getPropertyValue(n)!==i||e.getPropertyPriority(n)!=="important")continue;const o=t.get(n);o?.value?e.setProperty(n,o.value,o.priority):e.removeProperty(n)}this.element.removeAttribute("data-native-islands-presentation-hidden"),this.nativePaint=null}hideWebPaint(){const{style:t}=this.element;if(!(this.nativePaint||typeof t.getPropertyValue!="function")){this.nativePaint=new Map(Array.from(dn.keys(),e=>[e,{value:t.getPropertyValue(e),priority:t.getPropertyPriority(e)}]));for(const[e,n]of dn)t.setProperty(e,n,"important");this.element.setAttribute("data-native-islands-presentation-hidden","")}}undoFallback(){const{element:t}=this;t.removeAttribute("data-native-islands-fallback");for(const[e,n]of this.fallbackAttributes)t.getAttribute(e)===n.after&&(n.before===null?t.removeAttribute(e):t.setAttribute(e,n.before));this.fallbackAttributes.clear(),this.fallbackOnClick&&t.onclick===this.fallbackOnClick.after&&(t.onclick=this.fallbackOnClick.before),this.fallbackOnClick=null,this.removeAccessibility(),this.options.keepsChildren||this.clearChildren()}clearChildren(){const{element:t}=this;if(typeof t.replaceChildren=="function"){t.replaceChildren();return}for(;t.firstChild;)t.removeChild(t.firstChild)}}const hn=3,us=2e3;class Qo{constructor(){this.islands=new Map,this.unnamed=null}refuse(t,e,n){var i;const o=t.components.map(d=>d.id),r=o.filter(d=>e.includes(`'${d}'`)),a=performance.now(),c=(i=t.layoutSeq)!==null&&i!==void 0?i:Number.POSITIVE_INFINITY,l=d=>d&&c<=d.seq?null:{count:d&&a-d.at<us?d.count+1:1,at:a,seq:n};if(r.length===0){const d=l(this.unnamed);if(!d)return[];if(this.unnamed=d,d.count<hn||o.length===0)return[];this.unnamed=null;for(const h of o)this.islands.delete(h);return o}const u=[];for(const d of r){const h=l(this.islands.get(d));h&&(h.count>=hn?(this.islands.delete(d),u.push(d)):this.islands.set(d,Object.assign(Object.assign({},h),{held:!0,reason:e})))}return u}accept(t){var e;this.unnamed=null;let n=!1;for(const[i,o]of this.islands)if(o.held){if(((e=t.layoutSeq)!==null&&e!==void 0?e:Number.POSITIVE_INFINITY)<=o.seq)continue;o.held=!1,n=!0}else t.components.some(r=>r.id===i&&r.active)&&this.islands.delete(i);return n}heldReason(t){const e=this.islands.get(t);return e?.held?e.reason:void 0}}function tr(){return{available:!1,innerScrollMode:"unsupported",async applyLayout(){},async applyScrollOffsets(){},async command(){},reset(){},on(){return()=>{}}}}let mt=null,ge=null,it=null,ve=null;function er(s){const t={styleMemo:mt,planMemos:ge};mt=new WeakMap,ge=new Map;try{return s()}finally{({styleMemo:mt,planMemos:ge}=t)}}function ds(s){const t={readStyles:it,readMemos:ve};it=new WeakMap,ve=new Map;try{return s()}finally{({readStyles:it,readMemos:ve}=t)}}function hs(s,t,e,n){if(!s)return n();let i=s.get(t);if(i||(i=new WeakMap,s.set(t,i)),i.has(e))return i.get(e);const o=n();return i.set(e,o),o}function jt(s,t,e){return hs(ge,s,t,e)}function fs(s,t,e){return hs(ve,s,t,e)}function fn(s,t,e){return it?jt(s,t,e):e()}function k(s,t){var e,n;const i=t??"own",o=(e=it?.get(s))===null||e===void 0?void 0:e[i];if(o)return o;let r=t?void 0:mt?.get(s);if(r||(r=t?getComputedStyle(s,t):getComputedStyle(s),t||mt?.set(s,r)),it){const a=it;r=nr(r,a);const c=(n=a.get(s))!==null&&n!==void 0?n:{};c[i]=r,a.set(s,c)}return r}const pn=Symbol("styleRead"),ps=Object.create(new Proxy({},{get:(s,t,e)=>{const n=e[pn];return typeof t!="string"?Reflect.get(n.declaration,t,n.declaration):(Object.defineProperty(ps,t,{get(){return ms(this[pn],t)}}),ms(n,t))}}));function nr(s,t){const e=new Map,n=o=>{const r=`css:${o}`;if(it===t&&e.has(r))return e.get(r);const a=s.getPropertyValue(o);return it===t&&e.set(r,a),a},i=Object.create(ps);return i[pn]={declaration:s,scope:t,values:e,property:n},i}function ms(s,t){if(t==="getPropertyValue")return s.property;const e=it===s.scope;if(e){const o=s.values.get(t);if(o!==void 0||s.values.has(t))return o}const n=Reflect.get(s.declaration,t,s.declaration),i=typeof n=="function"?n.bind(s.declaration):n;return e&&s.values.set(t,i),i}function F(s,t,e="none"){const n=s.getPropertyValue(t).trim();return n!==""&&n!==e}function mn(s){return F(s,"backdrop-filter")||F(s,"-webkit-backdrop-filter")}function Xt(s){return[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(t=>Number.parseFloat(t)||0)}function Wt(s){return s.textShadow!==""&&s.textShadow!=="none"}function M(s){return fs("composedParent",s,()=>sr(s))}function sr(s){if(typeof HTMLElement<"u"&&s instanceof HTMLElement&&s.assignedSlot)return s.assignedSlot;if(s.parentElement)return s.parentElement;if(typeof s.getRootNode!="function")return null;const t=s.getRootNode();return typeof ShadowRoot<"u"&&t instanceof ShadowRoot&&typeof HTMLElement<"u"&&t.host instanceof HTMLElement?t.host:null}function ir(s,t){for(let e=t;e;e=M(e))if(e===s)return!0;return!1}function U(s,t){const e=globalThis.__nativeIslandsTrace;Array.isArray(e)&&e.push(Object.assign({at:performance.now(),event:s},t))}function Bt(){return Array.isArray(globalThis.__nativeIslandsTrace)}const be="[data-native-islands-opaque-surface]";function gs(s){const t=Array.from(s.querySelectorAll("*"));return s instanceof HTMLElement?[s,...t]:t}class or{constructor(t){this.page=t,this.elements=new Set,this.layers=new WeakSet,this.shadowObservers=new Map}watchDocument(){this.elements.add(document.documentElement),this.scan(document.body),new MutationObserver(t=>this.handleMutations(t)).observe(document.body,{attributes:!0,attributeFilter:["data-native-islands-opaque-surface"],childList:!0,subtree:!0})}watchRootsOf(t){if(typeof ShadowRoot>"u"||typeof t.getRootNode!="function")return;const e=new Set;for(let n=t;n;n=M(n)){const i=n.getRootNode();i instanceof ShadowRoot&&!e.has(i)&&(e.add(i),this.watchShadowRoot(i))}}watchShadowRoot(t){if(this.shadowObservers.has(t))return;this.page.observeEffectRoot(t),this.scan(t);const e=new MutationObserver(n=>{this.handleMutations(n),this.page.handleDomMutations(n)});e.observe(t,{attributes:!0,characterData:!0,childList:!0,subtree:!0}),this.shadowObservers.set(t,e)}handleMutations(t){if(!Bt())return this.applyMutations(t);const e=performance.now();try{this.applyMutations(t)}finally{U("scan",{ms:performance.now()-e,records:t.length})}}applyMutations(t){for(const e of t){if(e.type==="attributes"&&e.target instanceof HTMLElement){e.target.matches(be)?this.addLayer(e.target):this.layers.delete(e.target)&&this.page.unregister(e.target);continue}for(const n of e.addedNodes)n instanceof HTMLElement&&this.scan(n);for(const n of e.removedNodes)n instanceof HTMLElement&&this.forget(n)}}scan(t){t instanceof HTMLElement&&t.matches(be)&&this.addLayer(t);for(const e of t.querySelectorAll(be))this.addLayer(e);for(const e of gs(t))this.elements.add(e),e.shadowRoot&&this.watchShadowRoot(e.shadowRoot)}addLayer(t){this.layers.has(t)||(this.layers.add(t),this.page.registerLayer({el:t}))}forget(t){var e;t instanceof ShadowRoot&&((e=this.shadowObservers.get(t))===null||e===void 0||e.disconnect(),this.shadowObservers.delete(t),this.page.unobserveEffectRoot(t));for(const n of gs(t))this.elements.delete(n),n.matches(be)&&(this.layers.delete(n),this.page.unregister(n)),n.shadowRoot&&this.forget(n.shadowRoot)}}class rr{constructor(){this.transport=null,this.channels=new Map,this.nextOrder=0}attach(t){var e;for(const n of this.channels.values())(e=n.unsubscribe)===null||e===void 0||e.call(n),n.unsubscribe=void 0;this.transport=t;for(const[n,i]of this.channels)this.subscribe(n,i)}listen(t,e,n){var i;let o=this.channels.get(t);o||(o={broadcast:new Set,islands:new Map},this.channels.set(t,o),this.subscribe(t,o));const r={callback:e,order:this.nextOrder++,active:!0},a=n===void 0?o.broadcast:(i=o.islands.get(n))!==null&&i!==void 0?i:new Set;a.add(r),n!==void 0&&o.islands.set(n,a);const c=o;return()=>{var l;r.active&&(r.active=!1,a.delete(r),n!==void 0&&a.size===0&&c.islands.delete(n),c.broadcast.size===0&&c.islands.size===0&&((l=c.unsubscribe)===null||l===void 0||l.call(c),this.channels.delete(t)))}}subscribe(t,e){this.transport&&(e.unsubscribe=this.transport.on(t,n=>{const i=typeof n.island=="string"?e.islands.get(n.island):void 0,o=[...e.broadcast,...i??[]].sort((r,a)=>r.order-a.order);for(const r of o)r.active&&r.callback(n)}))}}const D=[0,0,0,0];let $t=null,B=null;function ar(s){const t=B;B={bounds:new WeakMap};try{return s()}finally{B=t}}function lr(s){const t=B;B=null;try{return s()}finally{B=t}}function cr(s,t){const e=$t,n=B;$t=s,B&&(B={bounds:new WeakMap,scroll:B.scroll});try{return t()}finally{$t=e,B=n}}function I(s,t){var e;const n=t?void 0:B?.bounds.get(s);if(n)return n;const i=t??s.getBoundingClientRect(),o=(e=$t?.(s,i))!==null&&e!==void 0?e:i;return t||B?.bounds.set(s,o),o}function S(s){return Math.round(s*100)/100}function Gt(s,t,e){const n=[];for(const c of[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius]){const[l,u=l]=c.trim().split(/\s+/),d=Kt(l,t),h=Kt(u,e);if(d===null||h===null||Math.abs(d-h)>.5)return null;n.push((d+h)/2)}const[i,o,r,a]=n;return Ot([i,o,r,a],t,e)}function vs(s,t,e){const n=bs(s,t,e).map(([i,o])=>Math.min(i,o));return Ot([n[0],n[1],n[2],n[3]],t,e)}function ur(s,t,e){return bs(s,t,e).some(([n,i])=>Math.abs(n-i)>.5)}function bs(s,t,e){return[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius].map(n=>{var i,o;const[r,a=r]=(n??"").trim().split(/\s+/);return[(i=Kt(r??"0",t))!==null&&i!==void 0?i:0,(o=Kt(a??"0",e))!==null&&o!==void 0?o:0]})}function Ot([s,t,e,n],i,o){const r=(l,u)=>l>0?u/l:1,a=Math.min(1,r(s+t,i),r(n+e,i),r(s+n,o),r(t+e,o)),c=l=>S(Math.max(0,l)*a);return[c(s),c(t),c(e),c(n)]}function gn(s,t){const[e,n,i,o]=s.map(r=>S(Math.max(0,r-t)));return[e,n,i,o]}function Kt(s,t){if(/^0+(?:\.0*)?$/.test(s))return 0;const e=/^(\S+?)(px|%)$/.exec(s);if(!e)return null;const n=Number(e[1]);return!Number.isFinite(n)||n<0?null:e[2]==="%"?n*t/100:n}function nt(s){var t;const e=B?(t=B.scroll)!==null&&t!==void 0?t:B.scroll=ys():ys();return Ss(I(s),e.x,e.y)}function ys(){return{x:window.scrollX,y:window.scrollY}}function ye(s){return Ss(I(s),0,0)}function we(s){return s==="document"?{x:window.scrollX,y:window.scrollY,w:window.innerWidth,h:window.innerHeight}:{x:0,y:0,w:window.innerWidth,h:window.innerHeight}}function Se(s){return Object.assign(Object.assign({},s),{x:S(s.x-window.scrollX),y:S(s.y-window.scrollY)})}function ws(s){return{x:s.left+window.scrollX,y:s.top+window.scrollY,w:s.width,h:s.height}}function Ss(s,t,e){const n=S(s.left+t),i=S(s.top+e),o=S(s.left+s.width+t),r=S(s.top+s.height+e);return{x:n,y:i,w:S(o-n),h:S(r-i)}}function _t(s){return s!==null&&s.w>0&&s.h>0}function ke(s){var t;const e=(t=s.r)!==null&&t!==void 0?t:D;return[s.x,s.y,s.w,s.h,...e].every(Number.isFinite)&&s.w>0&&s.h>0&&e.every(n=>n>=0)}function H(s,t){return s.x<t.x+t.w&&t.x<s.x+s.w&&s.y<t.y+t.h&&t.y<s.y+s.h}function Jt(s,t){const e=Math.max(s.x,t.x),n=Math.max(s.y,t.y),i=Math.min(s.x+s.w,t.x+t.w),o=Math.min(s.y+s.h,t.y+t.h);return i<=e||o<=n?null:{x:S(e),y:S(n),w:S(i-e),h:S(o-n)}}const gt=.5;function Zt(s,t){const e=Math.min(s.x,t.x),n=Math.min(s.y,t.y);return{x:e,y:n,w:Math.max(s.x+s.w,t.x+t.w)-e,h:Math.max(s.y+s.h,t.y+t.h)-n}}function lt(s,t){return t.x>=s.x-gt&&t.y>=s.y-gt&&t.x+t.w<=s.x+s.w+gt&&t.y+t.h<=s.y+s.h+gt}function dr(s,t){return H(s,t)&&!lt(s,t)&&!lt(t,s)}function vn(s){const t=o=>o.w*o.h,e=s.filter((o,r)=>!s.some((a,c)=>{if(c===r||!lt(a,o))return!1;const l=t(a),u=t(o);return l>u||l===u&&c<r})),n=new Set(e.map((o,r)=>r)),i=[];for(;n.size>0;){const o=n.values().next().value,r=[o];n.delete(o);for(const c of r)for(const l of Array.from(n))H(e[c],e[l])&&(r.push(l),n.delete(l));const a=r.map(c=>e[c]);if(a.length===1||a.some(kt)){i.push(...a);continue}i.push(...ks(a,c=>c))}return i.sort((o,r)=>o.y-r.y||o.x-r.x||o.w-r.w||o.h-r.h)}function hr(s,t){const e=t.reduce((n,i)=>{const o=Jt(s,i);return o&&n.push(o),n},[]);return e.length===0?[Object.assign(Object.assign({},s),{r:D})]:ks(e,n=>!n,s).map(n=>Object.assign(Object.assign({},n),{r:D}))}function ks(s,t,e){const n=(a,c)=>{const l=e?[e[a],e[a]+e[c]]:[];for(const u of s)l.push(u[a],u[a]+u[c]);return Array.from(new Set(l)).sort((u,d)=>u-d)},i=n("x","w"),o=n("y","h"),r=[];for(let a=0;a<o.length-1;a++){const c=o[a],l=o[a+1]-c;let u=null;for(let d=0;d<i.length-1;d++){const h=i[d],f=t(s.some(x=>h>=x.x&&i[d+1]<=x.x+x.w&&c>=x.y&&o[a+1]<=x.y+x.h));f&&u===null&&(u=h);const p=d===i.length-2;if(u===null||f&&!p)continue;const w=(f&&p?i[d+1]:h)-u,g=u,v=r.find(x=>x.x===g&&x.w===w&&x.y+x.h===c);v?v.h+=l:r.push({x:g,y:c,w,h:l}),u=null}}return r}function ct(s,t){var e,n;if(!lt(s,t))return!1;if(Math.abs(s.x-t.x)<=gt&&Math.abs(s.y-t.y)<=gt&&Math.abs(s.w-t.w)<=gt&&Math.abs(s.h-t.h)<=gt&&((e=s.r)!==null&&e!==void 0?e:D).every((l,u)=>{var d;return Math.abs(l-((d=t.r)!==null&&d!==void 0?d:D)[u])<=gt}))return!0;const[i,o,r,a]=Ot((n=s.r)!==null&&n!==void 0?n:D,s.w,s.h);return[[t.x,t.y,i],[t.x+t.w,t.y,o],[t.x,t.y+t.h,a],[t.x+t.w,t.y+t.h,r]].every(([l,u,d],h)=>{if(d<=0)return!0;const f=h===0||h===2,p=h<2,y=f?s.x+d:s.x+s.w-d,w=p?s.y+d:s.y+s.h-d;return!((f?l<y:l>y)&&(p?u<w:u>w))||(l-y)**2+(u-w)**2<=d**2})}function kt(s){var t;return((t=s.r)!==null&&t!==void 0?t:D).some(e=>e>0)}function xs(s,t){const e=S(s.w),n=S(s.h);let i=`M0 0 H${e} V${n} H0 Z`;for(const o of t)i+=As(s,o);return i}function As(s,t){var e;const n=S(t.x-s.x),i=S(t.y-s.y),[o,r,a,c]=Ot((e=t.r)!==null&&e!==void 0?e:D,t.w,t.h);return` M${S(n+o)} ${i} A${o} ${o} 0 0 0 ${n} ${S(i+o)} L${n} ${S(i+t.h-c)} A${c} ${c} 0 0 0 ${S(n+c)} ${S(i+t.h)} L${S(n+t.w-a)} ${S(i+t.h)} A${a} ${a} 0 0 0 ${S(n+t.w)} ${S(i+t.h-a)} L${S(n+t.w)} ${S(i+r)} A${r} ${r} 0 0 0 ${S(n+t.w-r)} ${i} Z`}function fr(s,t){return`path("${xs(s,t)}")`}function Cs(s,t){const e=S(s.w),n=S(s.h),i=t.map(o=>`<path d="${As(s,o).trim()}" fill="black"/>`).join("");return`<mask id="ni-knockout" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${e}" height="${n}" style="mask-type:luminance"><rect width="${e}" height="${n}" fill="white"/>${i}</mask>`}function pr(s,t){const e=S(s.w),n=S(s.h);return`<svg xmlns="http://www.w3.org/2000/svg" width="${e}" height="${n}" viewBox="0 0 ${e} ${n}"><defs>${Cs(s,t)}</defs><rect width="${e}" height="${n}" fill="white" mask="url(#ni-knockout)"/></svg>`}function xe(s){return Math.round(s*1e3)/1e3}function N(s){return Math.round(s*1e4)/1e4}function Rs([s,t,e,n],i){return[S(s*i),S(t*i),S(e*i),S(n*i)]}function Ms(s,t,e,[n,i]){if(n===1&&i===1)return Gt(s,t,e);const o=Gt(s,t/n,e/i);return o&&Rs(o,n)}function Ae(s,t,e){return s instanceof Error&&s.message?`${t}: ${s.message}`:e}function Ps(){return xe(performance.now())}function mr(s){const t=s?globalThis[`nativeIslandsScroll_${s}`]:void 0;return typeof t?.postMessage=="function"?t:void 0}class gr{constructor(t,e){this.transport=t,this.host=e,this.status={phase:"resetting"},this.ended=!1,this.holdsEarlyOffsets=!1,this.layoutsInFlight=0,this.waitingOffsets=null,this.repairing=!1,this.ready=Promise.resolve().then(()=>t.reset()).then(n=>{this.ended||(this.holdsEarlyOffsets=n?.heldOffsets===!0,this.status={phase:"ready"},e.ready(n??{}))}).catch(n=>{const i=new Error(Ae(n,"Native initialization failed","Native initialization failed while resetting the platform bridge."));throw this.ended||this.fail(i),i}),this.ready.catch(()=>{})}get state(){return this.status}get current(){return!this.ended}end(){this.ended=!0}fail(t){this.status={phase:"failed",failure:t},this.host.failed(t)}applyLayout(t){this.layoutsInFlight++;const e=()=>{this.ended||(this.layoutsInFlight--,this.flushOffsets())},n=Ps();return this.transport.applyLayout(Object.assign(Object.assign({},t),{sentAt:n})).catch(i=>{if(!this.ended&&this.state.phase!=="failed"){const o=Ae(i,"Native layout rejected","Native layout rejected by the platform bridge.");this.host.refused(t,o)}throw i}).then(i=>{this.ended||(this.state.phase!=="failed"&&i?.heldOffsets===!0&&(this.holdsEarlyOffsets=!0),typeof i?.appliedAt=="number"&&this.host.applied(i.appliedAt-n),e())},i=>{throw e(),i})}sendOffsets(t){this.state.phase==="ready"&&(this.waitingOffsets=t,this.flushOffsets())}offsetsRefused(t){this.ended||this.state.phase!=="ready"||this.repairing||this.repairOffsets(t)}flushOffsets(){var t;const e=this.waitingOffsets;if(!e||this.repairing||this.offsetsBlocked())return;this.waitingOffsets=null;const n=Object.assign(Object.assign({},e),{sentAt:(t=e.sentAt)!==null&&t!==void 0?t:Ps()}),i=mr(this.transport.scrollChannel);if(i){i.postMessage(JSON.stringify(n));return}this.transport.applyScrollOffsets(n).catch(o=>this.offsetsRefused(o))}offsetsBlocked(){return this.state.phase!=="ready"||this.layoutsInFlight>0&&!this.holdsEarlyOffsets}async repairOffsets(t){var e,n;this.repairing=!0;let i=null;try{if(await this.host.republish(),this.ended||this.state.phase==="failed")return;i=this.host.captureOffsets(),i&&await this.transport.applyScrollOffsets(i)}catch{if(this.ended||this.state.phase==="failed")return;this.host.scrollFailed((n=(e=i??this.waitingOffsets)===null||e===void 0?void 0:e.offsets.map(r=>r.id))!==null&&n!==void 0?n:[],Ae(t,"Native scroll synchronization failed","Native scroll synchronization failed."))}finally{this.ended||(this.repairing=!1,this.flushOffsets())}}}class qt extends Error{constructor(t){super(t),this.code="invalid_request",this.name="NativeIslandError"}}function vr(s,t,e,n){if(!s)throw new qt("Invalid native island id.");if(!t)throw new qt("Invalid native component name.");if(!e)throw new qt("Invalid native command.");if(n===void 0)return;if(n===null||typeof n!="object"||Array.isArray(n))throw new qt("Native island properties must be a JSON object.");let i;try{i=JSON.stringify(n)}catch{throw new qt("Native island properties must be JSON-compatible.")}if(i===void 0)throw new qt("Native island properties must be JSON-compatible.")}function Ce(s){return[s.overflowX,s.overflowY].some(t=>t==="hidden"||t==="clip")}function Re(s){return s==="auto"||s==="scroll"||s==="hidden"}function Qt(s){return/(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(s.getPropertyValue("contain").trim())}function Et(s){const t=s.getPropertyValue("overflow-clip-margin").trim();return t!==""&&t!=="0"&&t!=="0px"}function Os(s,t){if(!s.hasAttribute("data-ni-runtime-clip"))return!1;const e=s.style.getPropertyValue("clip-path");return e!==""&&s.style.getPropertyPriority("clip-path")===""&&t.clipPath===e}const _s=["mask-image","mask-size","mask-position","mask-repeat","mask-mode","mask-composite","mask-clip","mask-origin"];function Me(s,t){return s.hasAttribute("data-ni-runtime-clip")&&_s.every(e=>s.style.getPropertyValue(e)!==""&&s.style.getPropertyPriority(e)===""&&t.getPropertyValue(e)===s.style.getPropertyValue(e))}let vt=null;function br(s){const t=vt;vt=t??new WeakMap;try{return s()}finally{vt=t}}function yr(s,t){const e=vt?.get(s);if(e!==void 0)return e;const n=Re(t.overflowX)&&s.scrollWidth>s.clientWidth+1||Re(t.overflowY)&&s.scrollHeight>s.clientHeight+1;return vt?.set(s,n),n}function Pe(s){return[...jt("scrollContainers",s,()=>wr(s))]}function wr(s){const t=[];let e=k(s).position,n=M(s);for(;n;){const i=k(n);(e==="fixed"?Oe(n):e!=="absolute"||i.position!=="static"||Oe(n))&&(n!==document.body&&n!==document.documentElement&&yr(n,i)&&t.push(n),e=i.position),n=M(n)}return t}function Oe(s){const t=k(s),e=r=>r!==void 0&&r!==""&&r!=="none",n=new Set(t.contain.split(/\s+/).filter(Boolean)),i=new Set(t.willChange.split(",").map(r=>r.trim()).filter(Boolean)),o=["translate","scale","rotate"].some(r=>F(t,r))||i.has("transform");return e(t.transform)||o||e(t.perspective)||e(t.filter)||e(t.getPropertyValue("backdrop-filter"))||n.has("layout")||n.has("paint")||n.has("strict")||n.has("content")||t.contentVisibility==="auto"||t.contentVisibility==="hidden"||i.has("perspective")||i.has("filter")}function Es(s,t,e){var n;const i=I(s),o=i.right-i.left,r=i.bottom-i.top,a=(n=Gt(t,o,r))!==null&&n!==void 0?n:vs(t,o,r),[c,l,u,d]=Xt(t),h=gn(a,Math.min(c,l,u,d)),f=Qt(t),p=h.some(m=>m>0),y=f||p||t.overflowX!=="visible",w=f||p||t.overflowY!=="visible",g=Sr(t),v=i.left+d-g,x=i.top+c-g;return{x:y?v:Math.min(v,e.left),y:w?x:Math.min(x,e.top),w:y?Math.max(0,o-d-l+2*g):Math.max(i.right,e.right)-Math.min(v,e.left),h:w?Math.max(0,r-c-u+2*g):Math.max(i.bottom,e.bottom)-Math.min(x,e.top),r:g>0?h.map(m=>m>0?m+g:0):h}}function Sr(s){var t;const e=((t=s.getPropertyValue("overflow-clip-margin"))!==null&&t!==void 0?t:"").match(/(-?[\d.]+)px/);return e?Math.max(0,Number.parseFloat(e[1])):0}function _e(s,t,e){const n={x:e.left,y:e.top,w:e.right-e.left,h:e.bottom-e.top};return ct(Es(s,t,e),n)}function kr(s,t){var e;const i=((e=t.clipPath)!==null&&e!==void 0?e:"").trim().match(/^(inset|circle|ellipse)\((.*)\)(?:\s+[a-z-]+)?$/);if(!i)return null;const o=I(s),r=o.right-o.left,a=o.bottom-o.top,c=(A,R)=>{var C;return(C=Kt(A??"0",R))!==null&&C!==void 0?C:0},[l,u]=[i[1],i[2]];if(l==="inset"){const[A,R]=u.split(/\s+round\s+/),C=A.trim().split(/\s+/),[P,E=P,q=P,G=E]=C,K=c(P,a),V=c(E,r),z=c(q,a),ot=c(G,r),O=Math.max(0,r-ot-V),W=Math.max(0,a-K-z),et=R?c(R.trim().split(/\s+/)[0],Math.min(O,W)):0;return{x:o.left+ot,y:o.top+K,w:O,h:W,r:Ot([et,et,et,et],O,W)}}const[d,h="50% 50%"]=u.split(/\s+at\s+/),[f,p=f]=h.trim().split(/\s+/),y=o.left+c(f,r),w=o.top+c(p,a),g=d.trim()===""?[]:d.trim().split(/\s+/),v=(A,R,C,P)=>A===void 0||A==="closest-side"?Math.min(C,P):A==="farthest-side"?Math.max(C,P):c(A,R),x=l==="circle"?v(g[0],Math.hypot(r,a)/Math.SQRT2,Math.min(y-o.left,w-o.top),Math.min(o.right-y,o.bottom-w)):v(g[0],r,y-o.left,o.right-y),m=l==="circle"?x:v(g[1],a,w-o.top,o.bottom-w),b=Math.min(x,m);return{x:y-x,y:w-m,w:2*x,h:2*m,r:[b,b,b,b]}}function Ns(s,t){const e=document.scrollingElement;let n=!1;for(let r=s;r&&!n;r=M(r))n=k(r).position==="fixed";if(!(n||!!e&&e.scrollHeight<=e.clientHeight&&e.scrollWidth<=e.clientWidth)||!(window.innerWidth>0)||!(window.innerHeight>0))return!1;const o={left:0,top:0,right:window.innerWidth,bottom:window.innerHeight};return _e(s,t,o)}function bn(s){const t=I(s),e=t.left+s.clientLeft,n=t.top+s.clientTop;return{x:e,y:n,w:Math.min(s.clientWidth,t.width-s.clientLeft),h:Math.min(s.clientHeight,t.height-s.clientTop)}}function Is(s,t){const e=I(s),n=Gt(t,e.width,e.height);if(n===null)return null;const i=Xt(t),[o,r,a,c]=i;return{x:e.left+c,y:e.top+o,w:Math.max(0,e.width-c-r),h:Math.max(0,e.height-o-a),r:gn(n,Math.max(...i))}}function Ts(s,t){const e=(a,c)=>Math.abs(a-c)<=.5,n=e(s.x,t.x),i=e(s.y,t.y),o=e(s.x+s.w,t.x+t.w),r=e(s.y+s.h,t.y+t.h);return[n&&i,o&&i,o&&r,n&&r]}function xr(s,t){const e=[0,0,0,0];let n=M(s);for(let i=0;n&&i<16&&!(n===document.documentElement||n===document.body);i++,n=M(n)){const o=k(n);if(!Ce(o)&&!Qt(o))continue;if(n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1)break;const r=Is(n,o);if(!r?.r)break;const a=Ts(r,t);if(!a.some(Boolean))break;a.forEach((c,l)=>{var u,d;c&&(e[l]=Math.max(e[l],(d=(u=r.r)===null||u===void 0?void 0:u[l])!==null&&d!==void 0?d:0))})}return Ot(e,t.w,t.h)}function Ar(s,t,e){const n=Is(s,t);if(!n?.r)return!1;const i=Ts(n,e),[o,r,a,c]=n.r.map((u,d)=>i[d]?0:u),l=[o,r,a,c];return ct(Object.assign(Object.assign({},n),{r:l}),e)}const Ee=new Map,Cr=512;function Y(s){const t=Ee.get(s);if(t!==void 0)return t;const e=Rr(s);return Ee.size>=Cr&&Ee.clear(),Ee.set(s,e),e}function Rr(s){var t,e;const n=s.trim().toLowerCase();if(n==="transparent")return 0;const i=(t=n.match(/^[a-z]+\((.*)\)$/))===null||t===void 0?void 0:t[1];if(!i)return null;const o=(e=i.match(/\/\s*([+-]?(?:\d+\.?\d*|\.\d+)%?)(?:\s|$)/))===null||e===void 0?void 0:e[1],r=i.split(",").map(l=>l.trim()),a=o??(r.length===4?r[3]:null);if(a===null)return 1;const c=Number.parseFloat(a);return Number.isFinite(c)?Math.min(1,Math.max(0,a.endsWith("%")?c/100:c)):null}function Ls(s){return s==="transparent"||s==="rgba(0, 0, 0, 0)"}function Mr(s){const t=s.trim().match(/^rgba?\(([^)]*)\)$/i);if(!t)return null;const e=t[1].split(/[\s,/]+/).filter(Boolean).map(Number);if(e.length<3||e.some(a=>!Number.isFinite(a)))return null;const[n,i,o,r=1]=e;return[n,i,o,Math.min(1,Math.max(0,r))]}let te=null;function ee(s){const t=Mr(s);if(t)return t;if(typeof document>"u"||typeof document.createElement!="function")return null;if(te?.document!==document){const a=document.createElement("canvas");a.width=1,a.height=1,te={document,context:a.getContext("2d",{willReadFrequently:!0})}}const e=te.context;if(!e||typeof CSS<"u"&&!CSS.supports("color",s))return null;e.clearRect(0,0,1,1),e.fillStyle=s,e.fillRect(0,0,1,1);const[n,i,o,r]=e.getImageData(0,0,1,1).data;return[n,i,o,r/255]}function Pr(s){const t=s.map(Y);if(t.some(u=>u===null))return null;const e=Math.max(0,t.lastIndexOf(1)),n=s.slice(e).filter((u,d)=>{var h;return((h=t[e+d])!==null&&h!==void 0?h:0)>0});if(n.length===1&&Y(n[0])===1)return n[0];let i=[0,0,0,0];for(const u of n){const d=ee(u);if(!d)return null;const h=d[3]+i[3]*(1-d[3]);if(h===0)continue;const f=p=>(d[p]*d[3]+i[p]*i[3]*(1-d[3]))/h;i=[f(0),f(1),f(2),h]}const[o,r,a,c]=i,l=u=>Math.round(Math.min(255,Math.max(0,u)));return`rgba(${l(o)}, ${l(r)}, ${l(a)}, ${S(c)})`}function Ne(s){const t=ee(s);if(!t||t[3]!==1)return null;const e=t.slice(0,3).map(n=>Math.round(n));return e.some(n=>n<0||n>255)?null:`#${e.map(n=>n.toString(16).padStart(2,"0")).join("")}`}let ne=null;function Or(){var s,t,e;if(typeof getComputedStyle!="function"||typeof matchMedia!="function")return null;const n=document.documentElement,i=getComputedStyle(n),o=[i,document.body?getComputedStyle(document.body):null].find(c=>{var l;return c&&((l=Y(c.backgroundColor))!==null&&l!==void 0?l:0)>0});if(o)return Ne(o.backgroundColor);const r=(e=(t=(s=document.querySelector)===null||s===void 0?void 0:s.call(document,'meta[name="color-scheme"]'))===null||t===void 0?void 0:t.content)!==null&&e!==void 0?e:"",a=`${i.colorScheme}|${r}|${matchMedia("(prefers-color-scheme: dark)").matches}`;if(ne?.key!==a){const c=document.createElement("div");c.style.cssText="position:absolute;width:0;height:0;background-color:Canvas",n.append(c),ne={key:a,color:Ne(getComputedStyle(c).backgroundColor)},c.remove()}return ne.color}const _r={ease:[.25,.1,.25,1],"ease-in":[.42,0,1,1],"ease-out":[0,0,.58,1],"ease-in-out":[.42,0,.58,1]};function Fs(s){var t;const e=(s??"linear").trim().toLowerCase();if(e==="linear"||e==="")return;const n=_r[e];if(n)return{bezier:n};if(e==="step-start")return{steps:1,jump:"start"};if(e==="step-end")return{steps:1,jump:"end"};const i=/^([a-z-]+)\((.*)\)$/.exec(e);if(!i)return null;const o=i[2].split(",").map(r=>r.trim());if(i[1]==="cubic-bezier"){const r=o.map(Number);return r.length!==4||!r.every(Number.isFinite)||r[0]<0||r[0]>1||r[2]<0||r[2]>1?null:{bezier:[r[0],r[1],r[2],r[3]]}}if(i[1]==="steps"){const r=Number(o[0]),a=(t=o[1])!==null&&t!==void 0?t:"end",c={start:"start","jump-start":"start",end:"end","jump-end":"end","jump-none":"none","jump-both":"both"}[a];return!Number.isInteger(r)||r<(c==="none"?2:1)||!c||o.length>2?null:{steps:r,jump:c}}return i[1]==="linear"?Er(o):null}function Er(s){var t,e,n,i;const o=[];for(const a of s){const c=a.split(/\s+/),l=Number(c[0]);if(!Number.isFinite(l)||c.length>3)return null;const u=c.slice(1).map(d=>d.endsWith("%")?Number(d.slice(0,-1))/100:Number.NaN);if(!u.every(Number.isFinite))return null;u.length===0&&o.push({output:l,input:null});for(const d of u)o.push({output:l,input:d})}if(o.length<2)return null;(t=(n=o[0]).input)!==null&&t!==void 0||(n.input=0),(e=(i=o[o.length-1]).input)!==null&&e!==void 0||(i.input=1);let r=-1/0;for(const a of o)a.input!==null&&(a.input=Math.max(a.input,r),r=a.input);for(let a=1;a<o.length;a++){if(o[a].input!==null)continue;let c=a;for(;o[c].input===null;)c++;const l=o[a-1].input,u=o[c].input;for(let d=a;d<c;d++)o[d].input=l+(u-l)*(d-a+1)/(c-a+1)}return{points:o.flatMap(a=>[N(a.input),N(a.output)])}}function Ie(s,t,e=1){const n=s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?(?:px|rem|%)?|[()+\-*/]|calc\(|[a-z-]+\(|\S/gi);if(!n)return null;let i=0;const o=()=>{let l=r();for(;l&&(n[i]==="+"||n[i]==="-");){const u=n[i++]==="+"?1:-1,d=r();if(!d||d.number!==l.number)return null;l={px:l.px+u*d.px,fraction:l.fraction+u*d.fraction,number:l.number}}return l},r=()=>{let l=a();for(;l&&(n[i]==="*"||n[i]==="/");){const u=n[i++],d=a();if(!d)return null;if(u==="/"){if(!d.number||d.px===0)return null;l={px:l.px/d.px,fraction:l.fraction/d.px,number:l.number}}else if(d.number)l={px:l.px*d.px,fraction:l.fraction*d.px,number:l.number};else if(l.number)l={px:d.px*l.px,fraction:d.fraction*l.px,number:!1};else return null}return l},a=()=>{const l=n[i++];if(l===void 0)return null;if(l==="("||l.toLowerCase()==="calc("){const d=o();return n[i++]===")"?d:null}if(l==="-"&&n[i]!==void 0){const d=a();return d&&{px:-d.px,fraction:-d.fraction,number:d.number}}const u=Number.parseFloat(l);if(!Number.isFinite(u))return null;if(l.endsWith("%"))return{px:0,fraction:u/100,number:!1};if(l.toLowerCase().endsWith("px"))return{px:u*e,fraction:0,number:!1};if(l.toLowerCase().endsWith("rem")){const d=Number.parseFloat(k(document.documentElement).fontSize);return Number.isFinite(d)?{px:u*d,fraction:0,number:!1}:null}return{px:u,fraction:0,number:!0}},c=o();return!c||i!==n.length||c.number&&c.px!==0?null:c.px+c.fraction*t}function se(s,t){const e=[];let n=0,i="";for(const o of s)o==="("&&n++,o===")"&&n--,n===0&&t.test(o)?(e.push(i.trim()),i=""):i+=o;return e.push(i.trim()),e.filter(Boolean)}function Nr(s,t,e,n,i=1){const o=ut(s,t,e,n,i);return o&&o.sx===1&&o.sy===1?{x:o.x,y:o.y}:null}function ut(s,t,e,n,i=1){const o=s.trim();if(o===""||o==="none")return{x:0,y:0,sx:1,sy:1};const r=(f,p)=>f===void 0?0:Ie(f,p,i);if(t==="translate"){const f=se(o,/\s/);if(f.length>3)return null;const p=r(f[0],e),y=r(f[1],n),w=f[2]===void 0?0:r(f[2],0);return p===null||y===null||w===null?null:{x:p,y,sx:1,sy:1}}if(t==="scale"){const[f,p=f,...y]=se(o,/\s/).map(Nt);return f==null||p===null||y.length>1||y.includes(null)?null:{x:0,y:0,sx:f,sy:p}}let a=0,c=0,l=1,u=1;const d=/([a-z0-9]+)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/gi;let h=0;for(let f=d.exec(o);f;f=d.exec(o)){if(o.slice(h,f.index).trim()!=="")return null;h=f.index+f[0].length;const p=Ir(f[1].toLowerCase(),se(f[2],/,/),r,e,n,i);if(!p||(p.dx!==0||p.dy!==0)&&(l!==1||u!==1))return null;a+=p.dx,c+=p.dy,l*=p.fx,u*=p.fy}return o.slice(h).trim()!==""||h===0?null:{x:a,y:c,sx:l,sy:u}}function Ir(s,t,e,n,i,o){const r=(a=0,c=0,l=1,u=1)=>a===null||c===null||l===null||u===null?null:{dx:a,dy:c,fx:l,fy:u};if(s==="translate"&&t.length<=2)return r(e(t[0],n),e(t[1],i));if(s==="translatex"&&t.length===1)return r(e(t[0],n));if(s==="translatey"&&t.length===1)return r(0,e(t[0],i));if(s==="translatez"&&t.length===1)return e(t[0],0)===null?null:r();if(s==="translate3d"&&t.length===3)return e(t[2],0)===null?null:r(e(t[0],n),e(t[1],i));if(s==="scale"&&t.length<=2||s==="scale3d"&&t.length===3){if(s==="scale3d"&&Nt(t[2])===null)return null;const a=Nt(t[0]);return r(0,0,a,s==="scale"&&t.length===1?a:Nt(t[1]))}if(s==="scalex"&&t.length===1)return r(0,0,Nt(t[0]));if(s==="scaley"&&t.length===1)return r(0,0,1,Nt(t[0]));if(s==="matrix"||s==="matrix3d"){const a=t.map(Number);return a.length!==(s==="matrix"?6:16)||!a.every(Number.isFinite)||(s==="matrix"?[1,2]:[1,2,3,4,6,7,8,9,11]).some(l=>Math.abs(a[l])>1e-6)||s==="matrix3d"&&Math.abs(a[15]-1)>1e-6?null:s==="matrix"?r(a[4]*o,a[5]*o,a[0],a[3]):r(a[12]*o,a[13]*o,a[0],a[5])}return null}function Nt(s){if(s===void 0)return null;const t=s.trim(),e=Number.parseFloat(t);return!Number.isFinite(e)||!/^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?%?$/i.test(t)?null:t.endsWith("%")?e/100:e}const ie=s=>Math.abs(s)<1e-5,Te=s=>Math.abs(s-1)<1e-5,dt=[1,0,0,1];function Le([s,t,e,n],[i,o,r,a]){return[s*i+e*o,t*i+n*o,s*r+e*a,t*r+n*a]}function js([,s,t]){return ie(s)&&ie(t)}function yn(s){return js(s)&&Te(s[0])&&Te(s[3])}function Tr([s,t,e,n]){return[N(Math.hypot(s,t)),N(Math.hypot(e,n))]}function Lr(s){const t=s.match(/^matrix(3d)?\(([^)]+)\)$/);if(!t)return dt;const e=t[2].split(",").map(n=>Number(n.trim()));return e.every(Number.isFinite)?!t[1]&&e.length===6?[e[0],e[1],e[2],e[3]]:t[1]&&e.length===16?[e[0],e[1],e[4],e[5]]:dt:dt}function Fr(s){const t=s.getPropertyValue("scale").trim();if(t===""||t==="none")return dt;const[e,n=e]=t.split(/\s+/).map(Nt);return e===null||n===null||e===void 0?dt:[e,0,0,n]}const jr={deg:1,rad:180/Math.PI,grad:.9,turn:360};function wn(s){var t;const e=s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i);return e?Number(e[1])*jr[((t=e[2])!==null&&t!==void 0?t:"deg").toLowerCase()]:null}function Wr(s){var t;const e=s.getPropertyValue("rotate").trim();if(e===""||e==="none")return dt;const n=e.split(/\s+/),i=wn((t=n[n.length-1])!==null&&t!==void 0?t:"");if(i===null)return dt;const o=i*Math.PI/180,r={x:[1,0,0],y:[0,1,0],z:[0,0,1]},a=n.length===1?r.z:n.length===2?r[n[0].toLowerCase()]:n.slice(0,3).map(Number),c=a?Math.hypot(...a):0;if(!a||!(c>0))return dt;const[l,u,d]=a.map(y=>y/c),h=Math.cos(o),f=Math.sin(o),p=1-h;return[p*l*l+h,p*l*u+d*f,p*l*u-d*f,p*u*u+h]}function Br(s){var t;const e=s.getPropertyValue("offset-path").trim();if(e===""||e==="none")return dt;let n=0;for(const o of(s.getPropertyValue("offset-rotate").trim()||"auto").split(/\s+/))o==="auto"||o==="reverse"?n+=$r(e,s)+(o==="reverse"?180:0):n+=(t=wn(o))!==null&&t!==void 0?t:0;const i=n*Math.PI/180;return[Math.cos(i),Math.sin(i),-Math.sin(i),Math.cos(i)]}function $r(s,t){var e,n;const i=s.match(/^ray\(\s*(\S+)/);if(i)return((e=wn(i[1]))!==null&&e!==void 0?e:90)-90;const o=(n=s.match(/^path\((?:\s*(?:nonzero|evenodd)\s*,)?\s*(["'])([^]*)\1\s*\)$/))===null||n===void 0?void 0:n[2];if(!o)return 0;const r=document.createElementNS("http://www.w3.org/2000/svg","path");r.setAttribute("d",o);const a=r.getTotalLength();if(!(a>0))return 0;const c=t.getPropertyValue("offset-distance").trim(),l=c.endsWith("%")?Number.parseFloat(c)/100*a:Number.parseFloat(c)||0,u=Math.min(Math.max(l,0),a),d=Math.min(.5,a/2),h=r.getPointAtLength(Math.max(0,u-d)),f=r.getPointAtLength(Math.min(a,u+d));return Math.atan2(f.y-h.y,f.x-h.x)*180/Math.PI}function Ws(s){return Le(Br(s),Le(Wr(s),Le(Fr(s),Lr(s.transform))))}function Fe(s){return Bs(s).map(N)}function Bs(s){return jt("composedLinear",s,()=>{const t=M(s),e=Ws(k(s));return t?Le(Bs(t),e):e})}function qr(s,t){var e;const n=s.transform.match(/^matrix3d\(([^)]+)\)$/),i=n?n[1].split(",").map(c=>Number(c.trim())):null;if(i&&[3,7,11].some(c=>!ie(i[c])))return!0;const o=(e=t?.getPropertyValue("perspective").trim())!==null&&e!==void 0?e:"none";if(o===""||o==="none")return!1;const r=s.getPropertyValue("rotate").trim().split(/\s+/);return r.length>1&&r[0].toLowerCase()!=="z"||!!i&&[2,6,8,9].some(c=>!ie(i[c]))}function zr(s){const t=s.getPropertyValue("translate").trim();if(t===""||t==="none")return!0;const e=t.split(/\s+/);return e.length<=2?!0:e.length===3&&/^[+-]?(?:0+(?:\.0*)?|\.(?:0+))(?:px)?$/i.test(e[2])}function Dr(s){const t=s.getPropertyValue("offset-rotate").trim(),e=t===""||t==="auto"||t==="auto 0deg";return F(s,"offset-path")||!e}function Hr(s){const t=s.getPropertyValue("zoom").trim();return t!==""&&t!=="1"&&t!=="normal"}function $s(s){return yn(Ws(s))&&Vr(s.transform)&&zr(s)&&!Dr(s)&&!Hr(s)}function Vr(s){const t=s.match(/^matrix3d\(([^)]+)\)$/);if(!t)return!0;const e=t[1].split(",").map(n=>Number(n.trim()));return e.length===16&&[2,3,6,7,8,9,11,14].every(n=>ie(e[n]))&&Te(e[10])&&Te(e[15])}function je(s){return F(s,"contain")||F(s,"content-visibility","visible")||F(s,"container-type","normal")}function zt(s){return s.backgroundImage!==""&&s.backgroundImage!=="none"}function qs(s,t){return s===document.documentElement||s===document.body&&!je(t)&&!je(k(document.documentElement))}function Sn(){const s=document.documentElement,t=document.body;if(!t||t.parentElement!==s)return!1;const e=k(s);return zt(e)||Y(e.backgroundColor)!==0?!1:!je(e)&&!je(k(t))}function kn(s){const t=s.backgroundImage.trim()||"none",e=Y(s.backgroundColor);if((e===null||e===0)&&t==="none")return null;const n=t==="none"||!/(?:url|image-set|cross-fade|element|paint)\s*\(/i.test(t)&&/(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(t),i=o=>o.split(",").map(r=>r.trim());return!n||i(s.backgroundClip).some(o=>o!=="border-box")||i(s.backgroundOrigin).some(o=>o!=="padding-box")||i(s.backgroundAttachment).some(o=>o!=="scroll")||i(s.backgroundBlendMode).some(o=>(o||"normal")!=="normal")?null:{color:s.backgroundColor,image:t,size:s.backgroundSize,position:s.backgroundPosition,repeat:s.backgroundRepeat,origin:s.backgroundOrigin,clip:s.backgroundClip,attachment:s.backgroundAttachment,blendMode:s.backgroundBlendMode,borderWidths:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth]}}function xn(s){var t;const e=s.backgroundClip.split(",").map(n=>n.trim()).filter(Boolean);return(t=e[e.length-1])!==null&&t!==void 0?t:"border-box"}function We(s,t=!1){return["::before","::after"].some(e=>zs(k(s,e),t))}function zs(s,t=!1){var e,n,i;const o=((e=s.content)!==null&&e!==void 0?e:"").trim();if(o===""||o==="none"||o==="normal"||s.display==="none"||s.visibility==="hidden"||Number.parseFloat(s.opacity)===0)return!1;if(o!=='""'&&o!=="''")return!0;const r=s.backgroundColor===""?0:(n=Y(s.backgroundColor))!==null&&n!==void 0?n:1;return((i=s.display)!==null&&i!==void 0?i:"").includes("list-item")||(t?r>0:r===1)||zt(s)||Ds(s)||s.borderImageSource!=null&&s.borderImageSource!==""&&s.borderImageSource!=="none"||F(s,"filter")||mn(s)||Xt(s).some(a=>a>0)}function Ds(s){var t;return/\binset\b/.test((t=s.boxShadow)!==null&&t!==void 0?t:"")}function oe(s){var t;return((t=s.boxShadow)!==null&&t!==void 0?t:"").split(/,(?![^(]*\))/).some(n=>n.trim()!==""&&n.trim()!=="none"&&!/\binset\b/.test(n))||s.outlineStyle!==""&&s.outlineStyle!=="none"&&Number.parseFloat(s.outlineWidth)>0}const Ur=new Set(["BUTTON","CANVAS","IFRAME","IMG","INPUT","SELECT","TEXTAREA","VIDEO"]);function An(s,t){return fn("sparsePaint",t,()=>{var e;return Ur.has(s.tagName)||Array.from(s.childNodes).some(i=>{var o,r;return i.nodeType===Node.TEXT_NODE&&((r=(o=i.textContent)===null||o===void 0?void 0:o.trim().length)!==null&&r!==void 0?r:0)>0})&&((e=Y(t.color))!==null&&e!==void 0?e:0)>0||Array.from(s.children).some(i=>["CANVAS","IFRAME","IMG","SVG","VIDEO"].includes(i.tagName))?!0:[[t.borderTopWidth,t.borderTopColor],[t.borderRightWidth,t.borderRightColor],[t.borderBottomWidth,t.borderBottomColor],[t.borderLeftWidth,t.borderLeftColor]].some(([i,o])=>{var r;return Number.parseFloat(i)>0&&((r=Y(o))!==null&&r!==void 0?r:0)>0})||We(s)||Ds(t)||Wt(t)})}function Hs(s,t=!1){var e;const n=k(s);return((e=Y(n.backgroundColor))!==null&&e!==void 0?e:0)*(t?1:Number.parseFloat(n.opacity))<1&&n.backgroundImage==="none"&&s.children.length===0&&!An(s,n)}function Cn(s){const t=k(s);return t.position!=="static"&&t.overflowX!=="visible"&&t.overflowY!=="visible"?F(t,"filter")||["::before","::after"].some(e=>k(s,e).position==="fixed"):Be(s,t)||Vs(s,t)}function Be(s,t){return Wt(t)||Ys(s)}function Vs(s,t){return Wt(t)||F(t,"filter")||Us(s,t.overflowX==="visible",t.overflowY==="visible")&&Xr(s)}function Yr(s,t){return Wt(t)||F(t,"filter")||Ys(s)}function Us(s,t,e){return t&&s.scrollWidth>s.clientWidth+1||e&&s.scrollHeight>s.clientHeight+1}function Xr(s){if(typeof document.createRange!="function")return!0;const t=I(s),e=o=>o.width>0&&o.height>0&&(o.left<t.left-1||o.top<t.top-1||o.right>t.right+1||o.bottom>t.bottom+1),n=document.createRange(),i=Array.from(s.childNodes);for(let o=0;i.length>0;o+=1){if(o===256)return!0;const r=i.pop();if(r.nodeType===Node.TEXT_NODE){if(n.selectNodeContents(r),e(I(s,n.getBoundingClientRect())))return!0}else if(r instanceof HTMLElement){if(r.shadowRoot||e(I(r)))return!0;i.push(...Array.from(r.childNodes))}}return!1}let $e=new WeakMap;function Rn(s){s?$e.delete(s):$e=new WeakMap}function Ys(s){const t=$e.get(s);if(t!==void 0)return t;const e=["::before","::after"].some(n=>{var i;const o=k(s,n);if(!zs(o))return!1;const r=[o.marginTop,o.marginRight,o.marginBottom,o.marginLeft];return(o.position||"static")!=="static"||((i=o.display)!==null&&i!==void 0?i:"").includes("list-item")||r.some(a=>Number.parseFloat(a??"")<0)||F(o,"transform")||F(o,"translate")||F(o,"filter")||o.textShadow!==void 0&&Wt(o)||oe(o)});return $e.set(s,e),e}const Xs=/^([a-z-]+\([^()]*\)|#[\da-f]+|[a-z]+)(?:\s+(.+))?$/i;function Gs(s){var t;const e=s.backgroundImage.trim();return se(e,/,/).length===1?(t=e.match(/^linear-gradient\((.*)\)$/))===null||t===void 0?void 0:t[1]:void 0}function Ks(s){var t;const e=se(s,/,/);return/^(to bottom|180deg)$/.test((t=e[0])!==null&&t!==void 0?t:"")&&e.shift(),e}function Mn(s,t){var e;const n=Js(s);if(n===null)return null;let i=0;for(const o of n)i=Math.max(i,(e=Ie(o,t))!==null&&e!==void 0?e:0);return i>0?Math.min(i,t):null}function Js(s){const t=k(s),e=Gs(t);if(!e||Y(t.backgroundColor)!==0||xn(t)!=="border-box"||t.backgroundSize.trim()!=="auto"||!["0% 0%","0px 0px","left top"].includes(t.backgroundPosition.trim())||Xt(t).some(i=>i!==0)||Be(s,t))return null;const n=[];for(const i of Ks(e)){const o=i.match(Xs);if(!o||Y(o[1])!==1)break;if(o[2]!==void 0){if(Ie(o[2],100)===null)return null;n.push(o[2])}}return n.length>0?n:null}function Gr(s,t){var e,n,i,o;if(Mn(s,t)===null)return null;const r=k(s);if(r.backgroundOrigin!=="padding-box"||r.backgroundAttachment!=="scroll"||r.backgroundBlendMode!=="normal")return null;const a=Gs(r);if(!a)return null;const c=Ks(a),l=[];for(const[u,d]of c.entries()){const h=d.match(Xs);if(!h)return null;let f;if(h[2]!==void 0?f=Ie(h[2],t):u===0?f=0:u===c.length-1?f=t:f=null,f===null||f<0||f>t||f/t<((n=(e=l[l.length-1])===null||e===void 0?void 0:e.offset)!==null&&n!==void 0?n:0))return null;l.push({color:h[1],offset:f/t})}return((i=l[0])===null||i===void 0?void 0:i.offset)>0&&l.unshift(Object.assign(Object.assign({},l[0]),{offset:0})),((o=l[l.length-1])===null||o===void 0?void 0:o.offset)!==1||l.length<2||l.length>8?null:l}function Zs(s){return typeof s.getAnimations!="function"?!1:s.getAnimations().some(t=>{if(t.playState==="finished"||t.playState==="idle")return!1;const e=t.effect;return(typeof e?.getKeyframes=="function"?e.getKeyframes():[]).some(i=>i.opacity!==void 0&&Number.parseFloat(String(i.opacity))>0)})}function Qs(s,t=new Set){let e=1;for(let n=s;n;n=M(n)){if(t.has(n))continue;const i=Number.parseFloat(k(n).opacity);Number.isFinite(i)&&(e*=i)}return e}function Kr(s){for(let t=M(s);t;t=M(t))if(mn(k(t)))return!0;return!1}function Jr(s,t=[]){var e;const n=new Set(t),i=I(s),o=[],r=new Set;let a=null;for(let c=s;c;c=M(c)){const l=k(c);if(Number.parseFloat(l.opacity)===0&&!Zs(c))return{transparent:!0,clips:[],approximations:[]};const u=M(c);(oi(l)||!Me(c,l)&&(F(l,"mask-image")||F(l,"-webkit-mask-image")))&&r.add("effects"),qr(l,u?k(u):null)&&r.add("perspective");const d=qs(c,l),h=Ce(l),f=Qt(l),p=n.has(c)&&(h||Re(l.overflowX)||Re(l.overflowY))&&!f&&!Et(l);p?a={bounds:I(c),port:bn(c),moves:!1}:a&&(l.position==="fixed"||l.position==="sticky")&&(a.moves=!0),c!==s&&!d&&(h||f)&&!p&&(Et(l)||!Zr(c,l,i,a))&&o.push({el:c,rect:Es(c,l,i)});const y=((e=l.clipPath)!==null&&e!==void 0?e:"").trim();if(y!==""&&y!=="none"&&!Os(c,l)){const w=kr(c,l);w&&o.push({el:c,rect:w}),(!w||y.startsWith("ellipse")&&Math.abs(w.w-w.h)>.5)&&r.add("clip-shape")}}return{transparent:!1,clips:o,approximations:[...r]}}function Zr(s,t,e,n){return _e(s,t,e)||Ns(s,t)||!!n&&!n.moves&&(_e(s,t,n.bounds)||Ar(s,t,n.port))}let J=null;function ti(s){const t=s();return J?.push({check:s,value:t}),t}function ei(s){const t=J,e=[];J=e;try{return{value:s(),facts:e}}finally{J=t,t?.push(...e)}}function ni(s){return s.every(t=>t.check()===t.value)}function qe(s,t=[],{backgroundOnly:e=!1,allowViewportPosition:n=!1}={}){return si(s,t,{backgroundOnly:e,allowViewportPosition:n,followSticky:!1})}function Qr(s,t,e,n){return ii(s,t,{backgroundOnly:!0,allowViewportPosition:e,followSticky:!1},n)}function si(s,t,e){var n,i;const o=fs("successfulWebAudits",s,()=>[]),r=o.find(l=>l.audit.backgroundOnly===e.backgroundOnly&&l.audit.allowViewportPosition===e.allowViewportPosition&&l.audit.followSticky===e.followSticky&&l.containers.length===t.length&&l.containers.every((u,d)=>u===t[d]));if(r)return J?.push(...r.facts),null;const a=(n=J?.length)!==null&&n!==void 0?n:0,c=ii(s,t,e,null);return c===null&&o.push({containers:[...t],audit:e,facts:(i=J?.slice(a))!==null&&i!==void 0?i:[]}),c}const ta="translucent, filtered, blended, clipped, or masked web layers cannot use box-shaped native cutouts";function ii(s,t,e,n){const i=new Set(t);let o=s,r=e.followSticky;for(let a=s;a;a=M(a)){const c=k(a);if(c.position==="sticky"&&r)r=!1;else if(c.position==="sticky"||!e.allowViewportPosition&&c.position==="fixed")return{reason:"fixed and sticky web layers cannot use document-space native cutouts",mayMoveWithoutRefresh:!0};if(n===null&&Number.parseFloat(c.opacity)!==1||fn("webCutoutEffects",c,()=>oi(c))||!Os(a,c)&&F(c,"clip-path")||!Me(a,c)&&(F(c,"mask-image")||F(c,"-webkit-mask-image")))return{reason:ta,mayMoveWithoutRefresh:!1};if(!fn("webCutoutTransforms",c,()=>$s(c)))return{reason:"opaque web surface coordinates are unsafe under 3D translation, scale, rotation, skew, perspective, motion paths, or zoom",mayMoveWithoutRefresh:!1};if(a===s&&!(a===document.documentElement||a===document.body&&Sn())&&!e.backgroundOnly&&ti(()=>Vs(s,k(s))))return{reason:"web surfaces with out-of-bounds paint or visible overflow cannot use a box-bounded cutout",mayMoveWithoutRefresh:!1};const l=Qt(c);if(a!==s&&!qs(a,c)&&(Ce(c)||l)&&!na(i,a,c)&&!(n!==null&&ir(a,n))&&(Et(c)||!ti(sa(a,o))))return{reason:`opaque web surface coordinates are unsafe under a partially clipping ${l?"paint-containment":"overflow"} ancestor`,mayMoveWithoutRefresh:!1};i.has(a)&&(o=a)}return null}function ea(s){return F(s,"filter")||F(s,"mix-blend-mode","normal")}function oi(s){return ea(s)||mn(s)}function na(s,t,e){return s.has(t)&&Ce(e)&&!Qt(e)&&!Et(e)}function sa(s,t){return()=>{const e=k(s);return _e(s,e,I(t))||Ns(s,e)}}function Pn(s,t=null,e=!1,n=!1,i=!1){const o=k(s),r=Y(o.backgroundColor);if((r===0||r===null)&&!zt(o)&&!An(s,o))return;const a=()=>si(s,t?[t]:[],{backgroundOnly:!1,allowViewportPosition:e,followSticky:i}),c=r===1&&xn(o)==="border-box";if(n&&(!c||Be(s,o))){const l=!c&&Js(s)!==null&&a()===null;return Object.assign({reason:"web paint above an overlay island must be fully opaque across its bounded box",mayMoveWithoutRefresh:!1},l?{opaqueGradient:!0}:{})}return s.children.length>0&&(!c||Be(s,o))?{reason:"sparse, translucent, or partially painted web content cannot use a box-shaped native cutout",mayMoveWithoutRefresh:!1}:a()}let j=null;function bt(){return j}function ia(s){const t=j;j=null;try{return s()}finally{j=t}}function re(s){const t=j;j={ancestors:new WeakMap,visibility:new WeakMap,styleVisibility:new WeakMap,scrollports:new WeakMap,scrollOffsets:new WeakMap,horizontalTravel:new WeakMap,clippedBounds:new WeakMap};try{return ar(()=>ds(s))}finally{j=t}}function $(s){const t=j;if(!t)return ai(s);const e=t.visibility.get(s);if(e!==void 0)return e;const n=ai(s);return t.visibility.set(s,n),n}function ri(s){var t,e;const n=j?.styleVisibility.get(s);if(n)return n;const i=k(s),o=M(s),r=s.hidden||i.visibility==="hidden"||i.visibility==="collapse"||i.contentVisibility==="hidden"||Number.parseFloat(i.opacity)===0&&!Zs(s),a=r||!o?null:ri(o),c={hidden:r||((t=a?.hidden)!==null&&t!==void 0?t:!1),automatic:i.contentVisibility==="auto"||((e=a?.automatic)!==null&&e!==void 0?e:!1)};return j?.styleVisibility.set(s,c),c}function ai(s){if(!s.isConnected||s.hidden)return!1;const t=s.checkVisibility,e=o=>{try{return!!t?.call(s,o)}catch{return!1}};if(typeof t=="function"?!e():s.getClientRects().length===0)return!1;const{hidden:n,automatic:i}=ri(s);return!n&&(!i||e({contentVisibilityAuto:!0}))}function oa(s){let t=M(s);for(;t&&t!==document.documentElement;){if(Oe(t))return!1;t=M(t)}return!0}function Z(s){return jt("positionedAncestor",s,()=>{const t=k(s).position;if(t==="fixed"||t==="sticky")return{element:s,position:t,viewportFixed:t==="fixed"&&oa(s)};const e=M(s);return e?Z(e):null})}function ra(s){let t=s;for(;t&&typeof t.checkVisibility=="function";){if(t.checkVisibility())return!0;if(k(t).display!=="contents")return!1;t=t.parentElement}return!0}function li(s){let t=s;for(;t;){if(t.inert||t.hasAttribute("inert"))return t;t=M(t)}return null}function ci(s){const t=j?.ancestors.get(s);if(t)return t;const e=new Set;let n=s;for(;n&&!e.has(n);)e.add(n),n=M(n);return j?.ancestors.set(s,e),e}function _(s,t){if(j)return ci(t).has(s);const e=new Set;let n=t;for(;n&&!e.has(n);){if(n===s)return!0;e.add(n),n=M(n)}return!1}function On(s,t){for(const e of ci(s))if(t.has(e))return!0;return!1}function _n(s){const t=Number.parseInt(k(s).zIndex,10);return Number.isFinite(t)?t:0}function aa(s){var t,e;if(typeof s.querySelectorAll=="function")return s.querySelectorAll("*");const n=[],i=Array.from((t=s.children)!==null&&t!==void 0?t:[]);for(;i.length>0;){const o=i.pop();n.push(o),i.push(...Array.from((e=o.children)!==null&&e!==void 0?e:[]))}return n}function ze(s){const t=Array.from(new Set(s));return t.filter(e=>!t.some(n=>{var i;return n!==e&&((i=n.contains)===null||i===void 0?void 0:i.call(n,e))}))}function la(){return Array.from(document.querySelectorAll("dialog")).filter(s=>{try{return s.matches(":modal")}catch{return!1}}).map(s=>({dialog:s,color:ee(getComputedStyle(s,"::backdrop").backgroundColor)}))}function ca(s,t){return s!==null&&t!==null&&Math.abs(s.x-t.x)<.5&&Math.abs(s.y-t.y)<.5&&Math.abs(s.w-t.w)<.5&&Math.abs(s.h-t.h)<.5}function ui(s,t){var e;for(const n of s.childNodes){if(n.nodeType!==Node.TEXT_NODE||!(!((e=n.textContent)===null||e===void 0)&&e.trim()))continue;const i=document.createRange();i.selectNodeContents(n);for(const o of i.getClientRects())if(H(t,ws(o)))return i.detach(),!0;i.detach()}return!1}function di(){var s,t;const e=document.documentElement,n=document.body;return{w:Math.max(e.scrollWidth,(s=n?.scrollWidth)!==null&&s!==void 0?s:0),h:Math.max(e.scrollHeight,(t=n?.scrollHeight)!==null&&t!==void 0?t:0)}}function ua(){const s=di();return{x:0,y:0,w:S(Math.max(window.innerWidth,s.w)),h:S(Math.max(window.innerHeight,s.h))}}const da=30,ha=150,fa=30,pa=1e3,ma=250,ga=100;function hi(){return new Promise(s=>requestAnimationFrame(()=>requestAnimationFrame(()=>s())))}class va{constructor(t,e){this.canRun=t,this.onFrame=e,this.interval=1e3/60,this.lastFrameTime=null,this.following=!1,this.lastPlanAt=Number.NEGATIVE_INFINITY,this.asked=!1,this.askedUrgently=!1,this.asks=0,this.unseen=[],this.unseenAt=-1,this.scheduled=!1,this.watchFrames=0,this.activeUntil=Number.NEGATIVE_INFINITY,this.idleWatch=null,this.lookAgain=!1,this.idleFollowFrames=0,this.lastScrollAt=Number.NEGATIVE_INFINITY}schedule(){!this.canRun()||this.scheduled||(this.scheduled=!0,requestAnimationFrame(t=>{this.scheduled=!1,this.onFrame(t)}))}ask(){this.askedUrgently=!0,this.asks+=1,this.asked=!0,this.wake()}askForChange(t,e){const n=e&&(!this.asked||this.unseen.length>0&&this.unseenAt===this.asks),i=this.askedUrgently;this.ask(),this.askedUrgently=i,n?(this.unseen.push(...t),this.unseenAt=this.asks):this.unseen=[]}get requested(){return this.asked}get urgent(){return this.askedUrgently}taken(){this.asked=!1,this.askedUrgently=!1}beginFrame(t){return this.withdrawUnseen(),!this.asked&&document.visibilityState==="hidden"?!1:(this.noteFrame(t),!0)}wake(){this.activeUntil=performance.now()+pa,this.idleWatch!==null&&(clearTimeout(this.idleWatch),this.idleWatch=null),this.schedule()}idleFrame(t){const e=t();this.following||e&&this.active||this.watching()?this.schedule():e&&this.idle(!1)}awayFrame(t){const e=this.asked;this.asked=!1,e&&this.watch(),this.watching()?this.schedule():t()&&this.idle(!0)}get active(){return performance.now()<this.activeUntil}idle(t){this.idleWatch===null&&(this.idleWatch=setTimeout(()=>{this.idleWatch=null,t&&(this.lookAgain=!0),this.schedule()},ma))}takeLookAgain(){const t=this.lookAgain;return this.lookAgain=!1,t}sincePlan(t){return t-this.lastPlanAt}noteFrame(t){if(Number.isFinite(t)){if(this.lastFrameTime!==null){const e=t-this.lastFrameTime;e>=4&&e<=50&&(this.interval=this.interval*.9+e*.1)}this.lastFrameTime=t}}noteScroll(){this.lastScrollAt=performance.now()}get scrolling(){return performance.now()-this.lastScrollAt<ga}watch(){this.watchFrames=fa}watching(){return--this.watchFrames>0}followDue(t,e){return e&&(this.idleFollowFrames=0),this.following&&(this.idleFollowFrames<da||t-this.lastPlanAt>=ha)}get plannedThisFrame(){var t;return!this.requested&&((t=document.timeline)===null||t===void 0?void 0:t.currentTime)===this.lastPlanAt}planned(t,e){this.lastPlanAt=t,this.watch(),this.idleFollowFrames=this.following&&e?this.idleFollowFrames+1:0}withdrawUnseen(){if(this.unseen.length===0)return;const t=this.unseenAt===this.asks&&!this.unseen.some(e=>ra(e));this.unseen=[],t&&(U("unseen"),this.asked=!1)}}const De="data-native-islands-inactive",He="data-native-islands-approximated";class ba{constructor(t){this.writes=t,this.ready=[],this.resumeSince=new Map}present(t){var e;this.ready=[];for(const n of t){const{handle:i,inactiveReason:o}=n;if(this.setApproximations(i,n.active?(e=n.approximations)!==null&&e!==void 0?e:[]:[]),o===null&&n.active&&n.el.hasAttribute(De)){this.ready.push(i);continue}this.setInactive(i,o)}}takeReady(){const t=this.ready;this.ready=[];for(const e of Array.from(this.resumeSince.keys()))t.includes(e)||this.resumeSince.delete(e);return t}noteSent(t,e){for(const n of t)this.resumeSince.has(n)||this.resumeSince.set(n,e)}resume(t){for(const e of t)this.resumeSince.delete(e),e.el.isConnected&&this.setInactive(e,null)}resumeShownBy(t,e){for(const[n,i]of Array.from(this.resumeSince))e<i||t.components.some(o=>o.id===n.islandId&&o.active)&&(this.resumeSince.delete(n),n.el.isConnected&&this.setInactive(n,null))}setApproximations(t,e){const n=e.length>0?Array.from(new Set(e)).sort().join(" "):null;t.el.getAttribute(He)!==n&&(n===null?t.el.removeAttribute(He):t.el.setAttribute(He,n),this.writes.attribute(t.el,He))}setInactive(t,e){const n=t.el.getAttribute(De);t.setNativeInactive(e),t.el.getAttribute(De)!==n&&this.writes.attribute(t.el,De)}}function ya(s,t,e){if(!s.rect||s.scrollPath.length===0)return!0;const n=r=>{var a;return(a=e.scrollContainers.find(c=>c.id===r))!==null&&a!==void 0?a:t.scrollContainers.find(c=>c.id===r)};let i=s.rect.x,o=s.rect.y;for(const r of s.scrollPath){const a=n(r);a&&(i-=a.offsetX,o-=a.offsetY)}for(const r of s.scrollPath){const a=n(r);if(!a||a.rect.w<=0||a.rect.h<=0)continue;let c=a.rect.x,l=a.rect.y;for(const u of a.scrollPath){const d=n(u);d&&(c-=d.offsetX,l-=d.offsetY)}if(i+s.rect.w<=c||i>=c+a.rect.w||o+s.rect.h<=l||o>=l+a.rect.h)return!1}return!0}function fi(s,t,e){var n,i;if(!s)return null;const o=new Set(t.components.filter(c=>c.active).map(c=>c.id)),r=new Set(s.components.filter(c=>c.active&&ya(c,s,t)&&(!o.has(c.id)||e.has(c.id)&&c.plane==="overlay")).map(c=>c.id));if(r.size===0)return null;const a=c=>c&&Object.fromEntries(Object.entries(c).filter(([l])=>!r.has(l)));return Object.assign(Object.assign({},s),{components:s.components.map(c=>r.has(c.id)?Object.assign(Object.assign({},c),{active:!1}):c),order:s.order.filter(c=>!r.has(c)),cutouts:(n=a(s.cutouts))!==null&&n!==void 0?n:{},exclusions:(i=a(s.exclusions))!==null&&i!==void 0?i:{},tints:a(s.tints),panes:s.panes&&Object.fromEntries(Object.entries(s.panes).map(([c,l])=>[c,l.under!==void 0&&r.has(l.under)?{color:l.color}:l]))})}function wa(s,t){return s.length===t.length&&s.every((e,n)=>e.id===t[n].id)}const Sa=new Set(["x","y","w","h"]);function ka(s){return(t,e)=>typeof e=="number"&&Sa.has(t)?Math.round(e*s):e}function pi(s,t){const e=ka(typeof window<"u"&&window.devicePixelRatio>0?window.devicePixelRatio:1);return JSON.stringify(t!=="bridge"?s:Object.assign(Object.assign({},s),{scrollContainers:s.scrollContainers.map(n=>Object.assign(Object.assign({},n),{offsetX:0,offsetY:0}))}),e)}function xa(s,t){var e;return Object.assign(Object.assign({},s),{motions:(e=s.motions)===null||e===void 0?void 0:e.map(n=>Object.assign(Object.assign({},n),{animations:n.animations.map(i=>t.has(i)?Object.assign(Object.assign({},i),{keyframes:i.keyframes.map(o=>Object.assign(Object.assign({},o),{value:i.keyframes[0].value}))}):i)}))})}let En=!1;function Aa(s,t){En=s;try{return t()}finally{En=!1}}function Nn(s){return![s.overflowX,s.overflowY].some(t=>t==="auto"||t==="scroll")}const mi=new WeakMap;function In(s){var t,e;const n=(t=bt())===null||t===void 0?void 0:t.scrollOffsets.get(s);if(n)return n;let i=bt()?void 0:mi.get(s);if(!i){const c=k(s);i={horizontalReversed:c.direction==="rtl"||c.flexDirection==="row-reverse",verticalReversed:c.flexDirection==="column-reverse",scriptOnly:Nn(c)},mi.set(s,i)}if(En&&i.scriptOnly)return{x:0,y:0};const{horizontalReversed:o,verticalReversed:r}=i,a={x:S(o?s.scrollWidth-s.clientWidth+s.scrollLeft:s.scrollLeft),y:S(r?s.scrollHeight-s.clientHeight+s.scrollTop:s.scrollTop)};return(e=bt())===null||e===void 0||e.scrollOffsets.set(s,a),a}function Q(s,t=gi(s)){return{coordinateSpace:Ca(s)?"viewport":"document",scrollPath:t}}function Ca(s){let t=Z(s);for(;t?.position==="sticky";){const e=M(t.element);t=e?Z(e):null}return t?.viewportFixed===!0}function xt(s,t){return t.coordinateSpace==="viewport"?yt(ye(s),t.scrollPath):yt(nt(s),t.scrollPath)}function gi(s){return Pe(s).reverse()}function It(s){var t;return(t=s[s.length-1])!==null&&t!==void 0?t:null}function Tn(s,t){return s.length===t.length&&s.every((e,n)=>e===t[n])}function vi(s,t){return t.length<=s.length&&t.every((e,n)=>e===s[n])}function Ra(s,t){const e=Math.min(s.length,t.length);let n=0;for(;n<e&&s[n]===t[n];)n+=1;return n}function Ma(s){var t,e;const n=s.el&&((t=bt())===null||t===void 0?void 0:t.clippedBounds.get(s.el));if(n&&st(n,s))return n.rect;const i=Pa(s);return s.el&&((e=bt())===null||e===void 0||e.clippedBounds.set(s.el,{coordinateSpace:s.coordinateSpace,scrollPath:s.scrollPath.slice(),rect:i})),i}function Pa(s){var t;let e=s.el?M(s.el):null;for(;e;){const n=k(e);if(["hidden","clip"].includes(n.overflowX)&&["hidden","clip"].includes(n.overflowY)&&!Et(n)&&((t=Z(e))===null||t===void 0?void 0:t.position)!=="sticky"&&st(s,Q(e)))return nt(e);e=M(e)}return null}function bi(s){var t,e;const n=Ma(s),i=s.escapesByMoving&&s.travel&&s.paintRect?Ta(s.paintRect,s.travel):null;if(i)return n?(t=Jt(n,i))!==null&&t!==void 0?t:Object.assign(Object.assign({},i),{w:0,h:0}):i;if(n||!s.el||!((e=s.movers)===null||e===void 0)&&e.length)return n;const o=s.el;return jt("textPaintBound",o,()=>{var r;const a=k(o);if(o.childNodes.length===0||Array.from(o.childNodes).some(u=>u.nodeType!==Node.TEXT_NODE)||o.shadowRoot||o.getRootNode()instanceof ShadowRoot||a.display.includes("list-item")||((r=Z(o))===null||r===void 0?void 0:r.position)==="sticky"||oe(a)||Wt(a)||We(o,!0)||typeof document.createRange!="function")return null;for(let u=o;u;u=M(u)){const d=k(u).filter;if(d!==""&&d!=="none"||typeof u.getAnimations!="function"||u.getAnimations().length)return null}const c=document.createRange();c.selectNodeContents(o);const l=I(o,c.getBoundingClientRect());return c.detach(),Zt(nt(o),ws(l))})}function Ln(s,t){var e,n,i;const o=s.scrollPath[t];if(o!==void 0){const r=ht(o);if(!r||s.scrollPath.length!==t+1||s.paintEscapesRect||!s.paintRect)return r;let a=(e=bt())===null||e===void 0?void 0:e.horizontalTravel.get(o);return a===void 0&&(a=Math.max(0,o.scrollWidth-o.clientWidth),(n=bt())===null||n===void 0||n.horizontalTravel.set(o,a)),Number.isFinite(a)?Object.assign(Object.assign({},r),{x:s.paintRect.x-a,w:s.paintRect.w+a*2}):r}return s.paintEscapesRect?bi(s):(i=s.paintRect)!==null&&i!==void 0?i:null}function st(s,t){return s.coordinateSpace===t.coordinateSpace&&Tn(s.scrollPath,t.scrollPath)}function Oa(s,t,e){let n=t;for(let i=M(s);i&&n&&!(i===document.documentElement||i===document.body);i=M(i)){const o=k(i);if(!["hidden","clip","auto","scroll"].some(a=>o.overflowX===a||o.overflowY===a))continue;const r=bn(i);n=Jt(n,e==="viewport"?r:Object.assign(Object.assign({},r),{x:r.x+window.scrollX,y:r.y+window.scrollY}))}return n}function At(s,t){if(st(s,t))return!0;if(s.scrollPath.length>0||t.scrollPath.length>0)return!1;const e=document.scrollingElement;return e!=null&&e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight}function yi(s,t){return s.coordinateSpace!==t.coordinateSpace||!vi(t.scrollPath,s.scrollPath)?!1:t.scrollPath.slice(s.scrollPath.length).every(e=>{const n=k(e);return[n.overflowX,n.overflowY].every(i=>i==="hidden"||i==="clip")})}function Fn(s){return s.reduce((t,e)=>{const n=In(e),[i,o,r,a]=Fe(e);return t.x+=i*n.x+r*n.y,t.y+=o*n.x+a*n.y,t},{x:0,y:0})}function yt(s,t){const e=Fn(t);return Object.assign(Object.assign({},s),{x:S(s.x+e.x),y:S(s.y+e.y)})}function jn(s,t){let e=s;for(const n of t){const i=ht(n);if(!i||!e)return null;e=Jt(e,i)}return e}function wi(s){const[t,...e]=s,n=t&&ht(t);return n?jn(n,e):null}function _a(s,t,e,n){if(H(s,e))return!0;const i=wi(t),o=wi(n);return i!==null&&H(i,e)||o!==null&&H(s,o)||i!==null&&o!==null&&H(i,o)}function Ea(s,t,e){const n=new Set(t),i=new Set(e);for(const o of t)i.has(o)||s.add(o);for(const o of e)n.has(o)||s.add(o)}function ht(s){const t=bt();if(!t)return Si(s);const e=t.scrollports.get(s);if(e!==void 0)return e;const n=Si(s);return t.scrollports.set(s,n),n}function Si(s){const t=I(s),e=k(s),n=Gt(e,t.width,t.height);if(n===null)return null;const i=s.clientLeft,o=s.clientTop,r=Math.max(0,t.width-s.clientWidth-i),a=Math.max(0,t.height-s.clientHeight-o),c=gn(n,Math.max(i,o,r,a)),l=xr(s,bn(s)),[u,d,h,f]=c.map((x,m)=>Math.max(x,l[m])),p=[u,d,h,f],y=t.left+window.scrollX+i,w=t.top+window.scrollY+o,g=S(y),v=S(w);return{x:g,y:v,w:S(S(y+Math.min(s.clientWidth,t.width-i))-g),h:S(S(w+Math.min(s.clientHeight,t.height-o))-v),r:p}}function Na(s){const t=s.scrollPath[0];if(t!==void 0){const n=ht(t);return n&&Se(n)}if(!s.paintEscapesRect)return s.rect;const e=bi(s);return e&&Se(e)}function Ia(s,t){const e=bt();let n=e?.rootScrollRange;if(!n){const a=di();n={x:Math.max(0,a.w-window.innerWidth),y:Math.max(0,a.h-window.innerHeight)},e&&(e.rootScrollRange=n)}const{x:i,y:o}=n,r=(a,c,l,u,d)=>{const h=a-(l+u),f=a+c-l;return Math.max(0,h)<Math.min(d,f)||d===0&&h<0&&f>0};return r(s.x,s.w,t.x,t.w,i)&&r(s.y,s.h,t.y,t.h,o)}function wt(s,t){if(s.coordinateSpace===t.coordinateSpace){const r=Ra(s.scrollPath,t.scrollPath),a=Ln(s,r),c=Ln(t,r);return!a||!c||H(a,c)}if(s.visualRect&&t.visualRect&&H(s.visualRect,t.visualRect))return!0;const e=s.coordinateSpace==="document"?s:t,n=s.coordinateSpace==="viewport"?s:t,i=Ln(e,0),o=Na(n);return!i||!o?!0:Ia(i,o)}function Ta(s,t){return{x:s.x+t.minX,y:s.y+t.minY,w:s.w+t.maxX-t.minX,h:s.h+t.maxY-t.minY}}const La=120;class Fa{constructor(t){this.host=t,this.send=null,this.followed=new Map,this.sentTopology=new Map,this.acknowledged=null,this.currentMode="unsupported",this.ids=new WeakMap,this.nextId=1,this.sequence=0,this.disposers=new Map,this.scheduled=!1,this.settledPending=!1,this.endTimer=null,this.seenAt=null,this.onScroll=e=>{var n;const i=(n=document.timeline)===null||n===void 0?void 0:n.currentTime;this.seenAt=typeof i=="number"?i:e.timeStamp,this.schedule(!1),this.scheduleSettlement()}}get mode(){return this.currentMode}set mode(t){typeof window<"u"&&typeof window.removeEventListener=="function"&&this.mode==="bridge"&&window.removeEventListener("scroll",this.onScroll),this.currentMode=t,typeof window<"u"&&typeof window.addEventListener=="function"&&t==="bridge"&&window.addEventListener("scroll",this.onScroll,{passive:!0})}idFor(t){const e=this.ids.get(t);if(e)return e;const n=`scroll-${this.nextId++}`;return this.ids.set(t,n),n}nextSequence(){return++this.sequence}noteSent(t){return this.sentTopology=this.mode==="bridge"?new Map(t.scrollContainers.map(e=>[e.id,JSON.stringify(Object.assign(Object.assign({},e),{offsetX:0,offsetY:0}))])):new Map,this.sentTopology}acknowledge(t,e){var n,i;t>((i=(n=this.acknowledged)===null||n===void 0?void 0:n.sequence)!==null&&i!==void 0?i:-1)&&(this.acknowledged={sequence:t,topology:e})}forgetLayouts(){this.acknowledged=null,this.sentTopology.clear()}sync(t){var e;const n=new Map(t.map(i=>[this.idFor(i),i]));for(const[i,o]of this.followed)n.has(i)||((e=this.disposers.get(i))===null||e===void 0||e(),this.disposers.delete(i),this.followed.delete(i),this.host.unobserve(o));for(const[i,o]of n){if(this.followed.has(i)||this.host.observe(o),this.followed.set(i,o),this.disposers.has(i))continue;if(this.mode!=="bridge"){if(this.mode!=="native"||!Nn(k(o)))continue;const a=()=>this.host.refresh();o.addEventListener("scroll",a,{passive:!0}),this.disposers.set(i,()=>o.removeEventListener("scroll",a));continue}const r=()=>{this.clearEndTimer(),this.schedule(!0)};o.addEventListener("scroll",this.onScroll,{passive:!0}),o.addEventListener("scrollend",r,{passive:!0}),this.disposers.set(i,()=>{o.removeEventListener("scroll",this.onScroll),o.removeEventListener("scrollend",r)})}n.size===0&&this.clearEndTimer()}capture(t=!1){if(!this.host.ready()||this.followed.size===0)return null;const e=this.seenAt;return this.seenAt=null,Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({},e!==null&&!t?{sentAt:xe(e)}:{}),{sequence:++this.sequence,layoutSeq:this.host.layoutSequence()}),this.mode==="bridge"?{documentOffsetY:S(window.scrollY)}:{}),{offsets:Array.from(this.followed,([n,i])=>Object.assign({id:n},In(i)))}),t?{settled:!0}:{})}publish(){this.mode==="bridge"&&this.flush(!1)}flush(t){const e=this.send,n=e?this.capture(t):null;if(!n||!e)return Promise.resolve();const i=this.acknowledged;if(i&&i.sequence<this.host.layoutSequence()){const o=n.offsets.filter(({id:r})=>i.topology.has(r)&&i.topology.get(r)===this.sentTopology.get(r));o.length>0&&(e(Object.assign(Object.assign({},n),{layoutSeq:i.sequence,offsets:o})).catch(()=>{}),n.sequence=++this.sequence)}return e(n).catch(()=>{})}schedule(t){if(this.mode!=="bridge"||!this.send)return;if(t){this.scheduled?this.settledPending=!0:this.flush(!0);return}if(this.scheduled)return;this.scheduled=!0;const e=()=>{if(!this.scheduled)return;this.scheduled=!1;const n=this.settledPending;this.settledPending=!1,this.flush(n)};queueMicrotask(e),requestAnimationFrame(e)}scheduleSettlement(){this.clearEndTimer(),this.endTimer=window.setTimeout(()=>{this.endTimer=null,this.schedule(!0)},La)}clearEndTimer(){this.endTimer!==null&&window.clearTimeout(this.endTimer),this.endTimer=null}}const ki=1024,ja=.6875;function Wa(){return new Promise(s=>requestAnimationFrame(()=>s()))}const Wn=()=>{};class Ba{constructor(t,e,n,i,o){this.natives=t,this.owner=e,this.motion=n,this.session={state:"ready"},this.supported={},this.ordered=!1,this.sendLayout=null,this.refusals=new Qo,this.lastPlan=null,this.delivered=null,this.waitingFor=null,this.refreshAfter=null,this.layoutSeq=0,this.generation=0,this.confirmation={phase:"confirmed",signature:""},this.waiters=new Set,this.fenceSentinel=null,this.fenceSequence=0,this.inFlight=new Map,this.planes=new Map,this.planeSequence=-1,this.geometry=new Map,this.canvasColor=null,this.held=new Set,this.sentIn=new Map,this.appliedSequence=-1,this.status=new ba(o),this.offsets=new Fa({ready:()=>this.session.state==="ready",layoutSequence:()=>this.layoutSeq,refresh:()=>e.refresh(),observe:r=>i.observeSize(r),unobserve:r=>i.unobserveSize(r)})}configure(t,e){this.offsets.mode=t,this.ordered=e}get innerScrollMode(){return this.offsets.mode}get capabilities(){return this.supported}attach(t,e){return this.sendLayout?!1:(this.sendLayout=t,this.offsets.send=e,!0)}get ready(){return this.sendLayout!==null&&this.session.state==="ready"}get failure(){return this.session.state==="failed"?this.session.error:null}beginSession(t=!1){this.motion.reset(),this.session={state:"pending"},this.offsets.forgetLayouts(),this.held.clear();for(const e of new Set([...this.natives,...this.sentIn.keys()]))e.nativeReset();return this.sentIn.clear(),this.supported={},this.lastPlan=null,this.delivered=null,this.waitingFor=null,this.forgetSentPlans(),{ready:e=>{if(this.supported=e,t)for(const n of this.natives)n.onTransportAvailable();this.completeSession()},failed:e=>this.failSession(e),refused:(e,n)=>{var i;const o=this.refusals.refuse(e,n,this.layoutSeq);this.owner.refresh();for(const r of o)(i=this.natives.find(a=>a.islandId===r))===null||i===void 0||i.failNative(n)},applied:e=>this.motion.noteApplyLatency(e),republish:()=>this.owner.republish(),captureOffsets:()=>this.offsets.capture(),scrollFailed:(e,n)=>this.failScrollContainers(e,n)}}registered(t){for(const e of Array.from(this.held))e.islandId===t.islandId&&e!==t&&(this.held.delete(e),this.held.add(t));for(const[e,n]of Array.from(this.sentIn.entries()))e.islandId===t.islandId&&e!==t&&(this.sentIn.delete(e),this.sentIn.set(t,n));this.confirmation.phase==="sending"?this.confirmation.confirmed="":this.confirmation.signature=""}invalidate(){this.generation++,this.confirmation={phase:"confirmed",signature:""}}failScrollContainers(t,e){const n=new Set(t);for(const i of this.natives)Pe(i.el).some(r=>n.has(this.offsets.idFor(r)))&&i.failNative(e)}nextApplied(t){const e=this.session;return e.state==="failed"?Promise.reject(e.error):this.sendLayout?new Promise((n,i)=>{this.waiters.add({resolve:n,reject:i}),t()}):Promise.resolve()}get awaited(){return this.waiters.size>0}waitsForPaint(t,e){const n=this.waitingFor;if(!n)return!1;if(t&&this.supported.motionStartsAtCommit){const{payload:i,covered:o}=e();if(fi(this.delivered,i,o)!==null)return!1}return U("paintWait"),this.refreshAfter!==n&&(this.refreshAfter=n,n.then(this.owner.refresh)),!0}awaitsCreation(){return this.natives.some(t=>{if(!t.canAttemptNative()||this.held.has(t))return!1;const e=t.el.getBoundingClientRect();return e.bottom>-120&&e.top<window.innerHeight+120&&e.right>-120&&e.left<window.innerWidth+120})}holdsOff(){const t=this.lastPlan;if(!t||this.natives.length===0||t.components.length!==this.natives.length||this.waiters.size>0||this.confirmation.phase!=="confirmed"||t.components.some(e=>e.active))return!1;for(const e of this.natives){let n=!1;for(const i of t.components)if(i.id===e.islandId){n=!0;break}if(!n)return!1}return!0}send(t,e){const n={session:this.session,waiters:Array.from(this.waiters),generation:this.generation},{payload:i,covered:o,geometry:r}=t,a=this.entersUnderlay(i,o),c=this.motion.startWithPlan(a?2*e.frameInterval:0),l=!!this.supported.motionStartsAtCommit,u=l&&!a&&e.fresh.length===0&&!c,d=this.status.takeReady(),h=pi(i,this.offsets.mode),f=this.confirmation,p=h===(f.phase==="sending"?f.delivery.signature:f.signature);if(u||this.owner.schedule(),this.repeat(h,i,n,d))return u&&this.owner.schedule(),p;const y=!a&&this.fencesToCommit(t,e.changes,e.still&&!c);return this.dispatch({ticket:n,payload:i,signature:h,geometry:r,resuming:d,retirement:l&&!a?fi(this.delivered,i,o):null,fenced:y,waitsForPaint:a||l&&!y,followsAtCommit:u,starting:c,paused:e.paused}),p}isFenceRecord(t){if(!this.fenceSentinel)return!1;if(t.target===this.fenceSentinel)return!0;const e=[...Array.from(t.addedNodes),...Array.from(t.removedNodes)];return t.type==="childList"&&e.length>0&&e.every(n=>n===this.fenceSentinel)}publishOffsets(){this.offsets.publish()}planeOf(t){return this.planes.get(t)}mayShowUnder(t){return this.planes.get(t)==="underlay"?!0:Array.from(this.inFlight.values()).some(({geometry:e})=>e.has(t))}placedUnder(t){var e;const n=this.planes.get(t)==="underlay"?this.geometry.get(t):void 0;if(n)return n;let i;for(const{geometry:o}of this.inFlight.values())i=(e=o.get(t))!==null&&e!==void 0?e:i;return i}shownCanvasColor(){var t;if(this.canvasColor!==null)return this.canvasColor;let e=null;for(const n of this.inFlight.values())e=(t=n.canvasColor)!==null&&t!==void 0?t:e;return e}refusedBecause(t){return this.refusals.heldReason(t)}planned(t){const e=new Set;for(const n of t)n.active&&e.add(n.handle);for(const n of t)!n.active&&n.handle.canAttemptNative()&&this.held.has(n.handle)&&e.add(n.handle);return this.held=e,this.status.present(t),e}get scrollers(){return this.offsets}completeSession(){this.session.state==="pending"&&(this.session.state="ready",this.supported.paintFence&&this.writeFence(),this.owner.refresh())}failSession(t){if(this.motion.release(),this.session.state!=="failed"){this.session={state:"failed",error:t},this.forgetSentPlans();for(const e of this.waiters)e.reject(t);this.waiters.clear();for(const e of this.natives)e.failNative(t.message)}}forgetSentPlans(){this.invalidate(),this.planes.clear(),this.geometry.clear(),this.inFlight.clear(),this.canvasColor=null,this.owner.forgetPaint()}entersUnderlay(t,e){return t.components.some(n=>n.active&&n.plane==="underlay"&&this.planes.get(n.id)==="overlay"&&!e.has(n.id))}fencesToCommit(t,e,n){if(!this.supported.paintFence)return!1;if(e.scriptTranslated)return!0;const i=this.lastPlan,o=i!==null&&wa(i.scrollContainers,t.payload.scrollContainers);return e.domChanged&&o&&n&&!t.follow}repeat(t,e,n,i){const o=this.confirmation;return o.phase==="confirmed"&&o.signature===t?(this.offsets.publish(),this.settle(n,n.generation),this.status.resume(i),this.refusals.accept(e)&&this.owner.refresh(),!0):o.phase==="sending"&&o.delivery.signature===t?(this.offsets.publish(),o.applied.then(()=>{this.settle(n,n.generation),this.status.resume(i)},r=>this.settle(n,n.generation,{error:r})),!0):!1}dispatch(t){var e;const{ticket:n,payload:i}=t,o=++this.generation;this.lastPlan=i;const r=++this.layoutSeq;this.status.noteSent(t.resuming,r);const a=Object.assign(Object.assign({},i),{layoutSeq:r,offsetSeq:this.offsets.nextSequence()});U("sent",{layoutSeq:r,payload:a});const c=this.latestGeometry();this.noteSending(r,t.geometry,(e=a.canvasColor)!==null&&e!==void 0?e:null);const l=this.offsets.noteSent(a),u={session:n.session,generation:o,payload:i,sent:a,geometry:t.geometry,scrollTopology:l,signature:t.signature},d=t.retirement?this.sendRetirement(u,t.retirement,c):void 0;t.fenced&&(a.fence=d??this.writeFence()),t.waitsForPaint&&this.waitForPaint(t.followsAtCommit?Wa():hi()),t.followsAtCommit&&this.owner.schedule();const h=()=>this.deliverStartingMotion(u,t.starting),f=(this.waitingFor?this.waitingFor.then(h):h()).finally(()=>{o===this.generation&&this.motion.release(t.paused)});t.starting&&this.waitForPaint(f.then(Wn,Wn));const p=this.confirmation.phase==="sending"?this.confirmation.confirmed:this.confirmation.signature,y={phase:"sending",delivery:u,applied:f,confirmed:p};o===this.generation&&(this.confirmation=y),f.then(()=>this.settle(n,o),w=>this.settle(n,o,{error:w})),f.then(()=>this.applied(u,t.resuming)).catch(()=>{o===this.generation&&this.confirmation===y&&(this.confirmation={phase:"confirmed",signature:y.confirmed})})}writeFence(){var t;!((t=this.fenceSentinel)===null||t===void 0)&&t.isConnected||(this.fenceSentinel=document.createElement("div"),this.fenceSentinel.setAttribute("aria-hidden","true"),this.fenceSentinel.style.cssText="position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;z-index:2147483647;will-change:transform",document.documentElement.append(this.fenceSentinel));const e=this.fenceSequence++%ki;return this.fenceSentinel.style.transform=`translate(${e/ki}px, ${ja}px)`,e}sendRetirement(t,e,n){const i=this.supported.paintFence?this.writeFence():void 0,o=Object.assign(Object.assign(Object.assign({},e),{layoutSeq:++this.layoutSeq,offsetSeq:this.offsets.nextSequence()}),i!==void 0?{fence:i}:{});return this.deliver(t,o,n).catch(Wn),t.sent.layoutSeq=++this.layoutSeq,t.sent.offsetSeq=this.offsets.nextSequence(),i}waitForPaint(t){const e=t.then(()=>{this.waitingFor===e&&(this.waitingFor=null)});this.waitingFor=e}isCurrent(t){return t.session===this.session&&t.generation===this.generation}settle(t,e,n){const{session:i}=t;if(!(i!==this.session||i.state!=="ready"||e!==this.generation))for(const o of t.waiters)this.waiters.delete(o)&&(n?o.reject(n.error):o.resolve())}deliverStartingMotion(t,e){if(!this.isCurrent(t))return Promise.resolve();if(!e)return this.deliver(t);const{motion:n}=this;if(!n.waitsFor(e))return this.restamp(t),this.deliver(t);const i=new Set(e.entries.map(o=>o.payload));return this.deliver(t,xa(t.sent,i)).then(()=>{if(this.isCurrent(t))return n.startHeld(e),t.sent.layoutSeq=++this.layoutSeq,t.sent.offsetSeq=this.offsets.nextSequence(),this.restamp(t),this.deliver(t)})}restamp(t){t.signature=pi(t.payload,this.offsets.mode)}deliver(t,e=t.sent,n=t.geometry){var i,o,r;const{session:a,generation:c}=t;if(!this.isCurrent(t))return Promise.resolve();const l=e.layoutSeq;this.noteSending(l,n,(i=e.canvasColor)!==null&&i!==void 0?i:null);const u=(r=(o=this.sendLayout)===null||o===void 0?void 0:o.call(this,e))!==null&&r!==void 0?r:Promise.resolve();this.delivered=e,this.noteSent(e);const d=this.ordered?this.nativeApplied(e):null;return u.then(()=>{const h=a===this.session;if(h&&a.state==="ready"&&(this.offsets.acknowledge(l,t.scrollTopology),this.acknowledge(e)&&this.owner.raised()),!h)return;const f=d??this.nativeApplied(e);if(c===this.generation)return f;e===t.sent&&(this.ordered&&this.status.resumeShownBy(e,l),a.state==="ready"&&this.refusals.accept(e)&&this.owner.refresh())})}applied(t,e){if(t.generation!==this.generation){t.session===this.session&&(this.confirmation.phase==="sending"?this.confirmation.confirmed="":this.confirmation.signature="");return}this.status.resume(e),this.confirmation={phase:"confirmed",signature:t.signature},this.refusals.accept(t.sent)&&this.owner.refresh()}latestGeometry(){let t=this.geometry;for(const e of this.inFlight.values())t=e.geometry;return t}noteSending(t,e,n){this.inFlight.has(t)||this.inFlight.set(t,{geometry:e,canvasColor:n})}noteSent(t){const e=new Set(t.components.map(n=>n.id));for(const n of this.natives)e.has(n.islandId)&&(this.sentIn.set(n,t.layoutSeq),n.nativeLayoutSent())}acknowledge(t){var e,n,i;const o=t.layoutSeq;if(o<=this.planeSequence)return!1;const r=new Map(t.components.filter(c=>c.active).map(c=>[c.id,c.plane])),a=Array.from(this.planes).some(([c,l])=>l==="underlay"&&r.get(c)!=="underlay")||Array.from(this.inFlight).some(([c,{geometry:l}])=>c<o&&Array.from(l.keys()).some(u=>r.get(u)!=="underlay"));this.planeSequence=o,this.geometry=(n=(e=this.inFlight.get(o))===null||e===void 0?void 0:e.geometry)!==null&&n!==void 0?n:new Map;for(const c of this.inFlight.keys())c<=o&&this.inFlight.delete(c);return this.planes=r,this.canvasColor=(i=t.canvasColor)!==null&&i!==void 0?i:null,a}nativeApplied(t){const e=t.layoutSeq;if(e<=this.appliedSequence)return Promise.resolve();this.appliedSequence=e;const n=new Set(t.components.map(o=>o.id)),i=[];for(const[o,r]of this.sentIn){const a=n.has(o.islandId),c=o.nativeLayoutApplied(a);a&&c&&i.push(c),!a&&e>r&&this.sentIn.delete(o)}return Promise.all(i).then(()=>{})}}const $a=120;function qa(s){return s.localName.includes("-")}class za{constructor(t,e=()=>{}){this.invalidate=t,this.onOpenRoot=e,this.ancestors=new Set,this.roots=new Map,this.hydrationWatches=new Map,this.pendingDefinitions=new Map,this.hydrationFrameScheduled=!1}sync(t){const e=new Set,n=new Set;for(const i of t){let o=M(i);const r=new Set;for(;o&&!r.has(o);)r.add(o),qa(o)&&(e.add(o),o.shadowRoot&&n.add(o.shadowRoot)),o=M(o)}this.ancestors=e;for(const i of Array.from(this.hydrationWatches.keys()))e.has(i)||this.hydrationWatches.delete(i);for(const[i,o]of this.roots)n.has(i)||(o.observer.disconnect(),i.removeEventListener("slotchange",o.slotChange,!0),this.roots.delete(i));for(const i of n)this.observeRoot(i);for(const i of e){if(i.shadowRoot){this.hydrationWatches.delete(i);continue}this.watchAfterUpgrade(i)}}observeRoot(t){if(this.roots.has(t))return;const e=new MutationObserver(()=>this.invalidate());e.observe(t,{attributes:!0,characterData:!0,childList:!0,subtree:!0});const n=()=>this.invalidate();t.addEventListener("slotchange",n,!0),this.roots.set(t,{observer:e,slotChange:n}),this.onOpenRoot(t)}watchAfterUpgrade(t){if(typeof customElements>"u")return;const e=t.localName;if(customElements.get(e)){this.armHydrationWatch(t);return}let n=this.pendingDefinitions.get(e);n||(n=customElements.whenDefined(e),this.pendingDefinitions.set(e,n)),n.then(()=>{this.pendingDefinitions.delete(e);let i=!1;for(const o of this.ancestors)o.localName===e&&(i=!0,o.shadowRoot?this.observeRoot(o.shadowRoot):this.armHydrationWatch(o));i&&this.invalidate()})}armHydrationWatch(t){!this.ancestors.has(t)||this.hydrationWatches.has(t)||(this.hydrationWatches.set(t,$a),this.scheduleHydrationFrame())}scheduleHydrationFrame(){this.hydrationFrameScheduled||this.hydrationWatches.size===0||(this.hydrationFrameScheduled=!0,requestAnimationFrame(()=>{this.hydrationFrameScheduled=!1;let t=!1;for(const[e,n]of this.hydrationWatches){if(!this.ancestors.has(e)||!e.isConnected){this.hydrationWatches.delete(e);continue}if(e.shadowRoot){this.hydrationWatches.delete(e),this.observeRoot(e.shadowRoot),t=!0;continue}n<=1?this.hydrationWatches.delete(e):this.hydrationWatches.set(e,n-1)}t&&this.invalidate(),this.scheduleHydrationFrame()}))}}const Tt={listeners:new Set,count:0,unwatched:!1},Ve=Symbol.for("@capacitor/native-islands/scripted-animation-watch");function Da(){const s=(n,i)=>{const o=n,r=o?.[i];if(!o||typeof r!="function"||r[Ve])return;const a=function(...c){const l=r.apply(this,c);Tt.count+=1;for(const u of Tt.listeners)u();return l};Object.defineProperty(a,Ve,{value:!0});try{o[i]=a}catch{Tt.unwatched=!0}};typeof Element<"u"&&s(Element.prototype,"animate"),typeof Animation<"u"&&s(Animation.prototype,"play"),typeof Animation<"u"&&s(Animation.prototype,"reverse");const t=typeof KeyframeEffect<"u"?KeyframeEffect.prototype:void 0,e=t?.setKeyframes;if(t&&typeof e=="function"&&!e[Ve]){const n=function(...i){Ue.delete(this),e.apply(this,i)};Object.defineProperty(n,Ve,{value:!0});try{t.setKeyframes=n}catch{Bn=!0}}}let Ue=new WeakMap,Bn=!1;function xi(){Ue=new WeakMap}function Ai(s){return/^(transform|transform-origin|transform-style|translate|scale|rotate|perspective|offset-.+)$/i.test(s)?"local-composition":/^(visibility|opacity|filter|backdrop-filter|mix-blend-mode|isolation|will-change|clip|clip-path|mask(?:-.+)?|background(?:-.+)?|border(?:-.+)?-radius|border-radius|z-index)$/i.test(s)?"repaint":/^(color|accent-color|caret-color|border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?-color|outline-color|column-rule-color|text-decoration(?:-.+)?|text-emphasis(?:-.+)?|text-underline-offset|fill(?:-opacity)?|stroke(?:-.+)?|stop-(?:color|opacity)|flood-(?:color|opacity)|lighting-color|box-shadow|text-shadow)$/i.test(s)?"none":"global-layout"}function Ci(s,t){const e=Ai(t);return e!=="global-layout"?e:/^outline-(width|offset|style)$/.test(t)||/^(border(-(top|right|bottom|left))?-width|padding(-(top|right|bottom|left))?)$/.test(t)&&s instanceof HTMLElement&&Ha(s)?"repaint":e}function Ha(s){if(typeof CSSUnitValue>"u"||k(s).boxSizing!=="border-box")return!1;const t=s.computedStyleMap();return["width","height"].every(e=>{const n=t.get(e);return n instanceof CSSUnitValue&&n.unit==="px"})}function Va(s){return s.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`)}const Ri=/(^|;\s*)transform:\s*translate3d\(\s*-?[\d.]+px,\s*-?[\d.]+px,\s*0(?:px)?\s*\)\s*(?=;|$)/,Ua=/^transform:\s*translate3d\(\s*-?[\d.]+px,\s*-?[\d.]+px,\s*0(?:px)?\s*\)$/;function Ya(s,t){if(s===t)return!1;const e=a=>(a??"").split(";").map(c=>c.trim()).filter(Boolean),[n,i]=[e(s),e(t)],o=[...n,...i].filter(a=>a.startsWith("transform:"));if(o.length===0||!o.every(a=>Ua.test(a)))return!1;const r=a=>a.filter(c=>!c.startsWith("transform:")).join(";");return r(n)===r(i)}function Xa(s,t){if(s===null||t===null)return!1;const e=i=>{if(!Ri.test(i))return null;const o=i.replace(Ri,"$1");return o.includes("transform")?null:o},n=e(s);return n!==null&&n===e(t)}const $n=new Set(["offset","computedOffset","easing","composite"]);function Ct(s){const t=s.transitionProperty;return typeof t=="string"?t:void 0}function qn(s){const t=Ct(s);if(t!==void 0)return Ci(Ye(s),t);const e=s.effect;if(typeof e?.getKeyframes!="function")return"global-layout";const n=Bn?void 0:Ue.get(e);if(n!==void 0)return n;const i=Ga(e);return Bn||Ue.set(e,i),i}function Ga(s){try{let t="none";for(const e of s.getKeyframes())for(const n of Object.keys(e)){if($n.has(n))continue;const i=Ai(Va(n));if(i==="global-layout")return i;t!=="local-composition"&&i!=="none"&&(t=i)}return t}catch{return"global-layout"}}function Ye(s){var t;const e=(t=s.effect)===null||t===void 0?void 0:t.target;if(e instanceof Element)return e;const n=e?.element;return n instanceof Element?n:null}let zn=new WeakMap,Dn=new WeakMap,T=null;const Mi=()=>({order:new WeakMap,level:new WeakMap,phase:new WeakMap,topLayer:new WeakMap});let Pi=()=>[document];function Ka(s){Pi=s}function Ja(s,t){if(typeof s.querySelector!="function")return null;try{return s.querySelector(t)!==null}catch{return!1}}function Za(){if(document.fullscreenElement)return!0;for(const s of Pi())for(const t of[":modal",":popover-open"])if(Ja(s,t)!==!1)return!0;return!1}let Qa=0;const ae=new WeakMap;function Oi(s,t){try{return s.matches(t)}catch{return!1}}function Xe(s){var t;if(T&&((t=T.topLayerOpen)!==null&&t!==void 0||(T.topLayerOpen=Za()),!T.topLayerOpen))return null;let e=s;for(;e;){if(e===document.fullscreenElement||Oi(e,":modal")||Oi(e,":popover-open"))return e;e=M(e)}return null}function Hn(s,t){t?ae.has(s)||ae.set(s,++Qa):ae.delete(s)}function Dt(){zn=new WeakMap,Dn=new WeakMap,T&&(T=Mi())}function tl(s){const t=T;Dt(),T=Mi();try{return s()}finally{T=t}}function Ge(s,t,e){if(!s)return e();if(s.has(t))return s.get(t);const n=e();return s.set(t,n),n}function el(s){const t=M(s);if(!t)return!1;const e=k(t).display;return e==="flex"||e==="inline-flex"||e==="grid"||e==="inline-grid"}function _i(s,t){return t.zIndex!=="auto"&&(t.position!=="static"||el(s))}function ft(s){const t=zn.get(s);if(t!==void 0)return t;let e=!1;if(s===document.documentElement)e=!0;else{const n=k(s);e=_i(s,n)||n.position==="fixed"||n.position==="sticky"||parseFloat(n.opacity)<1||n.transform!=="none"||n.translate!==void 0&&n.translate!=="none"&&n.translate!==""||n.perspective!=="none"||n.filter!=="none"||n.backdropFilter!==void 0&&n.backdropFilter!=="none"&&n.backdropFilter!==""||n.mixBlendMode!=="normal"||n.isolation==="isolate"||n.clipPath!==void 0&&n.clipPath!=="none"&&n.clipPath!==""||n.maskImage!==void 0&&n.maskImage!=="none"&&n.maskImage!==""||/transform|opacity|filter|perspective|clip-path/.test(n.willChange||"")||/paint|layout|strict|content/.test(n.contain||"")||n.containerType==="size"||n.containerType==="inline-size"}return zn.set(s,e),e}function Ke(s){const t=Dn.get(s);if(t!==void 0)return t;let e=M(s);for(;e&&!ft(e);)e=M(e);return Dn.set(s,e),e}function Ei(s){const t=[s];for(let e=Ke(s);e;e=Ke(e))t.push(e);return t}function Ni(s,t){if(ft(t))return!1;let e=s,n=Ke(s);for(;n&&n!==t&&_(t,n);)e=n,n=Ke(n);return Je(e)<0}function Je(s){return Ge(T?.level,s,()=>{const t=k(s);if(_i(s,t)){const e=parseInt(t.zIndex,10);if(!Number.isNaN(e))return e}return 0})}function Ii(s,t){if(k(s).position!=="static"||ft(s))return s;for(let e=M(s);e&&e!==t;e=M(e))if(k(e).position!=="static")return e;return s}function Ti(s){return Ge(T?.phase,s,()=>{const t=k(s),e=Je(s);return e<0?0:e>0?5:ft(s)||t.position!=="static"?4:t.float!==void 0&&t.float!=="none"?2:/^(inline|inline-block|inline-flex|inline-grid|ruby)/.test(t.display)?3:1})}function Li(s,t){const e=[],n=[];let i=s;for(;i;)e.push(i),i=M(i);for(i=t;i;)n.push(i),i=M(i);const o=new Map(n.map((f,p)=>[f,p])),r=e.findIndex(f=>o.has(f));if(r<0)return 0;const a=e[r],c=o.get(a);if(c===void 0)return 0;if(r===0)return-1;if(c===0)return 1;const l=e[r-1],u=n[c-1];if(l===u)return 0;const d=k(a).display;if(/^(?:inline-)?(?:flex|grid)$/.test(d)){const f=Number.parseInt(k(l).order,10)||0,p=Number.parseInt(k(u).order,10)||0;if(f!==p)return f-p}const h=l.compareDocumentPosition(u);return h&Node.DOCUMENT_POSITION_FOLLOWING?-1:h&Node.DOCUMENT_POSITION_PRECEDING?1:0}function St(s,t){var e,n;if(s===t)return 0;const i=T?.order,o=(e=i?.get(s))===null||e===void 0?void 0:e.get(t);if(o!==void 0)return o;const r=nl(s,t);if(i)for(const[a,c,l]of[[s,t,r],[t,s,-r]]){const u=(n=i.get(a))!==null&&n!==void 0?n:new Map;u.set(c,l),i.set(a,u)}return r}function nl(s,t){var e,n;const i=Ge(T?.topLayer,s,()=>Xe(s)),o=Ge(T?.topLayer,t,()=>Xe(t));if(i!==o){if(i&&!o)return 1;if(o&&!i)return-1;if(i&&o){const v=(e=ae.get(i))!==null&&e!==void 0?e:0,x=(n=ae.get(o))!==null&&n!==void 0?n:0;return v!==x?v-x:Li(i,o)}}if(_(s,t))return Ni(t,s)?1:-1;if(_(t,s))return Ni(s,t)?-1:1;const r=Ei(s),a=Ei(t),c=new Set(a),l=r.find(v=>c.has(v));if(!l)return 0;if(l===s)return-1;if(l===t)return 1;let u=r[r.indexOf(l)-1],d=a[a.indexOf(l)-1];if(u===d)return 0;const h=Ii(u,l),f=Ii(d,l);h!==f&&(u=h,d=f);const p=Je(u),y=Je(d);if(p!==y)return p-y;const w=Ti(u),g=Ti(d);return w!==g?w-g:Li(u,d)}const sl=new Set(["has","not","is","where","matches","nth-child","nth-last-child","nth-of-type","nth-last-of-type","first-child","last-child","only-child","first-of-type","last-of-type","only-of-type","empty","root"]);function il(s){var t;if(s.includes("\\"))return null;const e=s.replace(/"[^"]*"|'[^']*'/g,'""'),n=new Set;let i=!0;const o=e.replace(/\[[^\]]*\]/g,a=>{var c;const l=(c=/^\[\s*(?:[\w*-]*\|)?([\w-]+)\s*(?:[~|^$*]?=|\])/.exec(a))===null||c===void 0?void 0:c[1];return l?n.add(l.toLowerCase()):i=!1,"[]"}).replace(/::[\w-]+/g,"");if(!i)return null;o.includes("#")&&n.add("id");const r=new Set;for(const a of(t=o.match(/\.[^\s.#:[\]()>+~,*]+/g))!==null&&t!==void 0?t:[])r.add(a.slice(1));return{classes:r,attributes:n,state:Fi(o),focus:/:focus/i.test(o)}}function ol(s){if(s.includes("\\"))return[];let t=Wi(s).replace(/\[[^\]]*\]/g,"");for(let e="";e!==t;)e=t,t=t.replace(/\([^()]*\)/g,"");return Array.from(t.matchAll(/\.([^\s.#:[\]()>+~,*]+)/g),e=>e[1])}function Ze(s){const t=e=>e[0]+"_".repeat(e.length-2)+e[e.length-1];return s.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,t).replace(/\[[^\]]*\]/g,t)}function Fi(s){var t;for(const e of(t=s.match(/:[\w-]+/g))!==null&&t!==void 0?t:[])if(!sl.has(e.slice(1).toLowerCase()))return!0;return!1}function rl(s){const t=[];let e=0,n="",i=0;for(let r=0;r<=s.length;r+=1){const a=s[r];if(n!=="")a==="\\"?r+=1:a===n&&(n="");else if(a==='"'||a==="'")n=a;else if(a==="("||a==="[")e+=1;else if(a===")"||a==="]")e-=1;else if(r===s.length||e===0&&/[\s>+~]/.test(a)){const c=s.slice(i,r).trim();c!==""&&t.push(c),i=r+1}}const o=[];return t.forEach((r,a)=>{Fi(Ze(r))&&(a<t.length-1?o.push(Bi(r)):/:has\(\s*[+~]|:(?:is|where|not|matches)\([^)]*[\s>+~]/i.test(Ze(r))&&o.push("*"))}),o}function al(s){const t=Ze(s);return/[+~]/.test(t)||/:(?:has|nth-|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|empty)/i.test(t)}function ll(s){const t=[];let e=0,n=null,i="";for(const o of s){if(n){i+=o,o===n&&(n=null);continue}if(o==='"'||o==="'")n=o;else if(o==="("||o==="[")e+=1;else if(o===")"||o==="]")e-=1;else if(o===","&&e===0){i.trim()&&t.push(i.trim()),i="";continue}i+=o}return i.trim()&&t.push(i.trim()),t}function ji(s){return s.replace(/::[\w-]+(?:\([^)]*\))?/g,"").replace(/:(?:before|after|first-line|first-letter)\b/gi,"").trim()}function Wi(s){let t=0,e=0;const n=Ze(s);for(let i=0;i<n.length;i+=1){const o=n[i];o==="("||o==="["?t+=1:o===")"||o==="]"?t-=1:t===0&&/[\s>+~]/.test(o)&&(e=i+1)}return s.slice(e).trim()}function Bi(s){let t="",e=0,n=!1;for(const i of s){if(!n&&e===0&&i===":"){n=!0;continue}if(n){if(i==="(")e+=1;else if(i===")")e-=1;else if(e===0&&/[.#[:]/.test(i)){if(n=!1,i===":"){n=!0;continue}t+=i}continue}t+=i}return t.trim()||"*"}class cl{constructor(t=()=>!1){this.hasShadowRoots=t,this.index={phase:"unread"},this.sheets=[],this.matches=new Map,this.containers=new Map,this.changes=null}get scoped(){return this.scopedRules()!==null}scopedRules(){return this.index.phase==="whole"&&!this.hasShadowRoots()?this.index.rules:null}readAhead(){var t;for(const e of(t=Vn())!==null&&t!==void 0?t:[])Di(e)}invalidateIndex(){this.index.phase!=="unread"&&(this.index={phase:"stale"})}noteChange(t){var e;if(this.keepPresent(t),this.changes==="any")return;if(!t){this.changes="any";return}const n=(e=this.changes)!==null&&e!==void 0?e:{classes:new Set,attributes:new Set,style:!1};this.changes=n;for(const i of t){const o=i.target,r=i.attributeName;if(i.type!=="attributes"||!r||typeof o.getAttribute!="function"){this.changes="any";return}if(r==="class"){const a=Un(i.oldValue),c=Un(o.getAttribute("class"));for(const l of a)c.has(l)||n.classes.add(l);for(const l of c)a.has(l)||n.classes.add(l)}else r==="style"?n.style=!0:n.attributes.add(r.toLowerCase())}}keepPresent(t){var e,n,i;const o=this.present;if(o){if(!t){this.present=void 0;return}for(const r of t)if(r.type==="attributes"&&r.attributeName==="class")for(const a of Un((i=(n=(e=r.target).getAttribute)===null||n===void 0?void 0:n.call(e,"class"))!==null&&i!==void 0?i:null))o.add(a);else if(r.type==="childList")for(const a of Array.from(r.addedNodes)){if(typeof a.querySelectorAll!="function")continue;const c=a;if(![c,...Array.from(c.querySelectorAll("[class]"))].every(u=>Xi(u,o))){this.present=void 0;return}}}}collect(){const{phase:t}=this.index;if((t==="partial"||t==="whole")&&this.sheetsChanged()&&(this.index={phase:"stale"}),this.index.phase==="unread"||this.index.phase==="stale"){const i=this.index.phase==="unread";return this.rebuild(this.changes===null?this.matches:null),this.changes=null,i?[]:"all"}const e=this.scopedRules();if(!e)return this.changes!==null&&(this.changes="any"),[];const n=this.changes;return this.changes=null,[...n===null?[]:this.changedRoots(e,n),...this.resizedContainers()]}changedRoots(t,e){var n;const i=[],o=a=>{var c;const l=new Set(Qe(a)),u=(c=this.matches.get(a))!==null&&c!==void 0?c:Vi;for(const d of l)u.has(d)||i.push(d);for(const d of u)!l.has(d)&&d.isConnected&&i.push(d);this.matches.set(a,l)},r=[];for(const[a,c]of t.nonLocal)if(!(e!=="any"&&!fl(c.inputs,e))){if(((n=this.matches.get(a))!==null&&n!==void 0?n:Vi).size>0){o(a);continue}this.possible(c.required)&&r.push(a)}for(const a of Yi(r))o(a);for(const a of t.subjects)i.push(...Qe(a));return this.findContainers(t),i}resizedContainers(){const t=[];for(const[e,n]of this.containers){if(!e.isConnected){this.containers.delete(e);continue}const i=Gi(e,n.type);i!==n.size&&(n.size=i,t.push(e))}return t}rebuild(t){this.index={phase:"partial"},this.matches=new Map,this.containers.clear(),this.present=void 0;const e=Vn();if(!e)return;this.sheets=e;const n=ul(e);n&&(this.index={phase:"whole",rules:n},this.snapshot(n,t))}stateReach(t){var e;const n=this.scopedRules();if(!n||this.sheetsChanged())return"all";const i=n.stateAnchors,o=[],r=[];try{for(let a=t;a;a=a.parentElement)o.push(a),i!==""&&a.matches(i)&&r.push((e=a.parentElement)!==null&&e!==void 0?e:a)}catch{return"all"}return{own:o,subtrees:r}}sheetsChanged(){const t=Vn();return t?t.length!==this.sheets.length||t.some((e,n)=>e!==this.sheets[n]):!1}possible(t){if(t.length===0)return!0;this.present===void 0&&(this.present=gl());const e=this.present;return e===null||t.every(n=>e.has(n))}snapshot(t,e){const n=[];for(const[i,o]of t.nonLocal){const r=e?.get(i);r?this.matches.set(i,r):this.possible(o.required)&&n.push(i)}for(const i of Yi(n))this.matches.set(i,new Set(Qe(i)));this.findContainers(t)}findContainers(t){const e=new Map,n=new Set;for(const i of t.containerRules)for(const o of Qe(i))for(let r=o.parentElement;r&&!n.has(r);r=r.parentElement){n.add(r);const a=k(r),c=a.getPropertyValue("container-type").trim();if(c===""||c==="normal")continue;const l=/^vertical|^sideways/.test(a.getPropertyValue("writing-mode").trim());e.set(r,`${c}${l?" vertical":""}`)}for(const i of this.containers.keys())e.has(i)||this.containers.delete(i);for(const[i,o]of e)this.containers.has(i)||this.containers.set(i,{type:o,size:Gi(i,o)})}}function ul(s){const t=qi();for(const e of s){const n=Di(e);if(!n)return null;for(const i of hl)for(const o of n[i])t[i].add(o)}return{nonLocal:new Map(Array.from(t.nonLocal,e=>[e,dl(e)])),subjects:[...t.subjects],containerRules:[...t.containerRules],stateAnchors:[...t.stateAnchors].join(", ")}}const $i=new Map;function dl(s){let t=$i.get(s);return t||(t={inputs:il(s),required:ol(s)},$i.set(s,t)),t}function Vn(){var s;return typeof document>"u"||!document.styleSheets?null:[...Array.from(document.styleSheets),...(s=document.adoptedStyleSheets)!==null&&s!==void 0?s:[]]}const hl=["nonLocal","subjects","containerRules","stateAnchors"];function qi(){return{nonLocal:new Set,subjects:new Set,containerRules:new Set,stateAnchors:new Set}}const zi=new WeakMap;function Di(s){let t;try{t=s.cssRules}catch{return null}const e=zi.get(s);if(e&&e.rules===t.length)return e.read;const n=qi();let i=!1;const o=(a,c,l)=>{var u,d;for(const h of Array.from(a)){const f=h;if(typeof f.selectorText=="string"){const g=ll(f.selectorText).map(x=>pl(x,l)),v=f.cssRules;if(v&&v.length>0){const x=g.map(ji).filter(m=>m!=="");if(x.length===0||!o(v,c,x.join(", ")))return!1}for(const x of g){const m=ji(x);if(m!==""){c&&n.containerRules.add(m);for(const b of rl(m))n.stateAnchors.add(Yn(b)?b:"*");if(al(x))if(Yn(m))n.nonLocal.add(m);else{const b=Bi(Wi(m));if(!Yn(b))return!1;n.subjects.add(b)}}}continue}const p=(d=(u=h.constructor)===null||u===void 0?void 0:u.name)!==null&&d!==void 0?d:"";if(p==="CSSScopeRule")return!1;const y=h.styleSheet;if(y){i=!0;let g;try{g=y.cssRules}catch{return!1}if(!o(g,c,l))return!1;continue}const w=h.cssRules;if(w&&!o(w,c||p==="CSSContainerRule",l))return!1}return!0},r=o(t,!1,null)?n:null;return i||zi.set(s,{rules:t.length,read:r}),r}function Un(s){return new Set((s??"").split(/\s+/).filter(Boolean))}function fl(s,t){if(!s)return!0;for(const e of t.classes)if(s.classes.has(e))return!0;if(t.classes.size>0&&s.attributes.has("class")||t.style&&(s.focus||s.attributes.has("style")))return!0;if(t.attributes.size>0){if(s.state)return!0;for(const e of t.attributes)if(s.attributes.has(e))return!0}return!1}function pl(s,t){if(t===null)return s;const e=`:is(${t})`;return s.includes("&")?s.split("&").join(e):`${e} ${s}`}function ml(s){var t;const e=s.target;if(typeof ShadowRoot<"u"&&e instanceof ShadowRoot)return"all";const n=e instanceof Element?e:e.parentElement;if(!n)return[];if(Hi(n))return"all";if(s.type!=="childList")return[n];const i=[n];for(const o of[...Array.from(s.addedNodes),...Array.from(s.removedNodes)])if(o instanceof Element&&(Hi(o)||!((t=o.querySelector)===null||t===void 0)&&t.call(o,'style, link[rel~="stylesheet"]')))return"all";for(const o of Array.from(s.addedNodes))o instanceof Element&&i.push(o);return i}function Hi(s){var t;const e=s.tagName.toUpperCase();return e==="STYLE"||e==="LINK"&&/(?:^|\s)stylesheet(?:\s|$)/i.test((t=s.getAttribute("rel"))!==null&&t!==void 0?t:"")}function Qe(s){try{return Array.from(document.querySelectorAll(s))}catch{return[]}}const Vi=new Set,Ui=8;function Yi(s){const t=[];for(let e=0;e<s.length;e+=Ui){const n=s.slice(e,e+Ui);n.length>1&&vl(n.join(", "))||t.push(...n)}return t}function gl(){try{const s=new Set;for(const t of Array.from(document.querySelectorAll("[class]")))if(!Xi(t,s))return null;return s}catch{return null}}function Xi(s,t){const e=s.classList;if(!e)return!1;for(const n of Array.from(e))t.add(n);return!0}function vl(s){try{return document.querySelectorAll(s).length===0}catch{return!1}}function Yn(s){if(s==="")return!1;try{return document.querySelectorAll(s),!0}catch{return!1}}function Gi(s,t){const e=s.getBoundingClientRect(),n=Math.round(e.width*2),i=Math.round(e.height*2);return/\binline-size\b/.test(t)?/\bvertical\b/.test(t)?`${i}`:`${n}`:`${n}x${i}`}const Ki=new Set(["pointerover","pointerout","pointerdown","pointerup","pointercancel","focusin","focusout","input","change"]),bl=[...Ki,"beforetoggle","toggle","close","cancel","contentvisibilityautostatechange"];function yl(s){const t=new Set,e=new Set;for(const n of s)if(n.type==="childList"){for(const i of n.removedNodes)t.add(i);for(const i of n.addedNodes)!t.has(i)&&!i.isConnected&&e.add(i),t.add(i)}return e}function Ji(s,t){if(!s.target.isConnected)return!0;if(s.type!=="childList")return!1;const e=[...s.addedNodes,...s.removedNodes];return e.length>0&&e.every(n=>t.has(n))}class wl{constructor(t,e){this.host=t,this.noted={scriptTranslated:!1,domChanged:!1},this.styleScope=new cl(()=>this.shadowRoots().length>0),this.mutationObserver=null,this.resizeObserver=null,this.sheetsAhead=!1,this.sized=new Map,this.roots=new Set,this.listeners=[...this.host.effects.listeners,["load",n=>this.onLoad(n)],...bl.flatMap(n=>[[n,i=>this.onStyleStateChange(i)],[n,i=>this.onTopLayerState(i)]])],this.onScroll=n=>{const i=n?.target,o=i instanceof Element&&i!==document.scrollingElement?i:null,r=o!==null&&this.host.link.innerScrollMode==="native"&&Nn(k(o));(o===null||this.host.natives.some(c=>_(o,c.el)))&&!r&&this.host.frames.noteScroll(),this.host.frames.wake()},this.compositionObserver=new za(()=>t.refresh(),e)}start(){if(this.readSheetsAhead(),Da(),Tt.listeners.add(()=>{this.host.effects.markDue(),this.host.frames.wake()}),Ka(()=>[document,...this.shadowRoots()]),this.mutationObserver=new MutationObserver(t=>this.host.handleDomMutations(t)),this.mutationObserver.observe(document.documentElement,{attributes:!0,attributeOldValue:!0,characterData:!0,childList:!0,subtree:!0}),typeof ResizeObserver<"u"){this.resizeObserver=new ResizeObserver(t=>{const e=t.find(o=>o.target===document.documentElement),n=e?.contentRect.width,i=n!==void 0&&n!==this.rootWidth;if(n!==void 0&&(this.rootWidth=n),!this.styleScope.scoped||i)this.host.scene.forgetLayers();else if(this.host.frames.plannedThisFrame)return;this.host.refresh()}),this.resizeObserver.observe(document.documentElement);for(const t of this.sized.keys())this.resizeObserver.observe(t)}this.observeRoot(document)}observeSize(t){var e,n;const i=(e=this.sized.get(t))!==null&&e!==void 0?e:0;this.sized.set(t,i+1),i===0&&((n=this.resizeObserver)===null||n===void 0||n.observe(t))}unobserveSize(t){var e;const n=this.sized.get(t);if(n!==void 0){if(n>1){this.sized.set(t,n-1);return}this.sized.delete(t),(e=this.resizeObserver)===null||e===void 0||e.unobserve(t)}}observeRoot(t){if(!this.roots.has(t)){this.roots.add(t);for(const[e,n]of this.listeners)t.addEventListener(e,n,!0);t.addEventListener("scroll",this.onScroll,{capture:!0,passive:!0})}}unobserveRoot(t){if(this.roots.delete(t)){for(const[e,n]of this.listeners)t.removeEventListener(e,n,!0);t.removeEventListener("scroll",this.onScroll,{capture:!0})}}takePendingMutations(t,e){var n,i;return((i=(n=this.mutationObserver)===null||n===void 0?void 0:n.takeRecords())!==null&&i!==void 0?i:[]).filter(o=>o.target!==t||o.attributeName!=="style"||!e.has(o.oldValue))}get changes(){return this.noted}takeChanges(){const t=Object.assign({},this.noted);return this.noted.scriptTranslated=!1,this.noted.domChanged=!1,t}takeRestyled(){return this.styleScope.collect()}observeComposition(t){this.compositionObserver.sync(t)}noteMutations(t){const e=yl(t);t.some(o=>o.type==="childList"&&!Ji(o,e))&&this.host.effects.forgetRoots();const n={records:[],hosts:[],reachesAll:!1,uncovering:!1},i=[];for(const o of t){if(this.host.link.isFenceRecord(o)||Ji(o,e))continue;if(typeof ShadowRoot<"u"&&o.target instanceof ShadowRoot){n.reachesAll=!0;continue}const r=o.target instanceof Element?o.target:o.target.parentElement;if(!r||this.changesNothing(o,r))continue;if(this.host.scene.notePageChange(r,o.type==="attributes"?o.attributeName:void 0)&&(n.uncovering=!0),n.records.push(o),n.hosts.push(o.type==="attributes"?r.parentElement:r),o.type==="attributes"&&o.attributeName==="style"){const c=r.getAttribute("style");if(Ya(o.oldValue,c)&&(this.noted.scriptTranslated=!0),Xa(o.oldValue,c))continue}this.noted.domChanged=!0;const a=ml(o);a==="all"?n.reachesAll=!0:i.push(...a)}if(!n.reachesAll&&n.records.length===0)return null;if(n.reachesAll&&(this.styleScope.invalidateIndex(),xi()),n.reachesAll||!this.styleScope.scoped)this.host.scene.forgetLayers();else{this.styleScope.noteChange(n.records);for(const o of ze(i))this.host.scene.forgetLayers(o)}return n}shadowRoots(){return Array.from(this.roots).filter(t=>typeof ShadowRoot<"u"&&t instanceof ShadowRoot)}changesNothing(t,e){return Xo(e,t.type==="childList")?!0:t.type!=="attributes"?!1:t.attributeName&&e.getAttribute(t.attributeName)===t.oldValue?!0:e instanceof HTMLElement&&this.host.writes.wrote(e,t.attributeName)}onLoad(t){var e;(t.target instanceof HTMLStyleElement||t.target instanceof HTMLLinkElement&&/(?:^|\s)stylesheet(?:\s|$)/i.test((e=t.target.getAttribute("rel"))!==null&&e!==void 0?e:""))&&(this.styleScope.invalidateIndex(),this.host.scene.forgetLayers(),this.readSheetsAhead()),this.host.refresh()}readSheetsAhead(){var t;if(this.sheetsAhead)return;this.sheetsAhead=!0,((t=globalThis.requestIdleCallback)!==null&&t!==void 0?t:n=>setTimeout(n))(()=>{this.sheetsAhead=!1,this.styleScope.readAhead()})}onStyleStateChange(t){if(t.pointerType==="touch"&&t.type!=="pointerup"){t.type==="pointerdown"&&this.host.link.publishOffsets(),this.host.frames.wake();return}const e=Ki.has(t.type)&&t.target instanceof Element?this.styleScope.stateReach(t.target):"all";if(e==="all")this.host.scene.forgetLayers();else{for(const n of e.own)this.host.scene.forgetLayers(n,!0);for(const n of ze(e.subtrees))this.host.scene.forgetLayers(n)}this.host.refresh()}onTopLayerState(t){if(t.target instanceof Element)if(t.type==="beforetoggle")Hn(t.target,t.newState==="open");else if(t.type==="close"||t.type==="cancel")Hn(t.target,!1);else{const e=Xe(t.target);e&&Hn(e,!0)}}}const Zi=.05;let le=null;function Sl(){var s,t,e,n;if(le?.document===document)return le.zoom;let i=1,o=null;try{o=document.createElement("div"),o.style.cssText="position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;transition:transform 1000s linear",((s=document.body)!==null&&s!==void 0?s:document.documentElement).append(o),getComputedStyle(o).transform,o.style.transform="translateX(100px)";const r=o.getAnimations().find(u=>Ct(u)==="transform"),a=(e=(t=r?.effect)===null||t===void 0?void 0:t.getKeyframes())!==null&&e!==void 0?e:[],c=(n=a[a.length-1])===null||n===void 0?void 0:n.transform,l=typeof c=="string"?Nr(c,"transform",1,1):null;l&&l.x>0&&(i=N(l.x/100)),r?.cancel()}catch{i=1}finally{o?.remove()}return le={document,zoom:i},i}function kl(s){const t=ut(s,"transform",0,0);return!!t&&t.x===0&&t.y===0&&t.sx===1&&t.sy===1}function Qi(s,t){const e=ut(k(s).getPropertyValue(t),t,0,0);return e&&[e.sx,e.sy]}function xl(s,t,e){var n;const i=k(s),o=ut(i.getPropertyValue("scale"),"scale",t,e),r=(n=ut(i.transform,"transform",t,e))!==null&&n!==void 0?n:{sx:1,sy:1};return o?{sx:o.sx*r.sx,sy:o.sy*r.sy}:null}function Al(s,t){var e;const n=Qi(s,t),i=((e=k(s).transformOrigin)!==null&&e!==void 0?e:"").trim().split(/\s+/).map(o=>Number.parseFloat(o));return!n||i.length<2||!i.slice(0,2).every(Number.isFinite)?null:{property:t,current:n,originX:N(i[0]),originY:N(i[1])}}function Cl(s,t){const e=s.getBoundingClientRect(),n=s instanceof HTMLElement?s:null,i=(c,l)=>l===void 0||l<=0||Math.abs(c-l)<=1?{size:c,scale:1}:{size:l,scale:c/l},o=i(e.width,n?.offsetWidth),r=i(e.height,n?.offsetHeight),a=t?xl(s,o.size,r.size):{sx:1,sy:1};return a===null?null:{width:o.size,height:r.size,parentX:a.sx===1?o.scale:e.width/(o.size||1)/a.sx,parentY:a.sy===1?r.scale:e.height/(r.size||1)/a.sy}}function Rl(s,t,e){var n,i,o,r,a;const c=t.getComputedTiming(),l=Fs(typeof c.easing=="string"?c.easing:void 0),u=typeof c.duration=="number"?c.duration:Number.NaN,d=(n=c.iterations)!==null&&n!==void 0?n:1,h=(i=c.delay)!==null&&i!==void 0?i:0,f=c.fill==="auto"||c.fill===void 0?"none":c.fill,p=(o=c.direction)!==null&&o!==void 0?o:"normal",y=(r=c.iterationStart)!==null&&r!==void 0?r:0,w=typeof s.currentTime=="number"?s.currentTime:0;if(l===null||!Number.isFinite(u)||u<=0||!(d>=0)||!Number.isFinite(s.playbackRate)||s.playbackRate===0)return null;const g=h===0&&w<0&&w>=-.5&&p==="normal"&&!y;return w<h&&f!=="backwards"&&f!=="both"&&!g?null:{easing:l,duration:u,iterations:d,delay:h,endDelay:(a=c.endDelay)!==null&&a!==void 0?a:0,iterationStart:y,direction:p,fill:f,currentTime:w,measuresNow:e||g,startsAtFirstFrame:!y&&(p==="normal"||p==="alternate")}}function Ml(s,t,e,n,i,o){if(s==="transform"||s==="translate"){if(n.transform!==null&&n.transform!==s)return null;n.transform=s;const r=ut(t,s,e.width,e.height,o);if(!r)return null;const a=[];if(s==="transform"&&i){if(n.scale!==null&&n.scale!=="transform")return null;n.scale="transform",a.push(["scale",[N(r.sx),N(r.sy)]])}else if(r.sx!==1||r.sy!==1)return null;return a.push(["translate",[N(r.x*e.parentX),N(r.y*e.parentY)]]),a}if(s==="scale"&&i){if(n.scale!==null&&n.scale!=="scale")return null;n.scale="scale";const r=ut(t,"scale",e.width,e.height);return r&&[["scale",[N(r.sx),N(r.sy)]]]}if(s==="visibility")return[];if(s==="opacity"){const r=Number.parseFloat(t);return Number.isFinite(r)?[["opacity",[N(Math.min(1,Math.max(0,r)))]]]:null}return null}function Pl(s,t,e,n,i){var o,r;const a=new Map;for(const l of s.getKeyframes()){const u=(o=l.computedOffset)!==null&&o!==void 0?o:l.offset;if(typeof u!="number"||!Number.isFinite(u)||l.composite!==void 0&&l.composite!=="auto"&&l.composite!=="replace")return null;const d=Fs(typeof l.easing=="string"?l.easing:void 0);if(d===null)return null;for(const[h,f]of Object.entries(l)){if($n.has(h))continue;const p=typeof f=="string"?f:typeof f=="number"?String(f):null;if(p===null)return null;const y=Ml(h,p,t,e,n,i);if(!y)return null;for(const[w,g]of y){const v=(r=a.get(w))!==null&&r!==void 0?r:[];v.push(Object.assign({offset:N(u),value:g},d?{easing:d}:{})),a.set(w,v)}}}const c=a.get("scale");if(c?.every(l=>l.value[0]===1&&l.value[1]===1))a.delete("scale");else if(c?.some(l=>!(l.value[0]>=0&&l.value[1]>=0)))return null;return a}function Ol(s,t,e,n,i,o){if(t==="translate"&&i.transform){const r=i.transform,a=o.measuresNow?ut(k(s).getPropertyValue(r),r,n.width,n.height):null;if(!a)return{anchored:!1,geometry:{}};const c=o.startsAtFirstFrame,l=c?{x:e[0].value[0]/n.parentX,y:e[0].value[1]/n.parentY}:{x:a.x,y:a.y};return{anchored:c,geometry:{translation:Object.assign(Object.assign({anchored:c,property:r},l),{width:n.width,height:n.height,scaleX:n.parentX,scaleY:n.parentY})}}}if(t==="scale"){const r=i.scale&&Al(s,i.scale);if(!r)return null;const a=o.measuresNow&&o.startsAtFirstFrame,c=a?e[0].value:r.current;return c[0]>=Zi&&c[1]>=Zi?{anchored:a,geometry:{scaling:Object.assign(Object.assign({anchored:a,property:r.property},o.measuresNow?{x:c[0],y:c[1]}:{}),{originX:r.originX,originY:r.originY})}}:null}return{anchored:!1,geometry:{}}}function to(s,t,e=!1,n=!1){if(t.length===0)return null;const i=Cl(s,n);if(!i)return null;const o=[],r=new Set,a={transform:null,scale:null};for(const c of t){const l=c.effect;if(!l||typeof l.getKeyframes!="function"||typeof l.getComputedTiming!="function"||l.pseudoElement||l.composite!==void 0&&l.composite!=="replace")return null;const u=Rl(c,l,e);if(!u)return null;const d=Ct(c)!==void 0,h=Pl(l,i,a,n,d?1/Sl():1);if(!h)return null;for(const[f,p]of h){if(r.has(f)||p[0].offset!==0||p[p.length-1].offset!==1)return null;r.add(f);const y=Ol(s,f,p,i,a,u);if(!y)return null;const{anchored:w,geometry:g}=y;o.push(Object.assign(Object.assign({animation:c,measuredAt:performance.now()},g),{payload:Object.assign(Object.assign({channel:f,keyframes:p},u.easing?{easing:u.easing}:{}),{delay:N(u.delay),endDelay:N(u.endDelay),duration:N(u.duration),iterations:Number.isFinite(u.iterations)?u.iterations:null,iterationStart:u.iterationStart,direction:u.direction,fill:u.fill,startTime:typeof c.startTime=="number"?N(c.startTime):0,playbackRate:c.playbackRate,sampledTime:w?0:N(u.currentTime)})}))}}return o.length===0?null:_l(s,r,a)?o:null}function _l(s,t,e){if(t.has("scale")){const i=k(s);if(F(i,"rotate")||e.scale==="scale"&&(e.transform==="transform"||!kl(i.transform)))return!1}const n=s instanceof HTMLElement?s:null;return!(t.has("opacity")&&n&&n.children.length>0&&Number.parseFloat(k(n).opacity)===0)}function El(s,t){var e;for(const n of s)if(n.playState==="running")try{const i=n.effect,o=(e=i?.getTiming)===null||e===void 0?void 0:e.call(i);i&&o&&!o.delay&&(o.fill==="none"||o.fill==="forwards"||o.fill==="auto")&&i.updateTiming({fill:o.fill==="forwards"?"both":"backwards"}),n.startTime=t}catch{continue}}function eo(s,t,e){return s.pending&&s.startTime===null?!0:e&&t!==null&&typeof s.startTime=="number"&&Math.abs(s.startTime-t)<.5}function Nl(s,t,e){return t===null||!Number.isFinite(t)||t>s||!(e>0)?s:t+Math.ceil((s-t)/e)*e}function no(s,t){const{offsetWidth:e=0,offsetHeight:n=0}=s;if(!(e>0&&n>0))return null;const i=s.getBoundingClientRect();return{x:i.left+i.width/e*t.originX,y:i.top+i.height/n*t.originY}}const Il=12,Tl=2;function so(){var s;return typeof((s=document.timeline)===null||s===void 0?void 0:s.currentTime)=="number"?document.timeline.currentTime:null}class Ll{constructor(t){this.host=t,this.planned=new WeakSet,this.announced=new Map,this.watched=new WeakSet,this.delayed=new WeakSet,this.roots=null,this.due=!0,this.listed=[],this.scriptedSeen=-1,this.frameAnimations=null,this.paused=new Set,this.starting=null,this.session=0,this.held=new WeakSet,this.sentStarts=new WeakMap,this.applyLatencies=[],this.fresh=new Set,this.timeline=null,this.listeners=[["transitionrun",e=>this.onTransitionRun(e)],["transitionend",e=>this.onTransitionEnd(e)],["transitioncancel",e=>this.onTransitionEnd(e)],["animationstart",e=>this.onAnimationStart(e)],["animationend",e=>this.onAnimationEnd(e)],["animationcancel",e=>this.onAnimationEnd(e)]]}markDue(){this.due=!0}forgetRoots(){this.roots=null}listFrame(t){this.due||Tt.unwatched||this.scriptedSeen!==Tt.count?(this.due=!1,this.scriptedSeen=Tt.count,this.listed=this.running()):this.listed=this.listed.filter(n=>this.isRunning(n)),this.frameAnimations=this.listed;const e=[];for(const n of this.listed)if(!this.planned.has(n)){if(t&&!this.mayReachIsland(n)){this.planned.add(n);continue}e.push(n)}return this.holdStarting(e),e}endFrame(){this.frameAnimations=null}mayReachIsland(t){var e,n;const i=(n=(e=t.effect)===null||e===void 0?void 0:e.target)!==null&&n!==void 0?n:null;return!i||this.host.mayReachIsland(i)}collect(){var t,e;const n=[];for(const i of(t=this.frameAnimations)!==null&&t!==void 0?t:this.running()){if(this.waitingOutDelay(i))continue;const o=qn(i),r=Ye(i);if(!r||o==="none")continue;this.watchEnd(i);const a=!!(!((e=i.effect)===null||e===void 0)&&e.pseudoElement);n.push({target:r,impact:o,animation:i,pseudo:a})}for(const[i,o]of this.announced)for(const[r,a]of o)n.push({target:i,impact:a,key:r});return n}pruneDetached(){for(const t of this.announced.keys())t.isConnected||this.announced.delete(t)}get busy(){return this.paused.size>0||this.starting!==null}get preparing(){return this.paused.size>0&&this.starting!==null}beginPlan(t){var e;this.fresh=new Set(t),this.timeline=so();const n=new Set(this.paused);for(const i of(e=this.frameAnimations)!==null&&e!==void 0?e:[])this.planned.add(i);return n}holdStarting(t){const e=so();for(const n of t)eo(n,e,!0)&&this.hold(n)}startWithPlan(t){return this.preparing?this.starting:(this.start(t),null)}hold(t){var e,n,i;const o=(e=t.effect)===null||e===void 0?void 0:e.target;if(this.host.scriptTranslated()||!this.host.motionStartsAtCommit()||this.paused.has(t)||this.held.has(t)||!o||!this.host.natives.some(d=>_(o,d.el)))return;const r=Array.from(new Set([t,...(i=(n=o.getAnimations)===null||n===void 0?void 0:n.call(o,{subtree:!0}))!==null&&i!==void 0?i:[]])).filter(d=>{var h;return((h=d.effect)===null||h===void 0?void 0:h.target)===o||Ye(d)===o}),a=to(o,r.filter(d=>{var h;return!(!((h=d.effect)===null||h===void 0)&&h.pseudoElement)&&(d.playState==="running"||d.pending)}));if(!a||a.some(d=>d.payload.delay!==0||d.payload.playbackRate<=0))return;const c=t.startTime,l=this.session,u=new Set;for(const d of r)this.held.has(d)||d.startTime!==c||d.playState!=="running"&&!d.pending||(d.pause(),d.currentTime=0,this.paused.add(d),this.held.add(d),u.add(d));hi().then(()=>{var d;l===this.session&&Array.from(u).some(h=>this.paused.has(h))&&(!((d=this.starting)===null||d===void 0)&&d.animations.has(t)?this.start(0):this.release(u))})}waitsFor(t){return this.starting===t&&Array.from(t.animations).some(e=>this.paused.has(e)&&e.playState==="paused")}startHeld(t){this.starting===t&&this.start(0)}start(t){const e=this.starting;if(this.starting=null,!e){this.release();return}this.release(e.animations);const n=this.host.motionStartsAtCommit(),i=performance.now()+t+this.lead(),o=n?performance.now():xe(Nl(i,this.host.clock.lastFrameTime,this.host.clock.interval));n||El(e.animations,o);for(const r of e.entries){const a=r.animation.startTime;r.payload.startTime=this.sentStart(r.animation,typeof a=="number"?a:o)}}release(t=this.paused){for(const e of t)this.paused.delete(e)&&e.playState==="paused"&&e.play()}reset(){this.release(),this.session+=1,this.held=new WeakSet,this.applyLatencies=[]}noteApplyLatency(t){!Number.isFinite(t)||t<0||(this.applyLatencies.push(t),this.applyLatencies.length>Il&&this.applyLatencies.shift())}payloads(t,e,n){var i,o;const r=Array.from(e).flatMap(u=>{var d;return(d=t.entries.get(u))!==null&&d!==void 0?d:[]}),a=u=>this.paused.has(u)||eo(u,this.timeline,this.fresh.has(u)),c=r.filter(u=>a(u.animation));if(this.starting=null,c.length>0&&this.host.motionStartsAtCommit()&&this.paused.size===0)for(const u of c){const d=u.animation.startTime;u.payload.startTime=typeof d=="number"?d:(i=this.timeline)!==null&&i!==void 0?i:u.payload.startTime}else c.length>0&&(this.starting={entries:c,animations:new Set([...c.map(u=>u.animation),...n.flatMap(u=>u.animation&&a(u.animation)?[u.animation]:[])])});const l=new Set((o=this.starting)===null||o===void 0?void 0:o.entries);for(const u of r)l.has(u)||(u.payload.startTime=this.sentStart(u.animation,u.payload.startTime));return Array.from(e,u=>{var d;return{id:t.idFor(u),animations:((d=t.entries.get(u))!==null&&d!==void 0?d:[]).map(h=>h.payload)}})}sentStart(t,e){const n=typeof t.startTime=="number"?t.startTime:null,i=this.sentStarts.get(t);return i&&(i.own===n||i.own===null&&i.guessed)?(i.own=n,i.sent):(this.sentStarts.set(t,{sent:e,own:n,guessed:n===null&&t.playState!=="paused"}),e)}lead(){const t=this.host.clock.interval;if(this.applyLatencies.length===0)return t;const e=[...this.applyLatencies].sort((n,i)=>i-n);return Math.min(e[Math.min(2,e.length-1)],Tl*t)}isRunning(t){return t.playState==="running"||t.pending||this.paused.has(t)}running(){const t=new Set,e=i=>{this.isRunning(i)&&t.add(i)},n=document.getAnimations;if(typeof n=="function")for(const i of Array.from(n.call(document)))e(i);for(const i of this.shadowRootsHolding()){const o=i.getAnimations;if(typeof o=="function")for(const r of Array.from(o.call(i)))e(r)}return Array.from(t)}shadowRootsHolding(){if(this.roots)return this.roots;const t=new Set;for(const e of[...this.host.natives,...this.host.layers]){let n=e.el;for(;n;){const i=n.getRootNode();i instanceof ShadowRoot&&t.add(i),n=M(n)}}return this.roots=[...t],this.roots}waitingOutDelay(t){var e;const n=t.effect;if(!n||t.playState!=="running"||typeof n.getComputedTiming!="function")return!1;const i=n.getComputedTiming(),o=i.localTime,r=(e=i.delay)!==null&&e!==void 0?e:0;return i.progress!==null||typeof o!="number"||o>=r||t.playbackRate<=0?!1:(this.delayed.has(t)||(this.delayed.add(t),window.setTimeout(()=>{this.delayed.delete(t),this.host.refresh()},(r-o)/t.playbackRate)),!0)}watchEnd(t){if(this.watched.has(t))return;this.watched.add(t);const e=()=>{this.endsUnseen(Ye(t),qn(t))||this.host.refresh()};t.finished.then(e,e)}endsUnseen(t,e){return!t||e===void 0||e==="global-layout"?!1:!this.host.mayReachIsland(t)}begin(t,e,n,i){var o;if(this.due=!0,!(t instanceof Element)||n==="none")return;i&&!this.planned.has(i)&&this.hold(i);const r=(o=this.announced.get(t))!==null&&o!==void 0?o:new Map;r.set(e,n),this.announced.set(t,r),(!i||!this.planned.has(i))&&this.host.refresh()}end(t,e){if(this.due=!0,!(t instanceof Element))return;const n=this.announced.get(t),i=n?.get(e);n&&(n.delete(e),n.size===0&&this.announced.delete(t)),!this.endsUnseen(t,i)&&this.host.refresh()}onTransitionRun(t){if(!(t instanceof TransitionEvent))return;const e=t.target,n=e instanceof Element?e.getAnimations:void 0,i=typeof n=="function"?Array.from(n.call(e)).find(o=>Ct(o)===t.propertyName):void 0;this.begin(e,`transition:${t.propertyName}`,Ci(e,t.propertyName),i)}onTransitionEnd(t){t instanceof TransitionEvent&&this.end(t.target,`transition:${t.propertyName}`)}onAnimationStart(t){if(!(t instanceof AnimationEvent)||!(t.target instanceof Element))return;const e=t.target,n=e.getAnimations,i=typeof n=="function"?Array.from(n.call(e,{subtree:!0})).find(o=>{var r;const a=o.effect;return a?.target===e&&((r=a.pseudoElement)!==null&&r!==void 0?r:"")===t.pseudoElement&&o.animationName===t.animationName&&this.isRunning(o)}):void 0;this.begin(e,`animation:${t.animationName}`,i?qn(i):"global-layout",i)}onAnimationEnd(t){t instanceof AnimationEvent&&this.end(t.target,`animation:${t.animationName}`)}}const io=["background-color","background-image","background-size","background-position","background-repeat","background-origin","background-clip","background-attachment","background-blend-mode"],Fl={color:"transparent",image:"none",size:"auto",position:"0% 0%",repeat:"repeat",origin:"padding-box",clip:"border-box",attachment:"scroll",blendMode:"normal",borderWidths:["0px","0px","0px","0px"]};function Xn(s){const t=k(s);return JSON.stringify([s.style.cssText,..._s.map(e=>t.getPropertyValue(e))])}function oo(s){var t;const{rect:e,holes:n,unionMask:i,attachment:o,source:r}=s,a=S(e.w),c=S(e.h),l=o==="local"?"padding-box":"border-box",u=new Map([["background-color","transparent"],["background-repeat","no-repeat"],["background-origin",l],["background-clip",l],["background-attachment",o],["background-blend-mode","normal"]]);if(r.image==="none"&&!i){const p=[],y=[],w=[];for(const g of hr(e,n))p.push(`linear-gradient(${r.color}, ${r.color})`),y.push(`${S(g.w)}px ${S(g.h)}px`),w.push(`${S(g.x-e.x)}px ${S(g.y-e.y)}px`);for(const g of n){const[v,x,m,b]=Ot((t=g.r)!==null&&t!==void 0?t:D,g.w,g.h),A=S(g.x-e.x),R=S(g.y-e.y);for(const[C,P,E,q]of[[v,"100% 100%",A,R],[x,"0% 100%",S(A+g.w-x),R],[b,"100% 0%",A,S(R+g.h-b)],[m,"0% 0%",S(A+g.w-m),S(R+g.h-m)]])C<=0||(p.push(`radial-gradient(circle at ${P}, transparent ${C}px, ${r.color} ${C}px)`),y.push(`${C}px ${C}px`),w.push(`${E}px ${q}px`))}return p.length>512?null:(u.set("background-image",p.length>0?p.join(", "):"none"),u.set("background-size",y.length>0?y.join(", "):"auto"),u.set("background-position",w.length>0?w.join(", "):"0px 0px"),u)}const d=p=>p.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),h=d(xs(e,n)),f=[`<svg xmlns="http://www.w3.org/2000/svg" width="${a}" height="${c}"`,` viewBox="0 0 ${a} ${c}" preserveAspectRatio="none">`,i?Cs(e,n):`<mask id="ni-knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="${a}" height="${c}"><path fill="white" fill-rule="evenodd" d="${h}"/></mask>`,r.image==="none"?`<rect width="${a}" height="${c}" fill="${d(r.color)}" mask="url(#ni-knockout)"/>`:`<foreignObject width="${a}" height="${c}" mask="url(#ni-knockout)"><div xmlns="http://www.w3.org/1999/xhtml" style="${d(["box-sizing:border-box",`width:${a}px`,`height:${c}px`,"border-style:solid","border-color:transparent",`border-width:${r.borderWidths.join(" ")}`,`background-color:${r.color}`,`background-image:${r.image}`,`background-size:${r.size}`,`background-position:${r.position}`,`background-repeat:${r.repeat}`,`background-origin:${r.origin}`,`background-clip:${r.clip}`,`background-attachment:${r.attachment}`,`background-blend-mode:${r.blendMode}`].join(";"))}"></div></foreignObject>`,"</svg>"].join("");return u.set("background-image",`url("data:image/svg+xml,${encodeURIComponent(f)}")`),u.set("background-size",`${a}px ${c}px`),u.set("background-position","0px 0px"),u}function ro(s,[t,e]){if(t===1&&e===1)return s;const{rect:n}=s,i=o=>Object.assign({x:S(n.x+(o.x-n.x)/t),y:S(n.y+(o.y-n.y)/e),w:S(o.w/t),h:S(o.h/e)},o.r&&{r:Rs(o.r,1/t)});return Object.assign(Object.assign({},s),{rect:i(n),holes:s.holes.map(i)})}function jl(s){const t=s.rect;return s.kind==="mask"?new Map([["mask-image",`url("data:image/svg+xml,${encodeURIComponent(pr(t,s.holes))}")`],["mask-size","100% 100%"],["mask-position","0px 0px"],["mask-repeat","no-repeat"],["mask-mode","alpha"],["mask-composite","add"],["mask-clip","border-box"],["mask-origin","border-box"]]):new Map([["clip-path",s.holes.some(e=>ct(e,t))?"inset(50%)":fr(t,s.holes)]])}function tn(s){return s.some((t,e)=>s.slice(e+1).some(n=>H(t,n)&&(kt(t)||kt(n))))}function ao(s){return s.el===document.documentElement||s.el===document.body&&Sn()?!0:s.scrollPath.length===0&&lt(s.visualRect,we(s.coordinateSpace))}const Gn={reason:"web layers in a sticky box native cannot follow cannot use native cutouts",mayMoveWithoutRefresh:!0};function lo(s,t){const e=s.x<=t.x&&s.x+s.w>=t.x+t.w,n=s.y<=t.y&&s.y+s.h>=t.y+t.h;return e&&(s.y<=t.y||s.y+s.h>=t.y+t.h)||n&&(s.x<=t.x||s.x+s.w>=t.x+t.w)}const Kn=s=>!!(s.handle.requiresUnobscuredSurface&&s.handle.supportsProtectedSurfaceClip),L=(s,t)=>{const e=St(s.el,t.el);return e!==0?e>0:s.z!==t.z?s.z>t.z:s.dom>t.dom},Jn=s=>{const t=k(s.el);return t.visibility==="visible"&&t.pointerEvents!=="none"&&li(s.el)===null},Zn=(s,t)=>(s??[]).some(e=>!_(e,t.el));function en(s,t){return Zn(s.movers,t)}function nn(s,t){return Zn(s.animators,t)}function Qn(s,t){return Zn(s.cutAnimators,t)}function ce(s,t){return en(s,t)?Object.assign(Object.assign({},s),{paintEscapesRect:!0,escapesByMoving:!s.paintEscapesRect}):s}function Ht(s,t){return wt(ce(s,t),ce(t,s))}const co=["Top","Right","Bottom","Left"];function Wl(s){const t=k(s),e=i=>{var o;return((o=Y(i))!==null&&o!==void 0?o:1)>0},n=co.some(i=>Number.parseFloat(t[`border${i}Width`])>0&&t[`border${i}Style`]!=="none"&&e(t[`border${i}Color`]));return e(t.backgroundColor)||zt(t)||n||t.boxShadow!==""&&t.boxShadow!=="none"||oe(t)||We(s,!0)}function Bl(s,t,e,n){let i=256;const o=r=>{const a=!n.has(r)&&Wl(r);if(--i<0||a||ui(r,e))return!0;let c=!1;for(const l of Array.from(r.children))if(l===t)c=!0;else if(_(l,t)){if(c=!0,o(l))return!0}else if($(l)&&H(nt(l),e))return!0;return!c};return o(s)}function $l(s,t){const e=k(s),n=nt(s),i=Xt(e);if(!co.some((u,d)=>e[`border${u}Style`]!=="none"&&!Ls(e[`border${u}Color`])&&i[d]>0))return!0;const[r,a,c,l]=i;return lt({x:n.x+l,y:n.y+r,w:Math.max(0,n.w-l-a),h:Math.max(0,n.h-r-c)},t)}const ql="overlapping native islands from different scroll containers are unsupported",ts="partially overlapping complex opaque regions require native path boolean support";function zl(s){const{rect:t,paintRect:e,coordinateSpace:n,scrollPath:i}=s;if(n!=="document"||i.length===0||!t||!e)return s;const o=Fn(i),r=Object.assign(Object.assign({},e),{x:S(t.x-o.x),y:S(t.y-o.y)});return Object.assign(Object.assign({},s),{paintRect:r,visualRect:jn(r,i)})}function uo(s){return s.active&&s.rect!==null&&s.visualRect!==null}function Rt(s){return s.active&&s.rect!==null&&s.paintRect!==null}function rt(s,t){return s.filter(e=>Rt(e)&&(t===void 0||e.plane===t))}function Dl(s,t){return dr(s.visualRect,t.visualRect)&&(kt(s.rect)||kt(t.rect))}function ho(s,t){return kt(s.rect)&&lt(s.visualRect,t.visualRect)&&!ct(s.visualRect,t.visualRect)}function Hl(s,t){return Dl(s,t)||ho(s,t)||ho(t,s)?ts:null}function Vl(s,t){return s.plane==="overlay"&&t.plane==="overlay"?!0:s.plane===t.plane?!1:s.plane==="overlay"?L(s,t):L(t,s)}function Ul(s,t){return!H(s.visualRect,t.visualRect)||Vl(s,t)||s.plane==="underlay"&&t.plane==="underlay"&&At(s,t)?null:st(s,t)?Hl(s,t):ql}function fo(s,t){const e=It(s.scrollPath);if(!e||!(t.el===e||_(t.el,e)))return!1;const n=Q(e);return s.coordinateSpace===n.coordinateSpace&&Tn(s.scrollPath.slice(0,-1),n.scrollPath)&&yi(t,n)}function Yl(s,t,e){var n,i;return s.cutoutIssue===null&&!s.translucentFill&&((i=(n=s.animators)===null||n===void 0?void 0:n.length)!==null&&i!==void 0?i:0)===0&&$(s.el)&&L(s,t)&&ct(s.visualRect,e)}function Xl(s,t){return s.rect.w*s.rect.h<=t.rect.w*t.rect.h?s:t}function ue(s,t){s.inactiveReason=t,s.active=!1,s.rect=null,s.visualRect=null}function de(s,t){if(t.cutoutIssue!==null)return[];const e=[];for(const n of rt(s,"underlay")){if(st(n,t)){H(n.rect,t.rect)&&L(n,t)&&e.push({native:n,hole:n.rect});continue}const i=n.visualRect;if(i===null||!H(i,t.visualRect)||!L(n,t))continue;const o=t.coordinateSpace==="viewport"?Object.assign(Object.assign({},i),{x:i.x-window.scrollX,y:i.y-window.scrollY}):i;e.push({native:n,hole:Object.assign(Object.assign({},yt(o,t.scrollPath)),{r:n.rect.r})})}return e}function po(s,t){return ft(s.el)&&!_(s.el,t)&&qe(s.el,s.scrollPath,{allowViewportPosition:s.coordinateSpace==="viewport"})===null}const Gl=8,mo="authored mask properties override native knockout geometry",go="the page background cannot be separated from its web content";function Kl(s){var t,e;const n=((t=s.transitionProperty)!==null&&t!==void 0?t:"").split(",").map(o=>o.trim()),i=((e=s.transitionDuration)!==null&&e!==void 0?e:"").split(",").map(o=>parseFloat(o)||0);return n.some((o,r)=>{var a;return(o==="all"||o.startsWith("background"))&&((a=i[r%i.length])!==null&&a!==void 0?a:0)>0})}function vo(s){var t,e,n;for(const i of(e=(t=s.getAnimations)===null||t===void 0?void 0:t.call(s))!==null&&e!==void 0?e:[])!((n=Ct(i))===null||n===void 0)&&n.startsWith("background")&&i.finish()}const sn="data-ni-runtime-clip",es="data-ni-runtime-background";function bo(s,t){return new Map(Array.from(t,e=>[e,s.style.getPropertyValue(e)]))}function yo(s,t){return new Map(Array.from(t,e=>[e,{value:s.style.getPropertyValue(e),priority:s.style.getPropertyPriority(e)}]))}function ns(s,t,e){return s.style.getPropertyValue(t)===e&&s.style.getPropertyPriority(t)===""}function wo(s,t){let e=!1;for(const[n,i]of t)ns(s,n,i)||(s.style.setProperty(n,i),e=!0);return e}function So(s,t,e,n){return t==="style"?!Array.from(e.applied).every(([i,o])=>ns(s,i,o)):t===n?!s.hasAttribute(n):null}class Jl{constructor(){this.styles=new WeakMap,this.attributes=new WeakMap}wrote(t,e){if(e==="style")return this.styles.get(t)===t.style.cssText;const n=this.attributes.get(t);return e!==null&&n?.has(e)===!0&&n.get(e)===t.getAttribute(e)}attribute(t,e){let n=this.attributes.get(t);n||this.attributes.set(t,n=new Map),n.set(e,t.getAttribute(e))}style(t){this.styles.set(t,t.style.cssText)}}class Zl{constructor(t){this.host=t,this.clips=new Map,this.backgrounds=new Map,this.desired=new Map,this.panes=new Map,this.ownScrollerPaint=new Map,this.rejectedMasks=new Map,this.rejectedBackgrounds=new Set,this.sourcesDirty=!1,this.anchoredHoles=[]}get paneColors(){return this.panes}get scrollerPaint(){return this.ownScrollerPaint}backgroundSource(t){var e;return(e=this.backgrounds.get(t))===null||e===void 0?void 0:e.source}ownsClip(t){return this.clips.has(t)}pageChanged(){this.rejectedMasks.clear(),this.rejectedBackgrounds.clear()}forgetMask(t){this.rejectedMasks.delete(t)}restyled(t,e=!1){var n;if(!t){this.pageChanged(),this.sourcesDirty=this.backgrounds.size>0;return}for(const i of this.backgrounds.keys())(i===t||!e&&(!((n=t.contains)===null||n===void 0)&&n.call(t,i)))&&(this.sourcesDirty=!0)}releaseStaleBackgrounds(){this.sourcesDirty&&this.releaseBackgrounds()}apply(t,e,n,i=[],o=new Map){for(let r=1;;r++){const{paint:a,held:c}=this.desirePaint(t,e,n,i,o);if(this.reconcile(a)||r===Gl)return c}}desirePaint(t,e,n,i,o){var r;const a=[...e,...i],c=new Set(a.map(l=>l.el));for(const l of this.rejectedMasks.keys())c.has(l)||this.rejectedMasks.delete(l);for(const[l,u]of this.clips)u.kind==="mask"&&!Me(l,k(l))&&this.rejectedMasks.set(l,Xn(l));for(;;){let l=!1;const u=(g,v)=>{!g.active||g.holding||(ue(g,v),l=!0)},d=new Map,h=new Map,f=g=>{let v=d.get(g);return v||d.set(g,v={}),v},p=(g,v)=>!this.rejectedBackgrounds.has(g)&&oo(v)!==null;let y=new Set;if(n&&t.some(g=>g.active&&g.plane==="underlay")){const g=e.filter(v=>n.elements.has(v.el)).flatMap(({el:v,rect:x,backgroundPaint:m})=>m===null?[]:[{el:v,rect:x,backgroundPaint:m}]).map(v=>({el:v.el,background:{rect:v.rect,holes:[v.rect],unionMask:!1,attachment:"scroll",source:v.backgroundPaint,anchored:!1}}));if(g.every(({el:v,background:x})=>p(v,x))){for(const{el:v,background:x}of g)f(v).background=x;y=n.elements}}for(const g of e){if(y.has(g.el)||!this.maskRejected(g.el))continue;const v=de(t,g);if(tn(v.map(x=>x.hole)))for(const{native:x}of v)u(x,mo)}const w=this.host.compositionEnabled?re(()=>this.planScrollingHoles(t.filter(g=>!g.holding||g.heldInPlace),e,y)):{scrollports:new Map,backgrounds:new Map};for(const g of a){if(y.has(g.el))continue;const v=o.get(g.el),x=v?.state==="covered",m=v&&!x?v.islands:[];if(w.backgrounds.has(g.el)&&m.length===0)continue;const b=de(m,Object.assign(Object.assign({},g),{cutoutIssue:null})),A=[...de(t,g).filter(({native:O})=>(O.holding||At(O,g))&&!m.some(W=>W.handle===O.handle)),...b],R=m.length>0?b:A,C=(r=w.scrollports.get(g.el))!==null&&r!==void 0?r:[],P=this.host.compositionEnabled?x?[g.rect]:[...R.map(O=>O.hole),...m.length===0?C.map(({hole:O})=>O):[]]:[],E=tn(P),q=E?P:vn(P);if(q.length===0)continue;const G=x||m.length>0||g.backgroundPaint!==null&&C.length===0&&A.every(({native:O})=>po(g,O.handle.el)),K=m.length>0?A.filter(({native:O})=>!m.some(W=>W.handle===O.handle)):A,V=m.length>0?[...K.map(({hole:O})=>O),...C.map(({hole:O})=>O)]:q,z=m.length>0?tn(V):E;if(g.backgroundPaint&&(!G||m.length>0&&V.length>0)){const O={rect:g.rect,holes:m.length>0&&!z?vn(V):V,unionMask:z,attachment:"scroll",source:g.backgroundPaint,anchored:K.some(({native:W})=>W.holding)};if(p(g.el,O))f(g.el).background=O;else for(const W of[...K.map(({native:et})=>et),...C.flatMap(({islands:et})=>et)])u(W,go);if(!G)continue}const ot=!x&&(E||R.some(({native:O})=>!O.interactive))?"mask":"path";if(ot==="mask"&&this.maskRejected(g.el)){for(const{native:O}of R)u(O,mo);continue}f(g.el).clip={kind:ot,rect:g.rect,holes:q,anchored:!x&&R.some(({native:O})=>O.holding)},x?h.set(g.el,rt(t,"underlay").map(O=>Object.assign({},O))):m.length>0&&h.set(g.el,m)}for(const[g,{rect:v,color:x,islands:m}]of w.backgrounds){const b=this.host.capabilities.paneColor?Ne(x):null,A=m.filter(P=>P.active).map(P=>P.rect),R=!b&&tn(A),C=Object.assign({rect:v,holes:b?[v]:R?A:vn(A),unionMask:R,attachment:"local",source:Object.assign(Object.assign({},Fl),{color:x}),anchored:!1},b&&{paneColor:b});if(p(g,C))f(g).background=C;else for(const P of m)u(P,go)}if(!l)return{paint:d,held:h}}}planScrollingHoles(t,e,n){var i,o;const r={scrollports:new Map,backgrounds:new Map},a=new Map,c=l=>{l.holding||ue(l,"a hole cut in web paint cannot follow the scroller that moves this island")};for(const l of e){if(n.has(l.el))continue;const u=new Set(de(t,l).map(({native:d})=>d));if(l.cutoutIssue===null)for(const d of rt(t,"underlay"))fo(d,l)&&Ht(d,l)&&L(d,l)&&u.add(d);for(const d of u){if(At(d,l))continue;const h=It(d.scrollPath);h?a.set(h,((i=a.get(h))!==null&&i!==void 0?i:new Set).add(d)):c(d)}}for(const[l,u]of a){const d=Q(l),h=ht(l),f=h&&d.coordinateSpace==="viewport"?Se(h):h,p=Array.from(u).filter(b=>b.active),y=e.find(b=>b.el===l),w=e.filter(b=>b.el!==l&&!n.has(b.el)&&_(b.el,l)&&b.backgroundPaint!==null);let g=this.ownScrollerPaint.get(l);if(g===void 0||!this.backgrounds.has(l)){const b=k(l);g=b.backgroundImage==="none"?b.backgroundColor:null,this.ownScrollerPaint.set(l,g)}const v=f&&g!==null?Pr([...w.slice().sort((b,A)=>St(b.el,A.el)).map(b=>{var A,R;return(R=(A=b.backgroundPaint)===null||A===void 0?void 0:A.color)!==null&&R!==void 0?R:""}),g]):null;if(!(f!==null&&v!==null&&p.every(b=>b.coordinateSpace===d.coordinateSpace&&Tn(b.scrollPath.slice(0,-1),d.scrollPath))&&w.every(b=>{var A;const R=Oa(l,f,d.coordinateSpace),C=R&&yt(R,b.scrollPath);return C!==null&&((A=b.backgroundPaint)===null||A===void 0?void 0:A.image)==="none"&&yi(b,d)&&lt(b.rect,C)})&&!(y&&de(t,y).some(({native:b})=>At(b,y)))&&!e.some(b=>b.el!==l&&!_(b.el,l)&&!_(l,b.el)&&St(b.el,l)<0&&$(b.el)&&h!==null&&H(b.visualRect,h)))){for(const b of p)c(b);continue}for(const b of w){const A=Object.assign(Object.assign({},yt(f,b.scrollPath)),{r:f.r});r.scrollports.set(b.el,[...(o=r.scrollports.get(b.el))!==null&&o!==void 0?o:[],{hole:A,islands:p}])}const m=yt(f,d.scrollPath);r.backgrounds.set(l,{rect:{x:m.x,y:m.y,w:S(l.scrollWidth),h:S(l.scrollHeight)},color:v,islands:p})}return r}noteAuthorChange(t,e,n){var i;const o=this.clips.get(t);o&&((i=So(t,e,o,sn))!==null&&i!==void 0?i:n)&&this.releaseClip(t);const r=this.backgrounds.get(t);if(!r)return;const a=So(t,e,r,es);a===null?this.sourcesDirty=!0:a&&this.releaseBackground(t)}release(){this.anchoredHoles=[];for(const t of this.clips.keys())this.releaseClip(t);this.releaseBackgrounds(),this.desired=new Map}mark(t,e){return t.hasAttribute(e)?!1:(t.setAttribute(e,""),this.host.writes.attribute(t,e),!0)}giveBack(t,e,n){for(const[i,o]of e.applied){if(!ns(t,i,o))continue;const r=e.original.get(i);r?.value?t.style.setProperty(i,r.value,r.priority):t.style.removeProperty(i)}t.hasAttribute(n)&&(t.removeAttribute(n),this.host.writes.attribute(t,n)),this.host.writes.style(t)}releaseClip(t){const e=this.clips.get(t);e&&(this.giveBack(t,e,sn),this.clips.delete(t),Dt())}releaseBackground(t){this.ownScrollerPaint.delete(t),this.panes.delete(t);const e=this.backgrounds.get(t);e&&(this.giveBack(t,e,es),e.transitions&&vo(t),this.backgrounds.delete(t))}releaseBackgrounds(){for(const t of this.backgrounds.keys())this.releaseBackground(t);this.sourcesDirty=!1}writeBackground(t,e){let n=this.backgrounds.get(t);n||(n={original:yo(t,io),applied:new Map,source:e.source,transitions:Kl(k(t))},this.backgrounds.set(t,n));const i=oo(ro(e,this.host.drawnAt(t)));if(!i)return!1;let o=wo(t,i);if(n.applied=bo(t,io),this.mark(t,es)&&(o=!0),this.host.writes.style(t),!o&&n.verified)return!0;n.verified=!1,n.transitions&&vo(t);const r=k(t),a=i.get("background-image");return Ls(r.backgroundColor)&&(a==="none"?r.backgroundImage==="none":zt(r))?(n.verified=!0,!0):(this.releaseBackground(t),this.rejectedBackgrounds.add(t),!1)}writeClip(t,e){const n=jl(ro(e,this.host.drawnAt(t)));let i=this.clips.get(t);return i||(i={kind:e.kind,original:yo(t,n.keys()),applied:new Map},this.clips.set(t,i)),wo(t,n)&&Dt(),i.applied=bo(t,n.keys()),this.mark(t,sn),this.host.writes.style(t),e.kind==="mask"&&!Me(t,k(t))?(this.releaseClip(t),this.rejectedMasks.set(t,Xn(t)),!1):!0}followAnchoredHoles(){for(const t of this.anchoredHoles){const{el:e,channel:n}=t,i=this.desired.get(e),o=n==="clip"?this.clips.get(e):this.backgrounds.get(e);if(!e.isConnected||!i?.[n]||!o)continue;const r=nt(e);Math.abs(r.x-t.rect.x)<.25&&Math.abs(r.y-t.rect.y)<.25||(t.rect=Object.assign(Object.assign({},t.rect),{x:r.x,y:r.y}),n==="clip"&&i.clip&&this.writeClip(e,Object.assign(Object.assign({},i.clip),{rect:t.rect})),n==="background"&&i.background&&this.writeBackground(e,Object.assign(Object.assign({},i.background),{rect:t.rect})))}}maskRejected(t){const e=this.rejectedMasks.get(t);return e===void 0?!1:e===Xn(t)?!0:(this.rejectedMasks.delete(t),!1)}reconcile(t){var e,n,i;let o=!0;for(const[r,a]of this.clips){if(((n=(e=t.get(r))===null||e===void 0?void 0:e.clip)===null||n===void 0?void 0:n.kind)===a.kind)continue;const c=ft(r);this.releaseClip(r),ft(r)!==c&&(o=!1)}for(const r of this.backgrounds.keys())!((i=t.get(r))===null||i===void 0)&&i.background||this.releaseBackground(r);for(const[r,{clip:a,background:c}]of t){if(c&&!this.writeBackground(r,c)&&(o=!1),!a)continue;const l=this.clips.has(r)?null:ft(r);this.writeClip(r,a)?l!==null&&ft(r)!==l&&(o=!1):o=!1}return this.remember(t),o}remember(t){this.desired=new Map(t),this.anchoredHoles=[],this.panes.clear();for(const[e,{clip:n,background:i}]of t)n?.anchored&&this.clips.has(e)&&this.anchoredHoles.push({el:e,channel:"clip",rect:n.rect}),!(!i||!this.backgrounds.has(e))&&(i.anchored&&this.anchoredHoles.push({el:e,channel:"background",rect:i.rect}),i.paneColor&&this.panes.set(e,i.paneColor))}}function Ql(s,t,e){const{el:n}=s,{motion:i}=e,o=s.canAttemptNative(),r=o&&$(n),a=o?Z(n):null,c=Q(n,r?gi(n):[]),{coordinateSpace:l}=c,u=r?Fe(n):dt,d=a?.position==="sticky"?a.element:null,h=d?e.stickyMotion(d,c):null,f=!js(u)||d!==null||s.requiresUnobscuredSurface===!0||e.refusedUnderlays.has(n)||r&&Kr(n),p=l==="viewport"||f?"overlay":"underlay",y=e.innerScrollMode==="unsupported"?[]:c.scrollPath,w=r?Jr(n,y):null,g=e.backdrops.filter(({dialog:E})=>!_(E,n)).flatMap(({color:E})=>E&&E[3]>0?[E]:[]),v=g.some(E=>E[3]>=1)||ec(n);let x=tc(s,e),m=r&&x===null&&!w?.transparent&&!v;const b=m?nc(c.scrollPath,e.innerScrollMode):null;b!==null&&(m=!1,x=b);const A=m?c.scrollPath:[],R=m?ic(s,{coordinateSpace:l,scrollPath:A},u):{rect:null,visualRect:null,paintRect:null,placed:!1,issue:null};m&&!R.placed&&(m=!1,x=R.issue);const C=m&&w?w.clips.map(E=>sc(E,e)):[],P=m&&w?[...w.approximations]:[];return m&&d&&!h&&P.push("unfollowed-sticky"),m&&ur(k(n),n.offsetWidth,n.offsetHeight)&&P.push("elliptical-corners"),Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({handle:s,el:n,z:_n(n),dom:t,active:m,interactive:s.interactive&&k(n).pointerEvents!=="none"&&li(n)===null,rect:R.rect,visualRect:R.visualRect,paintRect:h&&R.paintRect?Zt(R.paintRect,h.reach):R.paintRect,plane:p,overlayOnly:f,coordinateSpace:l,scrollPath:A,motionDependencies:new Set(A),opacity:m?Qs(n,e.fading):1},m&&R.transform?{transform:R.transform}:{}),m&&h?{sticky:h}:{}),C.length>0?{clips:C}:{}),m&&g.length>0?{backdrops:g}:{}),P.length>0?{approximations:P}:{}),{inactiveReason:x}),i.entries.size>0?{movers:i.targets(n).filter(E=>{var q;return(q=i.entries.get(E))===null||q===void 0?void 0:q.some(G=>G.payload.channel==="translate"||G.payload.channel==="scale")})}:{})}function tc(s,t){const e=t.refusedBecause(s.islandId);return e===void 0?null:`native refused this island's last layout: ${e}`}function ec(s){const t=document.fullscreenElement;return!!t&&!_(t,s)}function nc(s,t){return s.length===0?null:t==="unsupported"?"independent scroll containers are not supported by the active native transport":s.some(n=>{const i=ht(n);return!i||!ke(i)})?"the scroll container geometry cannot be represented safely by the native host":null}function sc({el:s,rect:t},e){const n=Q(s),i=n.coordinateSpace==="document"?{x:window.scrollX,y:window.scrollY}:{x:0,y:0},o=Z(s),r=o?.position==="sticky"?e.stickyMotion(o.element,n):null;return{el:s,coordinateSpace:n.coordinateSpace,scrollPath:n.scrollPath,rect:yt(Object.assign(Object.assign({},t),{x:S(t.x+i.x),y:S(t.y+i.y),w:S(t.w),h:S(t.h)}),n.scrollPath),sticky:r}}function ic(s,t,e){const{el:n}=s,i=xt(n,t),o=nt(n),r=jn(o,t.scrollPath),a=k(n),c=yn(e)?void 0:oc(n.offsetWidth,n.offsetHeight,e,i),l=c?{w:c.size[0],h:c.size[1]}:i,u=Object.assign(Object.assign({},i),{r:vs(a,l.w,l.h)}),d=(u.w<=0||u.h<=0)&&ke(Object.assign(Object.assign({},u),{w:1,h:1}));return d||!ke(u)?{rect:null,visualRect:null,paintRect:null,placed:!1,issue:d?null:"native island geometry exceeds the shared safe coordinate or size range"}:Object.assign(Object.assign({rect:u,visualRect:r,paintRect:o},c?{transform:c}:{}),{placed:!0,issue:null})}function oc(s,t,e,n){if(!(s>0&&t>0))return;const i=[[0,0],[s,0],[0,t],[s,t]].map(([d,h])=>[e[0]*d+e[2]*h,e[1]*d+e[3]*h]),o=i.map(([d])=>d),r=i.map(([,d])=>d),a=Math.max(...o)-Math.min(...o),c=Math.max(...r)-Math.min(...r),l=a>0?n.w/a:1,u=c>0?n.h/c:1;return{size:[S(s),S(t)],matrix:[N(e[0]*l),N(e[1]*u),N(e[2]*l),N(e[3]*u),S(0-Math.min(...o)*l),S(0-Math.min(...r)*u)]}}function ko(s,t){return s===void 0?{reason:"web paint above an overlay island must be opaque across its bounded box",mayMoveWithoutRefresh:!1}:t?Gn:s}class rc{constructor(t,e,n){this.host=t,this.candidates=e,this.settleWrite=n,this.stickyBoxes=new Map,this.classifications=new WeakMap,this.ownPaint=new WeakMap,this.unpainted=new WeakMap,this.layout=new WeakMap}forget(t){t?(this.classifications.delete(t),this.ownPaint.delete(t),this.unpainted.delete(t),this.layout.delete(t)):(this.classifications=new WeakMap,this.ownPaint=new WeakMap,this.unpainted=new WeakMap,this.layout=new WeakMap)}build(t=[]){var e,n;this.stickyBoxes.clear();const i=(m,b)=>t.filter(A=>b(A)&&_(A.target,m)).map(({target:A})=>A),o=m=>i(m,b=>b.impact==="local-composition"),r=m=>i(m,b=>b.impact!=="global-layout"),a=this.host.motion.gliding(),c=m=>i(m,b=>b.impact!=="global-layout"&&(b.pseudo||!a.has(b.target))),l=new Set(this.host.layers.map(m=>m.el)),u=this.host.layers.filter(m=>m.el.isConnected&&($(m.el)||this.host.motion.fadesIn(m.el))).map((m,b)=>{var A;const R=k(m.el),C=Z(m.el),P=Q(m.el),{coordinateSpace:E,scrollPath:q}=P,G=E==="viewport",K=C?.position==="sticky"?this.stickyMotion(C.element,P):null,V=nt(m.el),z=Ms(R,V.w,V.h,this.host.motion.drawnAt(m.el)),ot=qe(m.el,q,{allowViewportPosition:G}),O=m.el.children.length>0&&(z===null||ot!==null||oe(R))?(A=this.host.paint.backgroundSource(m.el))!==null&&A!==void 0?A:kn(R):null,W=Pn(m.el,It(q),G,!0,!0);return{el:m.el,z:_n(m.el),dom:b,rect:Object.assign(Object.assign({},xt(m.el,P)),{r:z??D}),visualRect:Object.assign(Object.assign({},V),{r:z??D}),paintRect:K?Zt(V,K.reach):V,sticky:K,paintEscapesRect:Cn(m.el),movers:o(m.el),animators:r(m.el),cutAnimators:c(m.el),translucentFill:Hs(m.el,this.host.motion.fades(m.el)),coordinateSpace:E,scrollPath:q,backgroundPaint:O,cutoutIssue:O!==null?qe(m.el,q,{backgroundOnly:!0,allowViewportPosition:G}):z===null?{reason:"declared opaque surfaces require a uniform pixel border-radius",mayMoveWithoutRefresh:!1}:ot,overlayCutoutIssue:ko(z===null?void 0:W,C?.position==="sticky"&&!K)}}).filter(m=>_t(m.rect));if(!this.host.compositionEnabled||this.host.natives.length===0)return u;const d=new Set(this.host.natives.map(m=>m.el)),h=this.host.paint.backgroundSource(document.documentElement)===void 0&&Sn(),f=this.host.natives.filter(m=>m.el.isConnected&&($(m.el)||this.host.motion.fadesIn(m.el))).map(m=>{const b=Q(m.el),{coordinateSpace:A,scrollPath:R}=b,C=xt(m.el,b);return{el:m.el,rect:C,visualRect:nt(m.el),paintRect:nt(m.el),paintEscapesRect:!1,movers:o(m.el),travel:this.host.motion.travel(m.el),coordinateSpace:A,scrollPath:R}});let p=u.length;const y=m=>f.some(b=>Ht(m,b)),w=new Map,g=t.map(m=>m.target),v=m=>{const{flows:b,boxed:A}=this.readLayout(m);return b&&A&&m.firstElementChild!==null&&!g.some(R=>R!==m&&_(m,R))&&this.farAway(m,o,y)&&ac(m)},x=m=>{if(!this.readLayout(m).flows||m.parentElement===null)return!1;const b=m.parentElement;let A=w.get(b);return A===void 0&&(A=x(b)||v(b),w.set(b,A)),A};for(const m of this.candidates()){if(!m.isConnected||l.has(m)||d.has(m)||x(m)||this.farAway(m,o,y)||this.paintsNothing(m)||this.settledAway(m,o,y)||On(m,d)||!($(m)||this.host.motion.fadesIn(m)))continue;const b=Z(m),A=Q(m),{coordinateSpace:R,scrollPath:C}=A,P=R==="viewport",E=(e=this.host.paint.backgroundSource(m))!==null&&e!==void 0?e:kn(k(m)),q=m===document.body||m===document.documentElement,G=m===document.documentElement||m===document.body&&h,K=E!==null&&(m.children.length>0||q)?E:null,V=It(C),z=this.classifications.get(m),ot=z?.scroller===V&&ni(z.facts)?z:void 0,O=ot?.issue;let W;if(K!==null)W=qe(m,C,{backgroundOnly:!0,allowViewportPosition:P});else if(O===void 0){const Yt=ei(()=>Pn(m,V,P));W=Yt.value,this.classifications.set(m,{scroller:V,issue:W===void 0?!1:W,facts:Yt.facts})}else W=O===!1?void 0:O;if(W===void 0)continue;const et=G?ua():nt(m),fe=G?et:xt(m,{coordinateSpace:R,scrollPath:C}),cn=b?.position==="sticky"?this.stickyMotion(b.element,A):null,Do={el:m,rect:fe,visualRect:et,paintRect:cn?Zt(et,cn.reach):et,paintEscapesRect:Cn(m),movers:o(m),travel:this.host.motion.travel(m),animators:r(m),cutAnimators:c(m),coordinateSpace:R,scrollPath:C,sticky:cn};if(!_t(fe)||!y(Do))continue;const un=this.classifications.get(m),Mt=un?.scroller===V?un:void 0;let pe=Mt?.overlay!==void 0&&ni((n=Mt.overlayFacts)!==null&&n!==void 0?n:[])?Mt.overlay:void 0;if(pe===void 0){const Yt=ei(()=>Pn(m,V,P,!0,!0));pe=Yt.value===void 0?!1:Yt.value,Mt&&(Mt.overlay=pe,Mt.overlayFacts=Yt.facts)}const au=ko(pe===!1?void 0:pe,b?.position==="sticky"&&!cn),Ft=G?D:Ms(k(m),fe.w,fe.h,this.host.motion.drawnAt(m));u.push(Object.assign(Object.assign({},Do),{el:m,z:_n(m),dom:p++,rect:Object.assign(Object.assign({},fe),{r:Ft??D}),visualRect:Object.assign(Object.assign({},et),{r:Ft??D}),translucentFill:Hs(m,this.host.motion.fades(m)),backgroundPaint:K,cutoutIssue:Ft===null?{reason:"automatically detected web surfaces require a uniform pixel border-radius",mayMoveWithoutRefresh:!1}:W,overlayCutoutIssue:au}))}return u}farAway(t,e,n){var i;if(t===document.body||t===document.documentElement||((i=Z(t))===null||i===void 0?void 0:i.position)==="sticky")return!1;const o=k(t).position;if(o!=="static"&&o!=="relative")return!1;const r=Q(t),a=xt(t,r);if(!_t(a))return!1;const c=this.reachOf(t,r,Ao(a,xo),Ao(nt(t),xo),e);return!n(c)}settledAway(t,e,n){var i;if(t===document.body||t===document.documentElement)return!1;const o=this.readOwnPaint(t);if(o.positioned||o.escapes||((i=Z(t))===null||i===void 0?void 0:i.position)==="sticky"||t.firstChild&&Us(t,o.overflowX,o.overflowY))return!1;const r=Q(t),a=xt(t,r);return _t(a)?!n(this.reachOf(t,r,a,nt(t),e)):!0}reachOf(t,e,n,i,o){return{el:t,rect:n,visualRect:i,paintRect:i,paintEscapesRect:!1,movers:o(t),travel:this.host.motion.travel(t),coordinateSpace:e.coordinateSpace,scrollPath:e.scrollPath}}paintsNothing(t){if(t===document.body||t===document.documentElement||this.host.paint.backgroundSource(t)!==void 0)return!1;let e=this.unpainted.get(t);if(e===void 0){const n=k(t);e=!Y(n.backgroundColor)&&!zt(n)&&!An(t,n),this.unpainted.set(t,e)}return e}readLayout(t){let e=this.layout.get(t);if(!e){const{position:n,display:i}=k(t);e={flows:n==="static"||n==="relative",boxed:i!=="inline"&&i!=="contents"&&i!=="none"},this.layout.set(t,e)}return e}readOwnPaint(t){let e=this.ownPaint.get(t);if(!e){const n=k(t);e={positioned:n.position==="fixed"||n.position==="sticky",escapes:Yr(t,n),overflowX:n.overflowX==="visible"&&n.display!=="inline",overflowY:n.overflowY==="visible"&&n.display!=="inline"},this.ownPaint.set(t,e)}return e}stickyMotion(t,e){const n=Q(t);if(!st(n,e))return null;let i=this.stickyBoxes.get(t);return i===void 0&&(i=this.measureStickyBox(t,n),this.stickyBoxes.set(t,i)),i&&i.scroller===It(e.scrollPath)?i:null}measureStickyBox(t,e){var n;const i=(n=Pe(t)[0])!==null&&n!==void 0?n:null,o=M(t);if(!o||i===null&&e.coordinateSpace!=="document")return null;const r=k(t),a=i?k(i):null,c=(v,x)=>{var m;return v==="auto"?void 0:/^-?[\d.]+px$/.test(v)?Number.parseFloat(v)+(Number.parseFloat((m=a?.getPropertyValue(`padding-${x}`))!==null&&m!==void 0?m:"")||0):null},l={top:c(r.top,"top"),right:c(r.right,"right"),bottom:c(r.bottom,"bottom"),left:c(r.left,"left")};if(Object.values(l).some(v=>v===null))return null;const u=xt(t,e),d=this.inFlow(t,()=>xt(t,e)),h=I(o),f=k(o),p=v=>Number.parseFloat(f.getPropertyValue(v))||0,y=o===i?{x:h.left+window.scrollX+o.clientLeft-o.scrollLeft,y:h.top+window.scrollY+o.clientTop-o.scrollTop,w:o.scrollWidth,h:o.scrollHeight}:{x:h.left+window.scrollX+p("border-left-width")+p("padding-left"),y:h.top+window.scrollY+p("border-top-width")+p("padding-top"),w:h.width-p("border-left-width")-p("border-right-width")-p("padding-left")-p("padding-right"),h:h.height-p("border-top-width")-p("border-bottom-width")-p("padding-top")-p("padding-bottom")};return{scroller:i,natural:d,bounds:(v=>({x:S(v.x),y:S(v.y),w:S(Math.max(v.w,0)),h:S(Math.max(v.h,0))}))((v=>yt(e.coordinateSpace==="viewport"?Object.assign(Object.assign({},v),{x:v.x-window.scrollX,y:v.y-window.scrollY}):v,e.scrollPath))(y)),shift:{x:S(u.x-d.x),y:S(u.y-d.y)},insets:Object.fromEntries(Object.entries(l).filter(([,v])=>v!==void 0)),reach:y}}inFlow(t,e){const n=t.hasAttribute("style"),i=new Set([t.getAttribute("style")]),o=t.style.getPropertyValue("position"),r=t.style.getPropertyPriority("position"),a=Pe(t);document.scrollingElement&&a.push(document.scrollingElement);const c=a.map(l=>[l.scrollLeft,l.scrollTop]);t.style.setProperty("position","static","important"),i.add(t.getAttribute("style"));try{return ia(()=>ds(()=>lr(e)))}finally{o?t.style.setProperty("position",o,r):t.style.removeProperty("position"),i.add(t.getAttribute("style")),!n&&t.getAttribute("style")===""&&t.removeAttribute("style"),a.forEach((l,u)=>{const[d,h]=c[u];l.scrollLeft!==d&&(l.scrollLeft=d),l.scrollTop!==h&&(l.scrollTop=h)}),this.settleWrite(t,i)}}}const xo=64;function ac(s){if(typeof document.createRange!="function")return!1;const t=document.createRange();t.selectNodeContents(s);const e=t.getBoundingClientRect();if(t.detach(),e.width===0&&e.height===0)return!0;const n=s.getBoundingClientRect();return e.left>=n.left-1&&e.top>=n.top-1&&e.right<=n.right+1&&e.bottom<=n.bottom+1}function Ao(s,t){return{x:s.x-t,y:s.y-t,w:s.w+t*2,h:s.h+t*2}}function lc(s,t,e,n,i){const o=new cc(s,t,e,n,i),r={cutouts:{},exclusions:{},tints:{}};for(const a of s){if(!a.active||!a.rect)continue;const c=a.handle.islandId;if(r.cutouts[c]=[],r.exclusions[c]=[],!Rt(a))continue;e.scrollers=a.motionDependencies;const l=o.island(a);if(a.plane==="overlay"){r.cutouts[c]=l.overlayCutouts();const u=l.tints();u.length>0&&(r.tints[c]=u)}if(r.exclusions[c]=l.exclusions(),a.handle.requiresUnobscuredSurface){const u=new Set(r.cutouts[c].map(d=>JSON.stringify(d)));r.cutouts[c].push(...r.exclusions[c].filter(d=>!u.has(JSON.stringify(d))))}}return e.scrollers=null,r}class cc{constructor(t,e,n,i,o){this.natives=t,this.layers=e,this.writer=n,this.planes=i,this.motion=o,this.tintColors=new Map,this.fading=o.fading()}island(t){return new uc(this,t)}leading(){var t;return(t=this.leadingLayers)!==null&&t!==void 0?t:this.leadingLayers=this.layers.map(e=>{const{lead:n}=e;if(!n)return e;const i=o=>Zt(o,Object.assign(Object.assign({},o),{x:o.x+n.x,y:o.y+n.y}));return Object.assign(Object.assign({},e),{rect:i(e.rect),visualRect:i(e.visualRect),paintRect:i(e.paintRect)})})}tinting(){var t;return(t=this.tintLayers)!==null&&t!==void 0?t:this.tintLayers=this.layers.filter(e=>(e.translucentFill||!!this.planes.gradientTint(e))&&($(e.el)||this.motion.fadesIn(e.el)))}touchable(){var t;return(t=this.touchableLayers)!==null&&t!==void 0?t:this.touchableLayers=this.layers.filter(Jn)}tintColor(t){var e,n,i;if(this.tintColors.has(t))return(e=this.tintColors.get(t))!==null&&e!==void 0?e:null;const o=(i=(n=this.planes.gradientTint(t))===null||n===void 0?void 0:n.color)!==null&&i!==void 0?i:ee(k(t.el).backgroundColor),r=o?xe(o[3]*Qs(t.el,this.fading)):0,a=o&&r>0?[...o.slice(0,3).map(Math.round),r]:null;return this.tintColors.set(t,a),a}moving(t,e){return this.motion.entries.size>0?ce(t,e):t}}class uc{constructor(t,e){this.plan=t,this.native=e,this.reach=new Map}reachesAbove(t){const e=this.reach.get(t);if(e!==void 0)return e;const{native:n,plan:i}=this,o=wt(i.moving(t,n),i.moving(n,t))&&L(t,n);return this.reach.set(t,o),o}protectedRegions(t){const{native:e,plan:n}=this;if(en(t,e)&&!t.translucentFill&&L(t,e)&&$(t.el)&&wt(ce(t,e),e))return[n.writer.nativeRegion(e)];if(t.translucentFill)return[];const i=n.planes.protectedWebRegion(e,t);return i?[n.writer.region(i)]:i===null&&!n.planes.protectedCoveredByAncestor(e,t,n.layers)?[n.writer.region(t)]:[]}overlayCutouts(){const{native:t,plan:e}=this;return Kn(t)?e.layers.flatMap(n=>this.protectedRegions(n)):e.leading().filter(n=>!n.translucentFill&&$(n.el)&&this.reachesAbove(n)&&(n.overlayCutoutIssue===null?n.cutoutIssue===null||!!n.sticky:!e.planes.opaqueWebCover(n,t,e.layers))).map(n=>{var i;if(!e.planes.gradientTint(n,t))return e.writer.region(n);const o=Mn(n.el,n.rect.h);if(o===null)return e.writer.region(n);const r=(i=n.rect.r)!==null&&i!==void 0?i:D;return e.writer.region(Object.assign(Object.assign({},n),{rect:Object.assign(Object.assign({},n.rect),{h:o,r:o<n.rect.h?[r[0],r[1],0,0]:r})}))})}tints(){var t;const{native:e,plan:n}=this;return e.handle.requiresUnobscuredSurface?[]:((t=e.backdrops)!==null&&t!==void 0?t:[]).map(o=>Object.assign(Object.assign({},n.writer.region({rect:{x:0,y:0,w:window.innerWidth,h:window.innerHeight},coordinateSpace:"viewport",scrollPath:[],sticky:null})),{color:[...o]})).concat(n.tinting().flatMap(o=>{if(!this.reachesAbove(o))return[];const r=n.tintColor(o);if(!r)return[];const a=n.planes.gradientTint(o,e);return!o.translucentFill&&!a?[]:[Object.assign(Object.assign(Object.assign({},n.writer.region(o)),{color:r.slice()}),a?{alphaStops:a.alphaStops}:{})]}))}exclusions(){const{native:t,plan:e}=this,n=e.touchable();let i;if(Kn(t))i=n.flatMap(o=>this.protectedRegions(o));else{const o=n.filter(r=>this.reachesAbove(r));i=o.filter(r=>r.overlayCutoutIssue!==Gn||!e.planes.opaqueWebCover(r,t,o)).map(r=>e.writer.region(r))}for(const o of e.natives)o!==t&&Rt(o)&&wt(e.moving(o,t),e.moving(t,o))&&L(o,t)&&i.push(e.writer.nativeRegion(o));return i}}function ss(s,t,e){return()=>{const n=Fn(e),i=t==="document"?{x:window.scrollX,y:window.scrollY}:{x:0,y:0};return{x:s.x-n.x-i.x,y:s.y-n.y-i.y}}}class dc{constructor(t,e){this.scrollOffsets=t,this.motion=e,this.sentMotions=new Set,this.scrollers=null,this.regions=new WeakMap,this.paths=new Map,this.origins=new Map}region(t){var e;const{coordinateSpace:n,scrollPath:i,rect:o,sticky:r,el:a}=t;for(const u of i)(e=this.scrollers)===null||e===void 0||e.add(u);const c=this.motionPath(a,ss(o,n,i));let l=this.regions.get(t);return l||(l=Object.assign({rect:r?this.unstuck(o,r):o,coordinateSpace:n,scrollPath:i.map(u=>this.scrollOffsets.idFor(u))},r&&{sticky:this.sticky(r)}),this.regions.set(t,l)),Object.assign(Object.assign(Object.assign(Object.assign({},l),{scrollPath:l.scrollPath.slice()}),l.sticky&&{sticky:Object.assign({},l.sticky)}),c)}unstuck(t,e){return Object.assign(Object.assign({},t),{x:S(t.x-e.shift.x),y:S(t.y-e.shift.y)})}sticky(t){return Object.assign(Object.assign(Object.assign({},t.scroller&&{scroller:this.scrollOffsets.idFor(t.scroller)}),{natural:t.natural,bounds:t.bounds}),t.insets)}nativeRegion(t){var e;for(const n of t.scrollPath)(e=this.scrollers)===null||e===void 0||e.add(n);return Object.assign(Object.assign({},this.motionPath(t.el,ss(t.rect,t.coordinateSpace,t.scrollPath))),{rect:t.rect,coordinateSpace:t.coordinateSpace,scrollPath:t.scrollPath.map(n=>this.scrollOffsets.idFor(n))})}motionPath(t,e){if(!t)return{};let n=this.paths.get(t);if(!n){const r=this.motion.targets(t);n={targets:r,ids:r.map(a=>this.motion.idFor(a))},this.paths.set(t,n)}for(const r of n.targets)this.sentMotions.add(r);if(n.ids.length===0)return{};const i=n.targets.map(r=>{var a,c;return!((a=this.motion.entries.get(r))===null||a===void 0)&&a.some(l=>l.payload.channel==="scale")?(this.origins.has(r)||this.origins.set(r,this.motion.sampledOrigin(r)),(c=this.origins.get(r))!==null&&c!==void 0?c:null):null});if(!e||i.every(r=>r===null))return{motionPath:n.ids.slice()};const o=e();return{motionPath:n.ids.slice(),motionOrigins:i.map(r=>r?[S(r.x-o.x),S(r.y-o.y)]:[0,0])}}}function hc(s,t,e,n,i){const{scrollOffsets:o}=i,r=s.filter(g=>g.active).sort((g,v)=>L(g,v)?1:L(v,g)?-1:0).map(g=>g.handle.islandId),a=new dc(o,i.motion),{cutouts:c,exclusions:l,tints:u}=lc(s,t,a,i.planes,i.motion),d=s.filter(g=>i.holds(g.handle)).map(g=>{const v=g.handle.portal;return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({id:g.handle.islandId,type:g.handle.type,plane:g.plane,coordinateSpace:g.coordinateSpace,scrollPath:g.scrollPath.map(x=>o.idFor(x)),motionDependencies:Array.from(g.motionDependencies,x=>o.idFor(x)),rect:g.rect&&g.sticky?a.unstuck(g.rect,g.sticky):g.rect,interactive:g.interactive,active:g.active},g.opacity<1?{opacity:S(g.opacity)}:{}),g.transform?{transform:g.transform}:{}),g.sticky?{sticky:a.sticky(g.sticky)}:{}),g.clips?{clips:g.clips.map(x=>a.region(x))}:{}),v?{portal:v}:{}),a.motionPath(g.el,g.rect?ss(g.rect,g.coordinateSpace,g.scrollPath):void 0))}),h=fc(s,a,i),f=new Set(h.map(g=>g.id)),p={},y=r.map(g=>{var v;return(v=s.find(x=>x.handle.islandId===g))===null||v===void 0?void 0:v.el});for(const[g,v]of i.paneColors){const x=o.idFor(g);if(!f.has(x))continue;const m=y.findIndex(b=>b!==void 0&&(_(g,b)||St(b,g)>0));p[x]=m<0?{color:v}:{color:v,under:r[m]}}for(const g of d)g.motionDependencies=g.motionDependencies.filter(v=>f.has(v)),!g.active&&!g.scrollPath.every(v=>f.has(v))&&(g.scrollPath=[]);const w=i.motionPayloads(a.sentMotions,e);return Object.assign(Object.assign(Object.assign(Object.assign({components:d,scrollContainers:h,order:r,cutouts:c,exclusions:l},n?{canvasColor:n}:{}),Object.keys(p).length>0?{panes:p}:{}),w.length>0?{motions:w}:{}),Object.keys(u).length>0?{tints:u}:{})}function fc(s,t,e){const{scrollOffsets:n}=e,i=l=>Array.from(new Set(s.filter(l).flatMap(u=>Array.from(u.motionDependencies))));n.sync(i(l=>l.active).filter(l=>_t(ht(l))));const o=new Set(i(l=>e.holds(l.handle)));for(const l of Array.from(o))for(const u of Q(l).scrollPath)o.add(u);const r=Array.from(o).sort((l,u)=>St(u,l)),a=new Set;for(const l of r)_t(ht(l))&&a.add(n.idFor(l));const c=[];for(const l of r){const u=ht(l);if(!_t(u))continue;const d=Q(l),h=d.coordinateSpace==="viewport"?Se(u):u,f=In(l),[p,y,w,g]=Fe(l);c.push(Object.assign(Object.assign({id:n.idFor(l),rect:yt(h,d.scrollPath),scrollPath:d.scrollPath.map(v=>n.idFor(v)).filter(v=>a.has(v)),coordinateSpace:d.coordinateSpace,contentWidth:S(l.scrollWidth),contentHeight:S(l.scrollHeight),offsetX:f.x,offsetY:f.y},yn([p,y,w,g])?{}:{linear:[p,y,w,g]}),t.motionPath(l,()=>({x:u.x-window.scrollX,y:u.y-window.scrollY}))))}return c}class pc{constructor(){this.entries=new Map,this.ids=new WeakMap,this.nextId=1}describe(t,e){var n,i,o;const r=new Map,a=new Map;for(const c of t){const l=(n=a.get(c.target))!==null&&n!==void 0?n:[];l.push(c),a.set(c.target,l)}for(const[c,l]of a){const u=Array.from(new Set(l.flatMap(p=>p.animation&&!p.pseudo?[p.animation]:[]))),d=l.flatMap(p=>p.animation?[p.animation]:[]);if(!l.every(p=>p.animation!==void 0||d.some(y=>p.key===`transition:${Ct(y)}`||p.key===`animation:${y.animationName}`))||u.length===0)continue;const f=to(c,u,e.motionStartsAtCommit,e.motionScale);if(f){if(e.motionStartsAtCommit)for(const p of f)!(!((i=p.translation)===null||i===void 0)&&i.anchored)&&!(!((o=p.scaling)===null||o===void 0)&&o.anchored)&&p.animation.playState==="running"&&typeof p.animation.startTime=="number"&&(p.payload.sampledTime=(p.measuredAt-p.animation.startTime)*p.animation.playbackRate);r.set(c,f)}}this.entries=r}gliding(){return new Set([...this.entries.keys()].filter(t=>!this.fadesItself(t)))}fading(){return new Set([...this.entries.keys()].filter(t=>this.fadesItself(t)))}fadesItself(t){var e,n;return(n=(e=this.entries.get(t))===null||e===void 0?void 0:e.some(i=>i.payload.channel==="opacity"))!==null&&n!==void 0?n:!1}drawnAt(t){const[e,n]=Tr(Fe(t));if(this.targets(t).length===0)return[e,n];const i=I(t),o=t.getBoundingClientRect(),r=(a,c,l)=>{const u=l>0?a*c/l:a;return Math.abs(u-1)<1e-4?1:N(u)};return[r(e,i.width,o.width),r(n,i.height,o.height)]}targets(t){if(this.entries.size===0)return[];const e=[];for(let n=t;n;n=M(n))this.entries.has(n)&&e.unshift(n);return e}fades(t){return this.targets(t).some(e=>this.fadesItself(e))}fadesIn(t){if(t.children.length>0||!this.fades(t))return!1;const e=M(t);if(e instanceof HTMLElement&&!$(e))return!1;const n=k(t);return!t.hidden&&n.display!=="none"&&(n.visibility!=="hidden"||t.getAnimations().some(i=>Ct(i)==="visibility"))}idFor(t){const e=this.ids.get(t);if(e)return e;const n=`motion-${this.nextId++}`;return this.ids.set(t,n),n}travel(t){var e;const n=this.targets(t);if(n.length===0)return null;const i={minX:0,maxX:0,minY:0,maxY:0};for(const o of n){const a=((e=this.entries.get(o))!==null&&e!==void 0?e:[]).filter(w=>w.payload.channel!=="opacity");if(a.length===0)continue;const[c]=a,l=c.translation,{channel:u,keyframes:d,easing:h}=c.payload;if(a.length>1||u!=="translate"||!l||Co(h)||d.some(w=>Co(w.easing)))return null;const f=ut(k(o).getPropertyValue(l.property),l.property,l.width,l.height);if(!f)return null;const p=d.map(({value:w})=>(w[0]-f.x)*l.scaleX),y=d.map(({value:w})=>(w[1]-f.y)*l.scaleY);i.minX+=Math.min(0,...p),i.maxX+=Math.max(0,...p),i.minY+=Math.min(0,...y),i.maxY+=Math.max(0,...y)}return i}bounds(t,e){const n=this.targets(t);if(n.length===0)return e;const{x:i,y:o,w:r,h:a}=this.rebase(n,e.left,e.top,e.width,e.height);return i===e.left&&o===e.top&&r===e.width&&a===e.height?e:DOMRect.fromRect({x:i,y:o,width:r,height:a})}rebase(t,e,n,i,o){var r;for(let a=t.length-1;a>=0;a--){const c=t[a],l=this.entries.get(c),u=this.sampleScale(c,l);u&&(e=u.originX+u.kx*(e-u.originX),n=u.originY+u.ky*(n-u.originY),i*=u.kx,o*=u.ky);const d=(r=l?.find(f=>f.translation))===null||r===void 0?void 0:r.translation;if(!d)continue;const h=ut(getComputedStyle(c).getPropertyValue(d.property),d.property,d.width,d.height);h&&(e+=(d.x-h.x)*d.scaleX,n+=(d.y-h.y)*d.scaleY)}return{x:e,y:n,w:i,h:o}}sampleScale(t,e){var n;const i=(n=e?.find(l=>l.scaling))===null||n===void 0?void 0:n.scaling;if(!i||i.x===void 0||i.y===void 0)return null;const o=Qi(t,i.property);if(!o||!(o[0]>0&&o[1]>0))return null;const r=i.x/o[0],a=i.y/o[1];if(r===1&&a===1)return null;const c=no(t,i);return c&&{kx:r,ky:a,originX:c.x,originY:c.y}}sampledOrigin(t){var e;const n=this.entries.get(t),i=(e=n?.find(l=>l.scaling))===null||e===void 0?void 0:e.scaling,o=i&&no(t,i);if(!o)return null;const r=this.targets(t),a=this.rebase([t],o.x,o.y,0,0),c=this.rebase(r.slice(0,-1),a.x,a.y,0,0);return{x:c.x,y:c.y}}}function Co(s){var t,e;return s?.bezier?s.bezier[1]<0||s.bezier[1]>1||s.bezier[3]<0||s.bezier[3]>1:(e=(t=s?.points)===null||t===void 0?void 0:t.some(n=>n<0||n>1))!==null&&e!==void 0?e:!1}class mc{constructor(t){this.host=t}refuseInseparableOverlaps(t){t.forEach((e,n)=>{for(let i=n+1;i<t.length&&uo(e);i++){const o=t[i];if(!uo(o))continue;const r=Ul(e,o);if(r===null)continue;const a=[e,o].filter(c=>c.plane==="underlay");ue(a.length===2?Xl(e,o):a[0],r)}})}resolveHostPlanes(t,e){Ro(t,n=>this.mustCrossWebView(n,t,e)),Ro(t,n=>!this.drawnUnderSomething(n,t,e))}mustCrossWebView(t,e,n){return this.underlayConflict(t,n)!==null||n.some(i=>(i.coordinateSpace==="viewport"||(nn(i,t)||this.holedAgainst(t,i))&&$(i.el))&&Ht(t,i)&&L(t,i))||e.some(i=>i!==t&&i.plane==="overlay"&&Rt(i)&&wt(t,i)&&L(t,i))}drawnUnderSomething(t,e,n){return n.some(i=>this.webCutsAbove(i,t,n)&&$(i.el))||e.some(i=>i!==t&&i.plane==="underlay"&&Rt(i)&&wt(i,t)&&L(i,t))}webCutsAbove(t,e,n){return(t.overlayCutoutIssue!==null||Qn(t,e))&&!this.gradientTint(t,e)&&Ht(t,e)&&L(t,e)&&!this.opaqueWebCover(t,e,n)}resolveWebUnderlays(t,e){const n=rt(t,"overlay");if(n.length===0)return;const i=this.webAboveScan(n,e);for(const o of n){if(!i(o))continue;const r=gc(o,t);if(Array.from(r).every(a=>this.canSink(a,e)))for(const a of r)a.plane="underlay"}}webAboveScan(t,e){const n=(c,l)=>this.webCutsAbove(c,l,e),i=t[0],o=[],r=[];if(t.every(c=>Mo(c,i)))for(const c of e)(!c.sticky&&Mo(c,i)?o:r).push(c);if(o.length===0)return c=>e.some(l=>n(l,c));o.sort((c,l)=>c.paintRect.y-l.paintRect.y);const a=o.reduce((c,l)=>Math.max(c,l.paintRect.h),0);return c=>{let l=0,u=o.length;for(;l<u;){const h=Math.floor((l+u)/2);o[h].paintRect.y+a<=c.paintRect.y?l=h+1:u=h}const d=c.paintRect.y+c.paintRect.h;for(let h=l;h<o.length&&o[h].paintRect.y<d;h++)if(n(o[h],c))return!0;return r.some(h=>n(h,c))}}canSink(t,e){return!t.overlayOnly&&this.underlayConflict(t,e)===null&&e.every(n=>!Ht(t,n)||(L(t,n)?!nn(n,t)&&!this.holedAgainst(t,n)&&(At(t,n)||fo(t,n)):Qr(n.el,n.scrollPath,n.coordinateSpace==="viewport",t.el)===null))}detectBackgroundPaintConflicts(t,e){for(const n of e){if(!n.backgroundPaint||this.host.paint.scrollerPaint.has(n.el))continue;const i=k(n.el),o=xn(i);for(const r of t){if(!r.active||r.plane!=="underlay"||!r.visualRect||!H(r.visualRect,n.visualRect)||!L(r,n)||po(n,r.handle.el))continue;(o!=="border-box"||ui(n.el,r.visualRect)||We(n.el,!0)||/\binset\b/i.test(i.boxShadow)||i.boxShadow!=="none"&&i.boxShadow!==""&&!lt(n.visualRect,r.visualRect)||!$l(n.el,r.visualRect))&&ue(r,"overlapping web paint cannot be separated from its background")}}}underlayConflict(t,e){var n;if(!this.host.compositionEnabled||!t.active||!t.rect||!t.visualRect)return null;for(const i of e){const o=(n=i.cutoutIssue)!==null&&n!==void 0?n:ke(i.rect)?null:{reason:"opaque web surface geometry exceeds the shared safe coordinate or size range",mayMoveWithoutRefresh:!1};if(!(!o||!o.mayMoveWithoutRefresh&&!H(t.visualRect,i.visualRect)||!L(t,i)||e.some(a=>a!==i&&a.cutoutIssue===null&&!a.translucentFill&&ct(a.visualRect,i.visualRect)&&$(a.el)&&L(a,t)))&&!(_(i.el,t.el)&&!Bl(i.el,t.el,t.visualRect,this.host.paint.scrollerPaint)))return o.reason}return null}detectLayerCoordinateConflicts(t,e){for(const n of rt(t,"underlay")){const i=this.underlayConflict(n,e);i!==null&&ue(n,i)}}overlayCutsFollow(t,e){var n;let i=!1;for(const o of rt(t,"overlay")){if(Kn(o))continue;const r=l=>Ht(l,o)&&L(l,o),a=l=>!l.translucentFill&&r(l)&&!this.opaqueWebCover(l,o,e),c=e.filter(l=>l.overlayCutoutIssue!==null&&a(l));c.length>0&&((n=o.approximations)!==null&&n!==void 0?n:o.approximations=[]).push("box-cut"),i||(i=c.some(l=>{var u;return((u=l.overlayCutoutIssue)===null||u===void 0?void 0:u.mayMoveWithoutRefresh)===!0})||e.some(l=>Qn(l,o)&&(l.translucentFill?!o.handle.requiresUnobscuredSurface&&!this.host.motion.fades(l.el)&&r(l):a(l))))}return i}resolveMotionDependencies(t,e){for(const n of t){if(n.motionDependencies=new Set(n.scrollPath),!Rt(n))continue;const i=t.filter(o=>o!==n&&Rt(o));for(const o of[...e,...i])!st(o,n)&&_a(n.paintRect,n.scrollPath,o.paintRect,o.scrollPath)&&Ea(n.motionDependencies,n.scrollPath,o.scrollPath)}}holedAgainst(t,e){var n;return en(t,e)&&e.cutoutIssue===null&&!(!((n=this.host.planCanvas)===null||n===void 0)&&n.elements.has(e.el))}gradientTint(t,e){var n;return!this.host.capabilities.tintAlphaGradient||!(!((n=t.overlayCutoutIssue)===null||n===void 0)&&n.opaqueGradient)||e&&(e.handle.requiresUnobscuredSurface||Qn(t,e))?null:jt("alphaGradientTint",t.el,()=>{const i=Gr(t.el,t.rect.h);if(!i)return null;const o=[];for(const a of i){const c=ee(a.color);if(!c)return null;o.push(c)}const r=o[0];return!r||o.some(a=>a[3]>0&&r.slice(0,3).some((c,l)=>Math.abs(c-a[l])>1))?null:{color:[r[0],r[1],r[2],1],alphaStops:i.map((a,c)=>[a.offset,o[c][3]])}})}protectedWebRegion(t,e){if(!L(e,t)||!$(e.el)||!wt(e,t))return;const n=[document.documentElement,document.body,...t.scrollPath,...e.scrollPath].some(i=>i.scrollWidth>i.clientWidth+1);if(!n){const i=Z(e.el);if(vc(t,e,i)||bc(t,e))return;const o=i?.element;if(o&&yc(o,e)){if(o===e.el&&!kt(e.rect))return{rect:ye(o),coordinateSpace:"viewport",scrollPath:[],el:o};if(!e.paintEscapesRect&&lt(ye(o),ye(e.el)))return}if(wc(t,e))return Object.assign(Object.assign({},e),{rect:Object.assign(Object.assign({},e.rect),{r:D})})}return kt(e.rect)||e.cutoutIssue!==null||e.overlayCutoutIssue!==null?null:st(e,t)?H(e.rect,t.rect)?lo(e.rect,t.rect)?e:null:void 0:!n&&e.coordinateSpace==="viewport"&&e.scrollPath.length===0&&t.coordinateSpace==="document"&&lo(e.rect,we("viewport"))?e:null}protectedCoveredByAncestor(t,e,n){return!e.paintEscapesRect&&n.some(i=>i!==e&&_(i.el,e.el)&&At(i,e)&&ct(i.visualRect,e.visualRect)&&!!this.protectedWebRegion(t,i))}opaqueWebCover(t,e,n){return n.some(i=>{var o,r;const a=this.opaqueLayerRect(i);return i!==t&&(i.cutoutIssue===null||!!i.sticky)&&!nn(i,e)&&L(i,e)&&$(i.el)&&(a!==null&&((o=i.sticky)!==null&&o!==void 0?o:null)===((r=t.sticky)!==null&&r!==void 0?r:null)&&At(i,t)&&ct(a,t.visualRect)&&(!ce(t,e).paintEscapesRect||_(i.el,t.el)&&k(i.el).overflow==="hidden")||this.stickyCoverClipsDescendant(i,t))})}opaqueLayerRect(t){var e;const n=t.overlayCutoutIssue===null?t.visualRect.h:t.overlayCutoutIssue.opaqueGradient?Mn(t.el,t.visualRect.h):null;if(n===null)return null;const[i,o]=(e=t.visualRect.r)!==null&&e!==void 0?e:D;return n>=t.visualRect.h?t.visualRect:Object.assign(Object.assign({},t.visualRect),{h:n,r:[i,o,0,0]})}stickyCoverClipsDescendant(t,e){var n,i;const o=e.scrollPath[t.scrollPath.length],r=this.opaqueLayerRect(t);if(r===null||!t.sticky||e.overlayCutoutIssue!==Gn||e.paintEscapesRect||en(e,t)||nn(e,t)||t.coordinateSpace!==e.coordinateSpace||!o||!vi(e.scrollPath,t.scrollPath)||!_(t.el,o)||!_(o,e.el)||((n=Z(t.el))===null||n===void 0?void 0:n.element)!==((i=Z(e.el))===null||i===void 0?void 0:i.element)||!st(t,Q(o))||Jn(e)&&!Jn(t))return!1;const a=k(o);if(!["hidden","clip","auto","scroll"].includes(a.overflowX)||!["hidden","clip","auto","scroll"].includes(a.overflowY)||Et(a))return!1;for(let l=o;l&&l!==t.el;l=M(l)){const u=k(l);if(Oe(l)||Number.parseFloat(u.opacity)!==1||Cn(l)||oe(u)||Et(u))return!1}const c=ht(o);return c!==null&&ct(r,c)}}function Ro(s,t){const e=new Set(rt(s,"underlay"));for(const n of e)if(e.delete(n),!(n.plane!=="underlay"||!t(n))){n.plane="overlay";for(const i of rt(s,"underlay"))i!==n&&wt(n,i)&&e.add(i)}}function gc(s,t){const e=new Set([s]);for(const n of e)for(const i of t)Rt(i)&&i.plane==="overlay"&&wt(n,i)&&L(n,i)&&e.add(i);return e}function Mo(s,t){var e,n,i;const o=s.paintRect;return!s.paintEscapesRect&&((n=(e=s.movers)===null||e===void 0?void 0:e.length)!==null&&n!==void 0?n:0)===0&&((i=Z(s.el))===null||i===void 0?void 0:i.position)!=="sticky"&&o!=null&&[o.x,o.y,o.w,o.h,o.x+o.w,o.y+o.h].every(Number.isFinite)&&o.w>0&&o.h>0&&st(t,s)}function vc(s,t,e){const n=It(t.scrollPath),i=e?.element.parentElement;if(e?.position!=="sticky"||e.element===t.el||s.coordinateSpace!=="document"||!st(t,s)||k(e.element).bottom!=="0px"||!n||!i)return!1;const o=I(n);return Math.abs(o.top)<=1&&o.height>=window.innerHeight-1&&I(i).height>=n.scrollHeight-1&&I(e.element).top>s.rect.y+s.rect.h}function bc(s,t){var e,n,i;if(t.coordinateSpace!=="viewport"||t.scrollPath.length!==0)return!1;const o=I(t.el),r=I(s.el).left;return o.left+Math.max(o.width,t.el.scrollWidth)<r&&!((i=(n=(e=t.el).getAnimations)===null||n===void 0?void 0:n.call(e,{subtree:!0}))!==null&&i!==void 0?i:[]).some(a=>a.playState==="running")&&[t.el,...t.el.querySelectorAll("*")].every(a=>{const c=k(a);return I(a).right<r&&c.textShadow==="none"&&c.filter==="none"})}function yc(s,t){const e=k(s),n=It(t.scrollPath);if(e.position!=="sticky"||e.top!=="0px"||!/^rgb\(\d+,\d+,\d+\)$/.test(e.backgroundColor.replace(/\s/g,""))||!n||!s.parentElement)return!1;const i=I(n),o=I(s);return Math.abs(i.left)<=1&&Math.abs(i.top)<=1&&i.width>=window.innerWidth-1&&i.height>=window.innerHeight-1&&I(s.parentElement).height>=n.scrollHeight-1&&Math.abs(o.top-i.top)<=1&&o.left<=0&&o.right>=window.innerWidth-1}function wc(s,t){var e,n;const i=Math.max(...(e=t.rect.r)!==null&&e!==void 0?e:D),[,,o,r]=(n=s.rect.r)!==null&&n!==void 0?n:D,a=Math.min(o,r);return i>0&&a>=i&&st(t,s)&&t.rect.y>=s.rect.y+s.rect.h-a&&t.rect.y<s.rect.y+s.rect.h&&t.rect.x+i<=s.rect.x+a&&t.rect.x+t.rect.w-i>=s.rect.x+s.rect.w-a&&!t.paintEscapesRect&&Y(k(t.el).backgroundColor)===1}class Sc{constructor(t,e,n){this.natives=t,this.layers=e,this.writes=n,this.compositionEnabled=!1,this.capabilities={},this.planCanvas=null,this.motion=new pc,this.paint=new Zl(this)}drawnAt(t){return this.motion.drawnAt(t)}}const kc={compositionEnabled:!1,capabilities:{},innerScrollMode:"unsupported",frameInterval:1e3/60};class xc{constructor(t){this.ports=t,this.inputs=kc,this.heldUnder=new Map,this.pageHandoffs=new Map,this.planEffects=[],this.animatedTargets=new Set,this.descendantFacts=new WeakMap,this.motionSamples=new Map,this.facts=new Sc(t.natives,t.layers,t.writes),this.layerBuilder=new rc(this.facts,()=>t.candidates(),(e,n)=>t.settleWrite(e,n)),this.planes=new mc(this.facts)}plan(t){this.begin(t);const{motion:e}=this.facts;return e.entries.clear(),Aa(t.innerScrollMode==="native",()=>br(()=>er(()=>tl(()=>cr((n,i)=>e.bounds(n,i),()=>this.planScene())))))}read(t){this.begin(t);const e=this.layerBuilder.build();return{natives:this.buildNatives(),layers:e}}forgetLayers(t,e=!1){const{paint:n}=this.facts;if(!t){this.layerBuilder.forget(),Rn(),n.restyled();return}if(t instanceof HTMLElement&&this.layerBuilder.forget(t),Rn(t),!e)for(const i of aa(t))this.layerBuilder.forget(i),Rn(i);n.restyled(t,e)}notePageChange(t,e){var n,i;const{paint:o}=this.facts;if(o.pageChanged(),e===void 0||!(t instanceof HTMLElement))return!1;const r=o.ownsClip(t)&&e!=="style"&&e!==sn&&((n=this.pageHandoffs.get(t))===null||n===void 0?void 0:n.state)==="covered",a=r&&!!(!((i=this.heldUnder.get(t))===null||i===void 0)&&i.some(c=>this.ports.native.mayShowUnder(c.handle.islandId)));return o.noteAuthorChange(t,e,r&&!a),a}mayReachIsland(t){const e=t.getBoundingClientRect();let n=null;for(let i=M(t);i;i=M(i))if(this.layerBuilder.stickyBoxes.get(i)){n=i.getBoundingClientRect();break}return this.ports.natives.some(i=>{if(_(t,i.el))return!0;if(this.ports.native.planeOf(i.islandId)!=="overlay"||n&&e.top>=n.top-1&&e.bottom<=n.bottom+1)return!1;const o=i.el.getBoundingClientRect();return e.left<o.right&&o.left<e.right&&e.top<o.bottom&&o.top<e.bottom})}followAnchoredHoles(){this.facts.paint.followAnchoredHoles()}unregistered(t){this.facts.paint.forgetMask(t)}releaseRaised(){for(const[t,e]of this.heldUnder){const n=e.filter(i=>this.ports.native.mayShowUnder(i.handle.islandId));n.length>0?this.heldUnder.set(t,n):this.heldUnder.delete(t)}}releasePaint(){this.facts.paint.release(),this.heldUnder.clear(),this.pageHandoffs.clear()}begin(t){this.inputs=t,this.facts.compositionEnabled=t.compositionEnabled,this.facts.capabilities=t.capabilities}buildNatives(t=new Set){const{motion:e}=this.facts,{natives:n}=this.ports,i={motion:e,innerScrollMode:this.inputs.innerScrollMode,refusedUnderlays:t,backdrops:la(),fading:e.fading(),refusedBecause:o=>this.ports.native.refusedBecause(o),stickyMotion:(o,r)=>this.layerBuilder.stickyMotion(o,r)};for(const o of n)o.reconcileObservedStyles();return Dt(),re(()=>n.map((o,r)=>Ql(o,r,i)))}planScene(){const{natives:t}=this.ports,{motion:e,paint:n}=this.facts,i=t.some(C=>C.canAttemptNative()&&$(C.el));this.catchUp(i);const o=i?this.ports.effects.collect():[];this.planEffects=o;const r=new Set(o.map(C=>C.target)),a=[...new Set([...r,...this.animatedTargets])],c=a.filter(C=>this.keepsDescendants(C,o));for(const C of c)this.forgetLayers(C,!0);for(const C of ze(a.filter(P=>!c.includes(P))))this.forgetLayers(C);this.animatedTargets=r,e.describe(o,this.facts.capabilities);const{layers:l,covered:u}=this.readLayers(i,o);this.leadMovingLayers(l);const d=this.movesIslands(o),h=this.planPageHandoffs(u);let f=new Set,p=this.planNatives(l,f,u,h),y=p.cutsFollow;for(;p.refusedUnderlays.size>0;)f=new Set([...f,...p.refusedUnderlays]),p=this.planNatives(l,f,u,h),y||(y=p.cutsFollow);const{natives:w,canvasColor:g}=p;this.pageHandoffs=h;const v=d||y,x=new Map(rt(w,"underlay").map(({handle:C,rect:P,visualRect:E,paintRect:q,coordinateSpace:G,scrollPath:K})=>[C.islandId,{rect:P,visualRect:E,paintRect:q,coordinateSpace:G,scrollPath:K}])),{hidden:m,curtain:b}=this.findCovers(w,l),A=this.ports.native.planned(w);return Dt(),{payload:re(()=>hc(w,l,o,g,{scrollOffsets:this.ports.native.scrollers,motion:e,planes:this.planes,paneColors:n.paneColors,holds:C=>A.has(C),motionPayloads:(C,P)=>this.ports.motionPayloads(e,C,P)})),covered:m,geometry:x,curtain:b,follow:v}}catchUp(t){const e=t?this.ports.page.takeRestyled():[];if(e==="all")xi(),this.forgetLayers();else for(const n of ze(e))this.forgetLayers(n);this.facts.paint.releaseStaleBackgrounds(),this.ports.effects.pruneDetached(),this.ports.page.observeComposition([...this.ports.natives.map(n=>n.el),...this.ports.layers.map(n=>n.el)])}readLayers(t,e){return re(()=>{const n=t?this.layerBuilder.build(e):[],i=this.facts.compositionEnabled?Ac(n,this.ports.natives):[],o=new Set(i.map(r=>r.el));return{layers:n.filter(r=>Xe(r.el)!==null||!On(r.el,o)),covered:i}})}keepsDescendants(t,e){const i=e.filter(a=>a.target===t).every(a=>{var c,l;return(l=(c=Mc(a))===null||c===void 0?void 0:c.every(u=>Rc.has(u)))!==null&&l!==void 0?l:!1})?k(t):null,o=i?`${i.opacity==="1"} ${$s(i)}`:void 0,r=this.descendantFacts.get(t);return o===void 0?this.descendantFacts.delete(t):this.descendantFacts.set(t,o),o!==void 0&&o===r}movesIslands(t){const{motion:e}=this.facts;return t.some(n=>n.impact==="global-layout"||!n.pseudo&&!e.entries.has(n.target)&&(n.impact==="local-composition"||n.impact==="repaint")&&this.ports.natives.some(i=>_(n.target,i.el)))}leadMovingLayers(t){var e;const{motion:n}=this.facts,i=performance.now(),o=new Set;for(const r of t){if(!(!((e=r.movers)===null||e===void 0)&&e.some(h=>!n.entries.has(h))))continue;o.add(r.el);const a=this.motionSamples.get(r.el);this.motionSamples.set(r.el,{x:r.visualRect.x,y:r.visualRect.y,at:i});const c=a?i-a.at:0;if(!a||c<4||c>100)continue;const l=this.inputs.frameInterval/c,u=S((r.visualRect.x-a.x)*l),d=S((r.visualRect.y-a.y)*l);(Math.abs(u)>=.5||Math.abs(d)>=.5)&&(r.lead={x:u,y:d})}for(const r of this.motionSamples.keys())o.has(r)||this.motionSamples.delete(r)}planPageHandoffs(t){var e;const n=new Map;for(const i of t)n.set(i.el,{state:"covered",islands:[]});for(const[i,o]of this.heldUnder){if(n.has(i))continue;const r=o.filter(c=>this.ports.native.mayShowUnder(c.handle.islandId)),a=((e=this.pageHandoffs.get(i))===null||e===void 0?void 0:e.state)==="covered"?"uncovering":r.length>0?"held":"settled";n.set(i,{state:a,islands:r})}return n}planNatives(t,e,n,i){var o,r;const a=this.buildNatives(e),c=Cc(a,t);this.facts.planCanvas=c;const l=a.filter(p=>p.active);let u=!1;re(()=>{const{planes:p}=this;p.resolveHostPlanes(a,t),p.resolveWebUnderlays(a,t),p.refuseInseparableOverlaps(a),p.detectBackgroundPaintConflicts(a,t),p.detectLayerCoordinateConflicts(a,t),u=p.overlayCutsFollow(a,t),p.resolveMotionDependencies(a,t)});const d=this.holdingUnderlays(a);this.heldUnder=this.facts.paint.apply(d,t,c,n,i),Dt();const h=(r=(o=c?.color)!==null&&o!==void 0?o:d.some(p=>p.holding)?this.ports.native.shownCanvasColor():null)!==null&&r!==void 0?r:Or(),f=l.filter(p=>!p.active&&p.plane==="underlay");return{natives:a,canvasColor:h,refusedUnderlays:new Set(f.map(p=>p.el)),cutsFollow:u}}holdingUnderlays(t){const e=new Map(Array.from(this.heldUnder.values()).flatMap(n=>n.map(i=>[i.handle,i])));return t.map(n=>{var i;const o=n.handle.islandId;if(!n.active||n.plane!=="overlay"||!this.ports.native.mayShowUnder(o))return n;const r=(i=e.get(n.handle))!==null&&i!==void 0?i:this.ports.native.placedUnder(o),a=r&&zl(r);return Object.assign(Object.assign(Object.assign({},n),{plane:"underlay"}),a&&{holding:!0,heldInPlace:!this.planEffects.some(c=>c.impact!=="repaint"&&_(c.target,n.el))&&st(a,n)&&ca(a.rect,n.rect),rect:a.rect,visualRect:a.visualRect,paintRect:a.paintRect,coordinateSpace:a.coordinateSpace,scrollPath:a.scrollPath})})}findCovers(t,e){var n,i;const o=we("document"),r=(d,h)=>{const f=d.visualRect&&Jt(d.visualRect,o);return f===null||h.some(p=>Yl(p,d,f))},a=new Set(rt(t,"underlay").filter(d=>r(d,e)).map(d=>d.handle.islandId)),c=t.filter(d=>d.active),l=rt(c),u=c.length>0&&l.length===c.length&&(i=(n=e.find(d=>ao(d)&&l.every(h=>r(h,[d]))))===null||n===void 0?void 0:n.el)!==null&&i!==void 0?i:null;return{hidden:a,curtain:u}}}function Ac(s,t){const e=we("document"),n=s.filter(r=>{var a,c,l;const u=(a=r.backgroundPaint)!==null&&a!==void 0?a:kn(k(r.el));return r.cutoutIssue===null&&u?.image==="none"&&Y(u.color)===1&&((l=(c=r.animators)===null||c===void 0?void 0:c.length)!==null&&l!==void 0?l:0)===0&&document.scrollingElement!=null&&At(r,{coordinateSpace:"viewport",scrollPath:[]})&&ct(r.visualRect,e)&&t.some(d=>d.el.isConnected&&St(r.el,d.el)<0)}),i=s.filter(r=>n.some(a=>L(a,r))&&ft(r.el)&&!t.some(a=>$(a.el)&&_(r.el,a.el))),o=new Set(i.map(r=>r.el));return i.filter(r=>{const a=M(r.el);return a===null||!On(a,o)})}function Cc(s,t){var e,n,i,o;const r=s.filter(f=>f.active),a=new Set;let c=null,l=null;const u=t.filter(f=>f.backgroundPaint!==null&&ao(f)).sort((f,p)=>St(f.el,p.el));for(const f of u){const p=f.backgroundPaint;if(f.el===document.documentElement&&p&&Y(p.color)===0&&p.image==="none")continue;const y=p?.image==="none"?Ne(p.color):null;if(!y||f.cutoutIssue!==null||((n=(e=f.animators)===null||e===void 0?void 0:e.length)!==null&&n!==void 0?n:0)>0||((o=(i=f.movers)===null||i===void 0?void 0:i.length)!==null&&o!==void 0?o:0)>0||!r.every(w=>_(f.el,w.el)||St(f.el,w.el)<0))break;a.add(f.el),c=y,l=f.el}const d=l;return d===null||c===null||t.some(f=>!a.has(f.el)&&!_(d,f.el)&&St(f.el,d)<0)?null:{color:c,elements:a}}const Rc=new Set(["transform","translate","opacity"]);function Mc(s){var t,e,n;if(!((t=s.key)===null||t===void 0)&&t.startsWith("transition:"))return[s.key.slice(11)];if(!s.animation)return null;const i=Ct(s.animation);if(i!==void 0)return[i];const o=(n=(e=s.animation.effect)===null||e===void 0?void 0:e.getKeyframes)===null||n===void 0?void 0:n.call(e);return o?o.flatMap(r=>Object.keys(r).filter(a=>!$n.has(a))):null}const Pc=1e3,Oc=new Set,_c={scriptTranslated:!1,domChanged:!1},Ec=250,Nc=200;class Ic{constructor(t=()=>{},e=()=>[],n=()=>{}){this.natives=[],this.layers=[],this.compositionEnabled=!1,this.holds=0,this.gate={state:"open"},this.writes=new Jl,this.frames=new va(()=>this.link.ready,i=>this.runFrame(i)),this.effects=new Ll({natives:this.natives,layers:this.layers,refresh:()=>this.refresh(),mayReachIsland:i=>this.scene.mayReachIsland(i),clock:this.frames,motionStartsAtCommit:()=>!!this.link.capabilities.motionStartsAtCommit,scriptTranslated:()=>this.pageWatch.changes.scriptTranslated}),this.link=new Ba(this.natives,{refresh:()=>this.refresh(),schedule:()=>this.frames.schedule(),raised:()=>{this.scene.releaseRaised(),this.refresh()},forgetPaint:()=>this.scene.releasePaint(),republish:()=>this.republish()},this.effects,{observeSize:i=>this.pageWatch.observeSize(i),unobserveSize:i=>this.pageWatch.unobserveSize(i)},this.writes),this.canShow=()=>this.natives.some(i=>i.canAttemptNative()),this.refresh=()=>{this.frames.ask(),this.effects.markDue()},this.resolveNow=()=>this.resolve(),this.scene=new xc({natives:this.natives,layers:this.layers,candidates:e,settleWrite:(i,o)=>{const r=this.pageWatch.takePendingMutations(i,o);r.length>0&&queueMicrotask(()=>this.handleDomMutations(r))},writes:this.writes,native:this.link,effects:{collect:()=>{var i;return(i=n())!==null&&i!==void 0?i:this.effects.collect()},pruneDetached:()=>this.effects.pruneDetached()},page:{takeRestyled:()=>this.pageWatch.takeRestyled(),observeComposition:i=>this.pageWatch.observeComposition(i)},motionPayloads:(i,o,r)=>this.effects.payloads(i,o,r)}),this.pageWatch=new wl({effects:this.effects,writes:this.writes,scene:this.scene,frames:this.frames,link:this.link,natives:this.natives,refresh:()=>this.refresh(),handleDomMutations:i=>this.handleDomMutations(i)},t)}configure(t){this.compositionEnabled=t.compositionEnabled,this.link.configure(t.innerScrollMode,t.commandsFollowLayouts)}registerNative(t){if(U("register",{island:t.islandId}),this.natives.some(i=>i.el===t.el))return;const e=this.natives.findIndex(i=>i.islandId===t.islandId&&i.el!==t.el);if(e>=0){const[i]=this.natives.splice(e,1);this.pageWatch.unobserveSize(i.el)}this.link.registered(t),this.natives.push(t),this.effects.forgetRoots(),this.pageWatch.observeSize(t.el);const n=this.link.failure;n&&t.failNative(n.message)}registerLayer(t){this.layers.some(e=>e.el===t.el)||(this.link.invalidate(),this.layers.push(t),this.effects.forgetRoots(),this.pageWatch.observeSize(t.el),this.refresh())}unregister(t){this.scene.unregistered(t),this.effects.forgetRoots();const e=this.natives.findIndex(i=>i.el===t);e>=0&&(this.link.invalidate(),this.natives.splice(e,1),this.pageWatch.unobserveSize(t));const n=this.layers.findIndex(i=>i.el===t);n>=0&&(this.link.invalidate(),this.layers.splice(n,1),this.pageWatch.unobserveSize(t)),this.refresh()}findNative(t){return this.natives.find(e=>e.islandId===t)}beginTransportReset(t=!1){return this.gate={state:"open"},this.link.beginSession(t)}invalidateAutomaticLayers(t){this.scene.forgetLayers(t)}hold(){this.holds+=1,U("hold",{holds:this.holds});let t=null;const e=()=>t||(clearTimeout(n),this.holds-=1,U("release",{holds:this.holds}),t=this.link.nextApplied(()=>{this.holds===0&&this.refresh()}),t.catch(()=>{}),t),n=setTimeout(()=>void e(),Pc);return e}synchronize(){const t=this.link.failure;return t?Promise.reject(t):(this.scene.forgetLayers(),this.link.nextApplied(this.refresh))}republish(){return this.link.invalidate(),this.synchronize()}start(t,e){this.link.attach(t,e??null)&&(this.pageWatch.start(),this.refresh())}observeEffectRoot(t){this.pageWatch.observeRoot(t)}unobserveEffectRoot(t){this.pageWatch.unobserveRoot(t)}handleDomMutations(t){if(this.effects.markDue(),!Bt())return this.noteDomMutations(t);const e=performance.now(),n=this.pageWatch.changes.domChanged;try{this.noteDomMutations(t)}finally{U("mutations",{ms:performance.now()-e,records:t.length,changed:!n&&this.pageWatch.changes.domChanged,what:t.slice(0,6).map(i=>{var o,r;const a=i.target,c=`${(r=(o=a.nodeName)===null||o===void 0?void 0:o.toLowerCase())!==null&&r!==void 0?r:"?"}${typeof a.className=="string"&&a.className?`.${a.className.split(" ").filter(Boolean).slice(0,2).join(".")}`:""}`;return i.type==="attributes"?`${c}[${i.attributeName}]`:`${c} ${i.type}`})})}}planScene(){return this.resolve().payload}noteDomMutations(t){var e;const n=this.pageWatch.noteMutations(t);if(!n)return;const{reachesAll:i,uncovering:o}=n,r=this.gate;(r.state!=="away"||i||o||n.records.some(a=>this.reachesIsland(a)))&&(r.state==="curtained"&&(i||t.some(a=>Tc(a,r.curtain)))&&(this.gate={state:"open"}),this.frames.askForChange(n.hosts,!i&&!o)),o&&this.runFrame((e=this.frames.lastFrameTime)!==null&&e!==void 0?e:performance.now())}reachesIsland(t){const e=t.target;return this.natives.some(n=>{var i;return e===n.el||((i=e.contains)===null||i===void 0?void 0:i.call(e,n.el))})?!0:t.type!=="childList"?!1:[...Array.from(t.addedNodes),...Array.from(t.removedNodes)].some(n=>this.natives.some(i=>{var o;return n===i.el||((o=n.contains)===null||o===void 0?void 0:o.call(n,i.el))}))}resolve(){const t=this.scene.plan({compositionEnabled:this.compositionEnabled,capabilities:this.link.capabilities,innerScrollMode:this.link.innerScrollMode,frameInterval:this.frames.interval}),{curtain:e}=t;return this.frames.following=t.follow,this.gate=e?{state:"curtained",curtain:e}:{state:"open"},t}runFrame(t){const e=Bt()?performance.now():0;try{const n=this.frameGate(t);n&&this.sendPlan(t,n)}finally{this.effects.endFrame(),Bt()&&U("frame",{ms:performance.now()-e})}}frameGate(t){if(!this.link.ready)return null;if(this.holds>0)return U("held"),null;if(!this.frames.beginFrame(t)||this.staysAway())return null;this.scene.followAnchoredHoles();const e=this.frames.scrolling,n=this.effects.listFrame(e),i=n.length>0,o=!e&&!n.some(a=>this.effects.mayReachIsland(a)),r=this.frames.followDue(t,i);return!this.frames.requested&&!i&&!r?(this.idleFrame(),null):this.waits(t,i,r,e)?null:(U("plan",{started:i,follow:r,preparing:this.effects.preparing}),{fresh:n,still:o,paused:Oc,changes:_c,frameInterval:0})}staysAway(){const t=this.frames.takeLookAgain(),e=this.gate.state==="away";return(!e||this.frames.requested||t||this.link.awaited)&&(this.islandsAway()?this.gate={state:"away"}:e&&(this.gate={state:"open"})),this.gate.state!=="away"?!1:(U("away"),this.frames.awayFrame(this.canShow),!0)}islandsAway(){return this.effects.busy||!this.link.holdsOff()?!1:this.natives.every(t=>!(t.canAttemptNative()&&$(t.el)))}idleFrame(){U("idle"),this.frames.idleFrame(this.canShow)}waits(t,e,n,i){const o=this.link.awaitsCreation(),r=this.frames.sincePlan(t);return this.gate.state==="curtained"&&!e&&!this.frames.urgent&&!o&&!this.link.awaited&&r<Nc?(U("curtained"),this.frames.schedule(),!0):!e&&!n&&!this.link.awaited&&i&&(this.link.innerScrollMode==="bridge"?!o:r<Ec)?(U("scrolling"),this.frames.schedule(),!0):this.link.waitsForPaint(this.pageWatch.changes.domChanged,this.resolveNow)}sendPlan(t,e){this.frames.taken(),e.paused=this.effects.beginPlan(e.fresh);const n=this.resolve();e.changes=this.pageWatch.takeChanges(),e.frameInterval=this.frames.interval,this.tracePlanned(n.payload),this.frames.planned(t,this.link.send(n,e))}tracePlanned(t){Bt()&&U("planned",{registered:this.natives.map(e=>e.islandId),components:t.components.map(e=>`${e.id}${e.active?"":"(off)"}`),visible:this.natives.map(e=>$(e.el))})}}function Tc(s,t){if(t.isConnected===!1)return!0;const e=s.target instanceof Element?s.target:s.target.parentElement;return e&&(_(e,t)||_(t,e))?s.type!=="childList"||e===t||_(t,e):!1}const is={unavailable:0,carrier:10},Lc={identity:"custom",priority:is.carrier},Fc=["(prefers-color-scheme: dark)","(prefers-contrast: more)","(forced-colors: active)","(prefers-reduced-motion: reduce)"];class jc{constructor(){this.transport=tr(),this.transportPriority=Number.NEGATIVE_INFINITY,this.stacking=new Ic(t=>this.watcher.watchShadowRoot(t),()=>this.watcher.elements),this.watcher=new or(this.stacking),this.events=new rr,this.transportDisposers=[],this.session=null,this.reports=null,this.started=!1}get available(){return this.transport.available}initialize(t,e=Lc){const n=t.available?e.priority:is.unavailable;if(this.transportIdentity!==void 0&&(e.identity===this.transportIdentity||this.transport.available||n<=this.transportPriority))return!1;for(const i of this.transportDisposers.splice(0))i();return this.transport=t,this.transportIdentity=e.identity,this.transportPriority=n,this.stacking.configure({compositionEnabled:t.available,innerScrollMode:t.innerScrollMode,commandsFollowLayouts:t.ordered===!0}),this.events.attach(t),t.available&&(this.beginSession(t,!0),this.listenToTransport(t),this.autostart()),!0}registerIsland(t){this.watcher.watchRootsOf(t.el),this.stacking.registerNative(t),this.started&&this.stacking.refresh()}unregister(t){this.stacking.unregister(t)}refresh(){this.stacking.refresh()}synchronize(){return Promise.resolve().then(()=>this.stacking.synchronize())}hold(){return this.stacking.hold()}command(t,e,n,i,o){try{vr(t,e,n,i)}catch(c){return Promise.reject(c)}Bt()&&U("command",{island:t,component:e,method:n,properties:i});const r=Object.assign({island:t,islandType:e,method:n,params:i},o!==void 0&&{instance:o}),a=this.session;return a?this.afterReset(a,c=>c===a?c.transport.command(r):Promise.resolve()):this.transport.command(r)}listen(t,e,n){return this.events.listen(t,e,n)}listenToTransport(t){const e=(o,r)=>typeof o.reason=="string"?o.reason:r;if(this.transportDisposers.push(this.listen("islandError",o=>{var r;if(!o.island)return;const a=typeof o.instance=="number"?o.instance:void 0;(r=this.stacking.findNative(o.island))===null||r===void 0||r.failNative(e(o,"Native component failed."),a)}),this.listen("scrollError",o=>{var r;Array.isArray(o.containers)&&((r=this.reports)===null||r===void 0||r.scrollFailed(o.containers.filter(a=>typeof a=="string"),e(o,"Native scroll synchronization failed.")))}),this.listen("scrollRejected",o=>{var r;(r=this.session)===null||r===void 0||r.offsetsRefused(new Error(e(o,"Native refused scroll offsets.")))})),typeof window>"u")return;const n=()=>this.beginSession(t),i=o=>{o.persisted&&this.restoreAfterPageShow(this.beginSession(t))};window.addEventListener("pagehide",n),window.addEventListener("pageshow",i),this.transportDisposers.push(()=>window.removeEventListener("pagehide",n),()=>window.removeEventListener("pageshow",i))}beginSession(t,e=!1){var n;return(n=this.session)===null||n===void 0||n.end(),this.reports=this.stacking.beginTransportReset(e),this.session=new gr(t,this.reports),this.session}async afterReset(t,e){let n=t;for(await n.ready.catch(()=>{});n!==this.session&&this.session;)n=this.session,await n.ready.catch(()=>{});if(n.state.phase==="failed")throw n.state.failure;return e(n)}async restoreAfterPageShow(t){let e;try{await this.afterReset(t,n=>(e=n,this.stacking.republish())),e?.current&&this.stacking.refresh()}catch(n){if(!e?.current||e.state.phase==="failed")return;e.fail(new Error(Ae(n,"Native restoration failed","Native components could not be restored after page show.")))}}autostart(){typeof document>"u"||(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>this.start(),{once:!0}):this.start())}start(){this.started||!document.body||(this.started=!0,this.watcher.watchDocument(),this.stacking.start(t=>{var e,n;return(n=(e=this.session)===null||e===void 0?void 0:e.applyLayout(t))!==null&&n!==void 0?n:Promise.resolve()},t=>{var e;return(e=this.session)===null||e===void 0||e.sendOffsets(t),Promise.resolve()}),this.refreshOnPageChanges())}refreshOnPageChanges(){var t,e,n,i;const o=()=>this.refresh(),r=()=>{this.stacking.invalidateAutomaticLayers(),this.refresh()};window.addEventListener("resize",o,{passive:!0}),window.addEventListener("load",r,{once:!0}),window.addEventListener("hashchange",r),document.addEventListener("fullscreenchange",r),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&this.refresh()}),(e=(t=document.fonts)===null||t===void 0?void 0:t.ready)===null||e===void 0||e.then(o).catch(()=>{}),(n=document.fonts)===null||n===void 0||n.addEventListener("loadingdone",o),(i=document.fonts)===null||i===void 0||i.addEventListener("loadingerror",o);for(const a of Fc)window.matchMedia(a).addEventListener("change",r)}}const X=me("runtime/v1",()=>new jc);function Wc(s,t){return X.initialize(s,t)}const at=me("definitions/v1",()=>({commandGeneration:0,commandsSuspended:!1,islandSequence:0,lifecycleListenersInstalled:!1,definitions:new Map}));function Bc(){at.lifecycleListenersInstalled||typeof window>"u"||(at.lifecycleListenersInstalled=!0,window.addEventListener("pagehide",()=>{at.commandGeneration+=1,at.commandsSuspended=!0}),window.addEventListener("pageshow",()=>{at.commandsSuspended=!1}))}function Po(){return`native-island-${++at.islandSequence}`}class $c{constructor(){this.times=[],this.retry=null}record(t){const e=Date.now();return this.times=this.times.filter(n=>e-n<us),this.times.push(e),this.times.length>=hn?!0:(this.retry=this.retry==="create"?"create":t,!1)}forget(){this.times=[],this.retry=null}}function qc(s){var t;if(!s.tagName.includes("-"))throw new TypeError("tagName must be a valid custom-element name.");if(!s.nativeComponent.trim())throw new TypeError("nativeComponent must not be empty.");const e=s.firstFrame&&{event:s.firstFrame.event,timeoutMs:(t=s.firstFrame.timeoutMs)!==null&&t!==void 0?t:2e3};if(e&&(!e.event.trim()||!Number.isFinite(e.timeoutMs)||e.timeoutMs<=0))throw new TypeError("firstFrame requires a native event and a positive timeoutMs.");return e}function zc(s,t,e,n){var i,o,r,a,c,l,u,d;return JSON.stringify({isInteractive:(i=s.isInteractive)!==null&&i!==void 0?i:!1,accessibility:(o=s.accessibility)!==null&&o!==void 0?o:"web",requiresUnobscuredSurface:(r=s.requiresUnobscuredSurface)!==null&&r!==void 0?r:!1,supportsProtectedSurfaceClip:(a=s.supportsProtectedSurfaceClip)!==null&&a!==void 0?a:!1,observedAttributes:[...t].sort(),observedStyles:[...e].sort(),preserveChildren:(c=s.preserveChildren)!==null&&c!==void 0?c:!1,hostsChildren:(l=s.hostsChildren)!==null&&l!==void 0?l:!1,firstFrame:n&&Object.assign(Object.assign({},n),((u=s.firstFrame)===null||u===void 0?void 0:u.startWhen)&&{startWhen:!0}),events:Object.entries((d=s.events)!==null&&d!==void 0?d:{}).sort(([h],[f])=>h<f?-1:h>f?1:0)})}function Dc(s){var t,e,n,i,o;Bc();const r=qc(s),a=[...new Set((t=s.observedAttributes)!==null&&t!==void 0?t:[])],c=[...new Set(((e=s.observedStyles)!==null&&e!==void 0?e:[]).map(f=>f.trim()).filter(Boolean))],l=zc(s,a,c,r),u={getProperties:s.getProperties,renderFallback:s.renderFallback,firstFrameStartWhen:(n=s.firstFrame)===null||n===void 0?void 0:n.startWhen},d=at.definitions.get(s.tagName);if(d){if(d.nativeComponent!==s.nativeComponent)throw new Error(`<${s.tagName}> is already registered for "${d.nativeComponent}".`);if(d.structuralSignature!==l)throw new Error(`<${s.tagName}> is already registered with a different definition contract.`);return Object.assign(d.handlers,u),d.constructor}if(customElements.get(s.tagName))throw new Error(`<${s.tagName}> was defined outside Native Islands.`);Go(s.nativeComponent,{tagName:s.tagName,observedAttributes:a,requiresUnobscuredSurface:(i=s.requiresUnobscuredSurface)!==null&&i!==void 0?i:!1,supportsProtectedSurfaceClip:(o=s.supportsProtectedSurfaceClip)!==null&&o!==void 0?o:!1});const h=Hc(s,u,a,c,r);return at.definitions.set(s.tagName,{nativeComponent:s.nativeComponent,constructor:h,structuralSignature:l,handlers:u}),h}function Hc(s,t,e,n,i){const o=new Set,r=new Map;class a extends HTMLElement{constructor(){var l,u,d,h;super(),this._islandId=Po(),this.type=s.nativeComponent,this.interactive=(l=s.isInteractive)!==null&&l!==void 0?l:!1,this.requiresUnobscuredSurface=(u=s.requiresUnobscuredSurface)!==null&&u!==void 0?u:!1,this.supportsProtectedSurfaceClip=(d=s.supportsProtectedSurfaceClip)!==null&&d!==void 0?d:!1,this.placement={kind:"detached"},this.lifecycle=new Ko(i!==void 0),this.presentation=new Zo(this,{render:p=>t.renderFallback(p),keepsChildren:!!(s.preserveChildren||s.hostsChildren),webAccessibility:((h=s.accessibility)!==null&&h!==void 0?h:"web")==="web"}),this.firstFrameDeadline=i&&new Ho(i.timeoutMs,()=>this.reportError(`Native first frame was not reported within ${i.timeoutMs} ms.`,"firstFrameTimeout")),this.failures=new $c,this.mountGeneration=0,this.disconnectGeneration=0,this.nativeInactiveReason=null,this.eventDisposers=[],this.updateScheduled=!1,this.observedStyleSnapshot=null;const f=this;for(const p of o){if(!Object.prototype.hasOwnProperty.call(this,p))continue;const y=f[p];delete f[p],f[p]=y}}static get observedAttributes(){return e}get el(){return this}get islandId(){return this._islandId}get portal(){var l,u;const d=(u=(l=this.getAttribute("data-native-island-portal"))===null||l===void 0?void 0:l.trim())!==null&&u!==void 0?u:"";return d.length>0&&d.length<=128?d:null}get connected(){return this.placement.kind!=="detached"}get failed(){return this.lifecycle.state==="failed"}get drawn(){return!i||this.lifecycle.state==="drawn"}canAttemptNative(){return this.connected&&!this.failed&&X.available}connectedCallback(){if(this.disconnectGeneration+=1,this.connected||(this.mountGeneration+=1,this.placement={kind:"web"},s.hostsChildren&&Uo(this),X.available&&this.becomeHosted()))return;this.adoptPortalView();const l=this.portal;if(l&&r.set(l,this),X.registerIsland(this),!X.available){this.presentation.showWeb();return}this.activateNative()}disconnectedCallback(){if(this.placement.kind==="detached")return;if(this.placement.kind==="hosted"){const{host:u}=this.placement;this.placement={kind:"detached"},this.removeAttribute("data-native-islands-hosted"),u.hostedChildrenChanged(this);return}const l=++this.disconnectGeneration;queueMicrotask(()=>{var u;if(l!==this.disconnectGeneration||this.isConnected)return;const d=this.portal;d&&r.get(d)===this&&r.delete(d),this.mountGeneration+=1,this.placement={kind:"detached"},this.lifecycle.transition({type:"restarted"}),this.failures.forget(),this.nativeInactiveReason=null,(u=this.firstFrameDeadline)===null||u===void 0||u.cancel(),this.observedStyleSnapshot=null,this.presentation.restoreWebPaint(),this.stopListening(),X.unregister(this)})}attributeChangedCallback(l,u,d){if(!(!this.connected||u===d)){if(this.placement.kind==="hosted"){this.placement.host.hostedChildrenChanged(this);return}X.refresh(),this.propertiesChanged()}}hostedIsland(){return this.placement.kind!=="hosted"?null:{element:this,nativeComponent:s.nativeComponent,properties:()=>{var l,u;return(u=(l=t.getProperties)===null||l===void 0?void 0:l.call(t,this))!==null&&u!==void 0?u:{}},dispatchNativeEvent:(l,u)=>{var d;const h=(d=s.events)===null||d===void 0?void 0:d[l];return h?(this.dispatchEvent(new CustomEvent(h,{bubbles:!0,composed:!0,detail:u})),!0):!1}}}hostedChildrenChanged(l){Vo(this,l??null),this.placement.kind==="native"&&this.scheduleUpdate(!1)}onTransportAvailable(){if(!(this.placement.kind!=="web"||this.failed)){if(this.becomeHosted()){X.unregister(this);return}this.activateNative(),X.refresh()}}failNative(l,u){var d;u!==void 0&&u!==this.lifecycle.instance||this.lifecycle.transition({type:"failed"})&&((d=this.firstFrameDeadline)===null||d===void 0||d.cancel(),this.placement.kind==="native"&&(this.placement={kind:"web"}),this.failures.retry=null,this.stopListening(),this.presentation.removeAccessibility(),this.reportError(l))}nativeLayoutSent(){this.lifecycle.transition({type:"sent"})}nativeLayoutApplied(l){var u,d;if(!this.lifecycle.transition({type:"applied",holds:l}))return l?this.creation:void 0;if(this.mountGeneration+=1,this.failures.retry=null,!l){this.creation=void 0,(u=this.firstFrameDeadline)===null||u===void 0||u.cancel(),i&&this.connected&&this.presentation.showWeb();return}if(this.placement.kind==="native")return this.drawn||((d=this.firstFrameDeadline)===null||d===void 0||d.rearm(),this.presentation.showWeb()),this.creation=this.send("create")}nativeReset(){var l;this.lifecycle.transition({type:"reset"})&&(this.mountGeneration+=1,this.creation=void 0,this.failures.retry=null,(l=this.firstFrameDeadline)===null||l===void 0||l.cancel(),i&&this.connected&&this.presentation.showWeb())}setNativeInactive(l){const u=this.lifecycle.holdsView?this.failures.retry:null;u&&(this.failures.retry=null,this.send(u)),this.nativeInactiveReason!==l&&(this.nativeInactiveReason=l,l===null?(this.removeAttribute("data-native-islands-inactive"),this.placement.kind==="native"&&this.presentNative()):(this.setAttribute("data-native-islands-inactive",""),this.presentation.showWeb()))}reconcileObservedStyles(){if(!this.connected||n.length===0)return;const l=this.readObservedStyles(),u=this.observedStyleSnapshot;this.observedStyleSnapshot=l,u!==null&&l!==u&&this.propertiesChanged()}adoptPortalView(){const l=this.portal;if(!l)return;const u=r.get(l);!u||u===this||u.portal!==l||!u.lifecycle.holdsView||u.surrenderView(this)}surrenderView(l){var u;if(this.mountGeneration+=1,(u=this.firstFrameDeadline)===null||u===void 0||u.cancel(),this.stopListening(),this.presentation.restoreWebPaint(),l._islandId=this._islandId,l.lifecycle.state=this.lifecycle.state,l.lifecycle.instance=this.lifecycle.instance,this._islandId=Po(),this.lifecycle.state="pending",this.lifecycle.instance=1,!this.isConnected){this.placement={kind:"detached"},X.unregister(this);return}this.placement={kind:"web"},this.activateNative()}becomeHosted(){const l=Yo(this);return l?(this.placement={kind:"hosted",host:l},this.setAttribute("data-native-islands-hosted",""),l.hostedChildrenChanged(this),!0):!1}activateNative(){var l;this.placement.kind!=="web"||this.failed||!X.available||(this.placement={kind:"native"},this.drawn?this.presentation.showNative():this.presentation.showWeb(),this.listenToNative(),this.lifecycle.holdsView?this.send("create"):(l=t.getProperties)===null||l===void 0||l.call(t,this))}presentNative(){this.drawn&&this.presentation.showNative()}listenToNative(){var l;const u=(d,h)=>{this.eventDisposers.push(X.listen(d,h,this.islandId))};i&&u(i.event,d=>this.firstFrameDrawn(d.instance));for(const[d,h]of Object.entries((l=s.events)!==null&&l!==void 0?l:{}))u(d,f=>{if(typeof f.instance=="number"&&f.instance!==this.lifecycle.instance)return;const p=Object.assign({},f);delete p.island,delete p.instance,this.dispatchEvent(new CustomEvent(h,{bubbles:!0,composed:!0,detail:p}))})}firstFrameDrawn(l){var u,d;if(!this.connected||!this.lifecycle.transition({type:"drawn",instance:l}))return;((d=(u=this.firstFrameDeadline)===null||u===void 0?void 0:u.drawn())!==null&&d!==void 0?d:!1)&&this.failures.retry===null&&this.removeAttribute("data-native-islands-error"),this.nativeInactiveReason===null&&this.presentNative(),X.refresh()}stopListening(){for(const l of this.eventDisposers.splice(0))l()}reportError(l,u){this.setAttribute("data-native-islands-error",""),X.refresh(),this.dispatchEvent(new CustomEvent("nativeislanderror",{bubbles:!0,composed:!0,detail:u?{reason:l,code:u}:{reason:l}}))}propertiesChanged(){this.placement.kind==="native"?this.scheduleUpdate():X.available||this.presentation.showWeb()}readObservedStyles(){const l=k(this);return JSON.stringify(n.map(u=>l.getPropertyValue(u)))}async send(l){var u,d,h;const f=this.mountGeneration;try{n.length>0&&(this.observedStyleSnapshot=this.readObservedStyles());const y=(u=t.getProperties)===null||u===void 0?void 0:u.call(t,this,{command:l});this.drawn||(d=this.firstFrameDeadline)===null||d===void 0||d.start(()=>{var w;return((w=t.firstFrameStartWhen)===null||w===void 0?void 0:w.call(t,this))!==!1}),await X.command(this.islandId,s.nativeComponent,l,y,l==="create"?this.lifecycle.instance:void 0)}catch(y){if(!this.connected||f!==this.mountGeneration||this.failed)return;const w=y instanceof Error?y.message:"Native command failed.";this.failures.record(l)?this.failNative(w):this.reportError(w);return}f===this.mountGeneration&&!this.failed&&this.failures.retry===null&&!(!((h=this.firstFrameDeadline)===null||h===void 0)&&h.timedOut)&&this.removeAttribute("data-native-islands-error")}scheduleUpdate(l=!0){if(this.updateScheduled)return;this.updateScheduled=!0;const u=at.commandGeneration;queueMicrotask(()=>{this.updateScheduled=!1,!(!this.connected||this.failed||!X.available||at.commandsSuspended||u!==at.commandGeneration)&&(l&&this.drawn&&this.presentation.refreshAccessibility(),this.lifecycle.holdsView&&this.send("update"))})}}for(const c of e)c in a.prototype||(o.add(c),Object.defineProperty(a.prototype,c,{configurable:!0,enumerable:!0,get(){return this.getAttribute(c)},set(l){l==null?this.removeAttribute(c):this.setAttribute(c,String(l))}}));return customElements.define(s.tagName,a),a}const Oo=new WeakMap;function _o(s){try{return JSON.parse(s)}catch{return null}}function Eo(s,t){const e=typeof s?.message=="string"?s.message:t;return Object.assign(new Error(e),{code:typeof s?.code=="string"?s.code:void 0})}function Vc(s){const t=Oo.get(s);if(t)return t;const e={nextId:0,queue:[],timer:null,pending:new Map};return Oo.set(s,e),s.addEventListener("message",n=>{var i;const o=_o(String((i=n.data)!==null&&i!==void 0?i:""));if(typeof o?.id!="number")return;const r=e.pending.get(o.id);r&&(e.pending.delete(o.id),o.error?r.reject(Eo(o.error,"Native Islands command failed.")):r.resolve(o.result))}),e}function Uc(s){return s instanceof Error?s:new Error(String(s))}function Yc(s){const t=Vc(s),e=(n,i)=>{try{s.postMessage(i)}catch(o){const r=t.pending.get(n);t.pending.delete(n),r?.reject(Uc(o))}};return(n,i)=>new Promise((o,r)=>{var a;const c=++t.nextId;t.pending.set(c,{resolve:o,reject:r});const l=JSON.stringify({id:c,operation:n,payload:i}),u=n==="applyLayout"?i:null;if(!(u!==null&&Array.isArray(u.order)&&u.order.length===0&&Array.isArray(u.components)&&u.components.length>0)&&t.timer===null){e(c,l);return}t.queue.push({id:c,message:l}),(a=t.timer)!==null&&a!==void 0||(t.timer=setTimeout(()=>{t.timer=null;for(const h of t.queue.splice(0))e(h.id,h.message)},0))})}function Xc(s){return async(t,e)=>{try{return await s.postMessage(JSON.stringify({operation:t,payload:e}))}catch(n){const i=n instanceof Error?n.message:String(n);throw Eo(_o(i),i)}}}function Gc(s,t="ios"){var e,n;if(t==="android"){const o=globalThis[`nativeIslandsDirect_${s}`];return typeof o?.postMessage!="function"||typeof o.addEventListener!="function"?null:Yc(o)}const i=(n=(e=globalThis.webkit)===null||e===void 0?void 0:e.messageHandlers)===null||n===void 0?void 0:n[`ni.${s}`];return typeof i?.postMessage=="function"?Xc(i):null}const he="OSGeolocationIslands",on=new Map;let os=!1,No=!1;function Lt(){return typeof window>"u"?void 0:window}function Vt(){const s=Lt()?.cordova?.platformId?.toLowerCase();return s==="android"||s==="ios"?s:"web"}function Kc(s){if(s instanceof Error)return s;const t=typeof s=="object"&&s!==null?s:void 0,e=new Error(typeof t?.message=="string"?t.message:typeof s=="string"?s:"Native component command failed.");return typeof t?.code=="string"&&(e.code=t.code),e}function rs(s,t){const e=Lt()?.cordova?.exec;return e?new Promise((n,i)=>{e(o=>n(o),o=>i(Kc(o)),he,s,[t])}):Promise.reject(Object.assign(new Error("Cordova is not available."),{code:"unavailable"}))}let rn=Promise.resolve(),Io=Promise.resolve();function To(s,t){return rn.then(()=>{const e=Gc(he,"android");if(e)return Io.then(()=>e(s,t));const n=rs(s,t);return Io=n.catch(()=>{}),n})}function Jc(){const s=Lt()?.cordova?.exec;return{available:!!s,innerScrollMode:Vt()==="ios"?"native":Vt()==="android"?"bridge":"unsupported",scrollChannel:he,ordered:!0,applyLayout(t){return To("applyLayout",t)},applyScrollOffsets(t){return rn.then(()=>rs("applyScrollOffsets",t)).then(()=>{})},async command(t){await To("command",t)},reset(){const t=rn.then(()=>rs("reset",{}));return rn=t.then(()=>{},()=>{}),t},on(t,e){const n=on.get(t)??new Set;return n.add(e),on.set(t,n),!os&&s&&(os=!0,s(i=>{const o=i;if(!(!o?.event||!o.data))for(const r of on.get(o.event)??[])r(o.data)},()=>{os=!1},he,"events",[{}])),()=>{n.delete(e),n.size===0&&on.delete(t)}}}}function Zc(){const s=Lt()?.cordova?.exec;return s?new Promise(t=>{s(e=>{t(e?.requiresUnobscuredSurface!==!1)},()=>t(!0),he,"capabilities",[])}):Promise.resolve(!0)}function Qc(){if(No||Vt()!=="android")return;const s=Jc();s.available&&(No=!0,Wc(s,{identity:"com.outsystems.plugins.geolocation/location-button",priority:is.carrier}))}const Lo={"use-precise-location":"Use precise location","share-precise-location":"Share precise location","near-my-precise-location":"Near my precise location","near-your-precise-location":"Near your precise location","precise-location":"Precise location",none:"Share location"},tt={backgroundColor:"background-color",textColor:"color",iconTint:"--os-location-button-icon-color",strokeColor:"border-top-color",strokeWidth:"border-top-width",pressedCornerRadius:"--os-location-button-pressed-corner-radius",clickablePadding:"--os-location-button-clickable-padding"},Fo=["text-type","maximum-age","timeout","enable-location-fallback"],tu=[tt.backgroundColor,tt.textColor,tt.iconTint,tt.strokeColor,tt.strokeWidth,tt.pressedCornerRadius,tt.clickablePadding,"border-top-left-radius"],eu=/^#[0-9A-Fa-f]{6}$/,nu=/^rgba?\((.+)\)$/;function jo(s){const t=s.getAttribute("text-type")??"precise-location";return t in Lo?t:"precise-location"}function an(s,t,e){const n=s.getPropertyValue(t).trim();if(eu.test(n))return n.toUpperCase();const i=n.match(nu);if(!i)return e;const o=i[1].match(/\d+(?:\.\d+)?/g)?.map(Number);return!o||o.length<3||o.slice(0,3).some(r=>r<0||r>255)||o.length>3&&o[3]<1?e:`#${o.slice(0,3).map(r=>Math.round(r).toString(16).padStart(2,"0")).join("").toUpperCase()}`}function as(s,t,e,n,i){const o=s.getPropertyValue(t).trim();if(!o.endsWith("px"))return i;const r=Number.parseFloat(o);return Number.isFinite(r)&&r>=e&&r<=n?r:i}function su(s,t,e,n,i){const o=s.getPropertyValue(t).trim();if(!o.endsWith("px"))return i;const r=Number.parseFloat(o);return Number.isFinite(r)?Math.min(n,Math.max(e,r)):i}function Ut(s,t,e,n=0){const i=s.getAttribute(t);if(i===null)return e;const o=Number.parseInt(i,10);return Number.isFinite(o)&&o>=n?o:e}function Wo(s,t,e){const n=s.getAttribute(t);return n===null?e:n==="true"?!0:n==="false"?!1:e}function pt(s,t,e){s.dispatchEvent(new CustomEvent(t,{bubbles:!0,composed:!0,detail:e}))}function iu(s){return{timestamp:s.timestamp,coords:{latitude:s.latitude,longitude:s.longitude,accuracy:s.accuracy,altitude:s.altitude,altitudeAccuracy:s.altitudeAccuracy,heading:s.heading,speed:s.speed,magneticHeading:s.magneticHeading,trueHeading:s.trueHeading,headingAccuracy:s.headingAccuracy,course:s.course}}}function ou(s,t){pt(s,"location-position",t)}function ru(s){const t=Lt()?.cordova?.exec;if(!t){pt(s,"location-error",{reason:"Cordova is not available"});return}t(e=>{const n=e;pt(s,"location-grant",{granted:!0}),pt(s,"location-position",iu(n))},e=>{const n=e;(n?.code==="OS-PLUG-GLOC-0003"||n?.code==="OS-PLUG-GLOC-0008")&&pt(s,"location-grant",{granted:!1}),pt(s,"location-error",{reason:n?.message||"Location request failed",code:n?.code})},"OSGeolocation","getCurrentPosition",[{enableHighAccuracy:!0,timeout:Ut(s,"timeout",1e4,1),maximumAge:Ut(s,"maximum-age",0),enableLocationFallback:Wo(s,"enable-location-fallback",!0)}])}function ls(s){ln($o(s)),s.dataset.osLocationButtonFallbackFace="";const t=document.createElement("button");t.type="button",t.className="os-location-button-fallback";const e=jo(s),n=Lo[e],i=document.createElementNS("http://www.w3.org/2000/svg","svg");i.classList.add("os-location-button-fallback__icon"),i.setAttribute("viewBox","0 0 960 960"),i.setAttribute("aria-hidden","true");const o=document.createElementNS("http://www.w3.org/2000/svg","path");o.setAttribute("d","M440 918v-80q-125-14-214.5-103.5T122 520H42v-80h80q14-125 103.5-214.5T440 122V42h80v80q125 14 214.5 103.5T838 440h80v80h-80q-14 125-103.5 214.5T520 838v80h-80Zm40-158q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560 480q0-33-23.5-56.5T480 400q-33 0-56.5 23.5T400 480q0 33 23.5 56.5T480 560Z"),i.append(o);const r=document.createElement("span");r.className=e==="none"?"os-location-button-fallback__visually-hidden":"",r.textContent=n,t.append(i,r),t.setAttribute("aria-label",n),t.addEventListener("click",()=>{if(Vt()!=="web"){ru(s);return}if(!navigator.geolocation){pt(s,"location-error",{reason:"Browser geolocation is unavailable"});return}navigator.geolocation.getCurrentPosition(c=>{pt(s,"location-grant",{granted:!0}),ou(s,c)},c=>{c.code===c.PERMISSION_DENIED&&pt(s,"location-grant",{granted:!1}),pt(s,"location-error",{reason:c.message||"Browser location request failed"})},{enableHighAccuracy:!0,timeout:Ut(s,"timeout",1e4,1),maximumAge:Ut(s,"maximum-age",0)})}),s.replaceChildren(t)}const Bo=new WeakSet;function $o(s){const t=s.getRootNode();return t instanceof ShadowRoot?t:document}function ln(s=document){if(Bo.has(s)||(Bo.add(s),s.querySelector("style[data-os-location-button]")))return;const t=document.createElement("style");if(t.dataset.osLocationButton="",t.textContent=`
>>>>>>> Stashed changes
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
      border-radius: 16px;
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
<<<<<<< Updated upstream
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
      supportsProtectedSurfaceClip: protectedSurface,
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
=======
  `,s instanceof ShadowRoot){s.append(t);return}document.head.append(t)}function qo(s){if(!(typeof document>"u"||typeof HTMLElement>"u"||typeof customElements>"u"||customElements.get("os-location-button"))){if(ln(),Vt()==="ios"){class t extends HTMLElement{constructor(){super(...arguments),this.connected=!1}static get observedAttributes(){return Fo}connectedCallback(){this.connected||(this.connected=!0,ls(this))}attributeChangedCallback(n,i,o){this.connected&&i!==o&&ls(this)}}customElements.define("os-location-button",t);return}Dc({tagName:"os-location-button",nativeComponent:"os.locationButton",isInteractive:!0,accessibility:"native",requiresUnobscuredSurface:s,supportsProtectedSurfaceClip:s,observedAttributes:Fo,observedStyles:tu,getProperties:t=>{ln($o(t));const e=getComputedStyle(t),n=as(e,"border-top-left-radius",0,68,16),i=an(e,tt.textColor,"#FFFFFF");return{textType:jo(t),backgroundColor:an(e,tt.backgroundColor,"#0B57D0"),textColor:i,iconTint:an(e,tt.iconTint,i),strokeColor:an(e,tt.strokeColor,"#000000"),cornerRadius:n,pressedCornerRadius:as(e,tt.pressedCornerRadius,0,68,12),strokeWidth:as(e,tt.strokeWidth,0,3,0),clickablePadding:su(e,tt.clickablePadding,4,8,6),maximumAge:Ut(t,"maximum-age",0),timeout:Ut(t,"timeout",1e4,1),enableLocationFallback:Wo(t,"enable-location-fallback",!0)}},renderFallback:ls,events:{grant:"location-grant",position:"location-position",buttonError:"location-error"}})}}function zo(){if(Qc(),Vt()==="android"){ln(),Zc().then(qo);return}qo(!1)}Lt()?.cordova&&!Lt()?.cordova?.platformId?document.addEventListener("deviceready",zo,{once:!0}):zo()})();
>>>>>>> Stashed changes
