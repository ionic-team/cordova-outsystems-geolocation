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
