(function() {
  "use strict";
  class FirstFrameDeadline {
    constructor(timeoutMs, onTimeout) {
      this.timeoutMs = timeoutMs;
      this.onTimeout = onTimeout;
      this.phase = {
        name: "idle"
      };
      this.timedOut = false;
    }
    /** A new view is being created, so it gets a full deadline. */
    rearm() {
      this.cancel();
      this.phase = { name: "idle" };
    }
    /** Starts counting, if this view's deadline has not started yet and `ready` says it may. */
    start(ready) {
      if (this.phase.name !== "idle" || !ready())
        return;
      const timer = setTimeout(() => {
        this.phase = { name: "spent" };
        this.timedOut = true;
        this.onTimeout();
      }, this.timeoutMs);
      this.phase = { name: "running", timer };
    }
    cancel() {
      if (this.phase.name !== "running")
        return;
      clearTimeout(this.phase.timer);
      this.phase = { name: "spent" };
    }
    /** The view drew; true when it had already been reported late. */
    drawn() {
      this.cancel();
      const late = this.timedOut;
      this.timedOut = false;
      return late;
    }
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
  const hostState = globalSingleton("hosts/v1", () => ({ hosts: /* @__PURE__ */ new WeakSet(), changes: /* @__PURE__ */ new WeakMap() }));
  function noteHostedChange(host, child) {
    const current = hostState.changes.get(host);
    if (current === "all")
      return;
    if (child === null)
      hostState.changes.set(host, "all");
    else if (current)
      current.add(child);
    else
      hostState.changes.set(host, /* @__PURE__ */ new Set([child]));
  }
  function markIslandHost(element) {
    hostState.hosts.add(element);
  }
  function islandHostOf(element) {
    const parent = element.parentElement;
    return parent && hostState.hosts.has(parent) ? parent : null;
  }
  function changesOnlyHostedContent(target, childList) {
    if (childList && hostState.hosts.has(target))
      return true;
    for (let node = target, parent = target.parentElement; parent; node = parent, parent = parent.parentElement) {
      if (hostState.hosts.has(parent))
        return node.hasAttribute("data-native-islands-hosted");
    }
    return false;
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
  class IslandLifecycle {
    constructor(firstFrame) {
      this.firstFrame = firstFrame;
      this.state = "pending";
      this.instance = 1;
    }
    get holdsView() {
      return this.state === "created" || this.state === "drawn";
    }
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
  const NATIVE_PRESENTATION = /* @__PURE__ */ new Map([
    ["background-clip", "text"],
    ["-webkit-background-clip", "text"],
    ["border-image-source", "linear-gradient(transparent, transparent)"],
    ["border-image-slice", "1"],
    ["user-select", "none"],
    ["-webkit-user-select", "none"],
    ["-webkit-touch-callout", "none"]
  ]);
  const ACCESSIBILITY_FACE_STYLE = /* @__PURE__ */ new Map([
    ["position", "absolute"],
    ["width", "1px"],
    ["height", "1px"],
    ["padding", "0"],
    ["margin", "-1px"],
    ["overflow", "hidden"],
    ["clip", "rect(0, 0, 0, 0)"],
    ["clip-path", "inset(50%)"],
    ["white-space", "nowrap"],
    ["border", "0"],
    ["pointer-events", "none"]
  ]);
  class IslandPresentation {
    constructor(element, options) {
      this.element = element;
      this.options = options;
      this.nativePaint = null;
      this.fallbackAttributes = /* @__PURE__ */ new Map();
      this.fallbackOnClick = null;
      this.accessibilityFace = null;
    }
    /** Shows the browser implementation, marked with `data-native-islands-fallback`. */
    showWeb() {
      var _a;
      const { element } = this;
      this.restoreWebPaint();
      this.undoFallback();
      const before = new Map(element.getAttributeNames().map((name) => [name, element.getAttribute(name)]));
      const beforeOnClick = element.onclick;
      this.options.render(element);
      for (const name of /* @__PURE__ */ new Set([...before.keys(), ...element.getAttributeNames()])) {
        if (name === "data-native-islands-fallback")
          continue;
        const was = (_a = before.get(name)) !== null && _a !== void 0 ? _a : null;
        const now = element.getAttribute(name);
        if (was !== now)
          this.fallbackAttributes.set(name, { before: was, after: now });
      }
      if (beforeOnClick !== element.onclick)
        this.fallbackOnClick = { before: beforeOnClick, after: element.onclick };
      element.setAttribute("data-native-islands-fallback", "");
    }
    /** Takes the browser implementation down and hides the element's own paint over the native view. */
    showNative() {
      this.undoFallback();
      this.refreshAccessibility();
      this.hideWebPaint();
    }
    /** Renders the accessibility face again from the element's current state. */
    refreshAccessibility() {
      var _a;
      if (!this.options.webAccessibility)
        return;
      (_a = this.accessibilityFace) === null || _a === void 0 ? void 0 : _a.remove();
      const face = document.createElement("div");
      for (const name of this.element.getAttributeNames()) {
        if (name === "id" || name === "style" || name === "data-native-islands-fallback")
          continue;
        const value = this.element.getAttribute(name);
        if (value !== null)
          face.setAttribute(name, value);
      }
      this.options.render(face);
      face.setAttribute("data-native-islands-accessibility-face", "");
      for (const [property, value] of ACCESSIBILITY_FACE_STYLE)
        face.style.setProperty(property, value, "important");
      this.element.append(face);
      this.accessibilityFace = face;
    }
    removeAccessibility() {
      var _a;
      (_a = this.accessibilityFace) === null || _a === void 0 ? void 0 : _a.remove();
      this.accessibilityFace = null;
    }
    /** Gives the element its own paint back, where the author has not changed it since. */
    restoreWebPaint() {
      const original = this.nativePaint;
      if (!original)
        return;
      const { style } = this.element;
      for (const [property, value] of NATIVE_PRESENTATION) {
        if (style.getPropertyValue(property) !== value || style.getPropertyPriority(property) !== "important")
          continue;
        const previous = original.get(property);
        if (previous === null || previous === void 0 ? void 0 : previous.value)
          style.setProperty(property, previous.value, previous.priority);
        else
          style.removeProperty(property);
      }
      this.element.removeAttribute("data-native-islands-presentation-hidden");
      this.nativePaint = null;
    }
    hideWebPaint() {
      const { style } = this.element;
      if (this.nativePaint || typeof style.getPropertyValue !== "function")
        return;
      this.nativePaint = new Map(Array.from(NATIVE_PRESENTATION.keys(), (property) => [
        property,
        { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) }
      ]));
      for (const [property, value] of NATIVE_PRESENTATION)
        style.setProperty(property, value, "important");
      this.element.setAttribute("data-native-islands-presentation-hidden", "");
    }
    /** Undoes what the browser implementation set, where the author has not changed it since. */
    undoFallback() {
      const { element } = this;
      element.removeAttribute("data-native-islands-fallback");
      for (const [name, change] of this.fallbackAttributes) {
        if (element.getAttribute(name) !== change.after)
          continue;
        if (change.before === null)
          element.removeAttribute(name);
        else
          element.setAttribute(name, change.before);
      }
      this.fallbackAttributes.clear();
      if (this.fallbackOnClick && element.onclick === this.fallbackOnClick.after) {
        element.onclick = this.fallbackOnClick.before;
      }
      this.fallbackOnClick = null;
      this.removeAccessibility();
      if (!this.options.keepsChildren)
        this.clearChildren();
    }
    clearChildren() {
      const { element } = this;
      if (typeof element.replaceChildren === "function") {
        element.replaceChildren();
        return;
      }
      while (element.firstChild)
        element.removeChild(element.firstChild);
    }
  }
  const MAX_REFUSALS = 3;
  const REFUSAL_WINDOW_MS = 2e3;
  class LayoutRefusals {
    constructor() {
      this.islands = /* @__PURE__ */ new Map();
      this.unnamed = null;
    }
    /** Notes that native refused `payload`; returns the islands that have now failed. */
    refuse(payload, reason, lastSent) {
      var _a;
      const ids = payload.components.map((component) => component.id);
      const named = ids.filter((id) => reason.includes(`'${id}'`));
      const now = performance.now();
      const refusedSeq = (_a = payload.layoutSeq) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY;
      const strike = (previous) => {
        if (previous && refusedSeq <= previous.seq)
          return null;
        const count = previous && now - previous.at < REFUSAL_WINDOW_MS ? previous.count + 1 : 1;
        return { count, at: now, seq: lastSent };
      };
      if (named.length === 0) {
        const strikes = strike(this.unnamed);
        if (!strikes)
          return [];
        this.unnamed = strikes;
        if (strikes.count < MAX_REFUSALS || ids.length === 0)
          return [];
        this.unnamed = null;
        for (const id of ids)
          this.islands.delete(id);
        return ids;
      }
      const failed = [];
      for (const id of named) {
        const strikes = strike(this.islands.get(id));
        if (!strikes)
          continue;
        if (strikes.count >= MAX_REFUSALS) {
          this.islands.delete(id);
          failed.push(id);
        } else {
          this.islands.set(id, Object.assign(Object.assign({}, strikes), { held: true, reason }));
        }
      }
      return failed;
    }
    /** Notes that native accepted `accepted`; returns whether that frees an island held out. */
    accept(accepted) {
      var _a;
      this.unnamed = null;
      let released = false;
      for (const [id, strikes] of this.islands) {
        if (strikes.held) {
          if (((_a = accepted.layoutSeq) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY) <= strikes.seq)
            continue;
          strikes.held = false;
          released = true;
        } else if (accepted.components.some((component) => component.id === id && component.active)) {
          this.islands.delete(id);
        }
      }
      return released;
    }
    /** Why native refused the island's last layout, while the island is held out of layouts. */
    heldReason(islandId) {
      const strikes = this.islands.get(islandId);
      return (strikes === null || strikes === void 0 ? void 0 : strikes.held) ? strikes.reason : void 0;
    }
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
  let styleMemo = null;
  let planMemos = null;
  let readStyles = null;
  let readMemos = null;
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
    const previous = { readStyles, readMemos };
    readStyles = /* @__PURE__ */ new WeakMap();
    readMemos = /* @__PURE__ */ new Map();
    try {
      return read();
    } finally {
      ({ readStyles, readMemos } = previous);
    }
  }
  function remember(memos, name, key, compute) {
    if (!memos)
      return compute();
    let memo = memos.get(name);
    if (!memo) {
      memo = /* @__PURE__ */ new WeakMap();
      memos.set(name, memo);
    }
    if (memo.has(key))
      return memo.get(key);
    const value = compute();
    memo.set(key, value);
    return value;
  }
  function planMemo$1(name, key, compute) {
    return remember(planMemos, name, key, compute);
  }
  function readMemo(name, key, compute) {
    return remember(readMemos, name, key, compute);
  }
  function readStyleFact(name, style, read) {
    return readStyles ? planMemo$1(name, style, read) : read();
  }
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
    const remember2 = readStyles === read.scope;
    if (remember2) {
      const value2 = read.values.get(name);
      if (value2 !== void 0 || read.values.has(name))
        return value2;
    }
    const value = Reflect.get(read.declaration, name, read.declaration);
    const bound = typeof value === "function" ? value.bind(read.declaration) : value;
    if (remember2)
      read.values.set(name, bound);
    return bound;
  }
  function propertyIsActive(style, name, initial = "none") {
    const value = style.getPropertyValue(name).trim();
    return value !== "" && value !== initial;
  }
  function hasBackdropFilter(style) {
    return propertyIsActive(style, "backdrop-filter") || propertyIsActive(style, "-webkit-backdrop-filter");
  }
  function borderWidths(style) {
    return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map((width) => Number.parseFloat(width) || 0);
  }
  function hasTextShadow(style) {
    return style.textShadow !== "" && style.textShadow !== "none";
  }
  function composedParentElement(element) {
    return readMemo("composedParent", element, () => readComposedParent(element));
  }
  function readComposedParent(element) {
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
  function containsComposed(ancestor, element) {
    for (let node = element; node; node = composedParentElement(node)) {
      if (node === ancestor)
        return true;
    }
    return false;
  }
  function trace(event, detail) {
    const sink = globalThis.__nativeIslandsTrace;
    if (Array.isArray(sink))
      sink.push(Object.assign({ at: performance.now(), event }, detail));
  }
  function tracing() {
    return Array.isArray(globalThis.__nativeIslandsTrace);
  }
  const LAYER_SELECTOR = "[data-native-islands-opaque-surface]";
  function elementsOf(root) {
    const descendants = Array.from(root.querySelectorAll("*"));
    return root instanceof HTMLElement ? [root, ...descendants] : descendants;
  }
  class DocumentWatcher {
    constructor(page) {
      this.page = page;
      this.elements = /* @__PURE__ */ new Set();
      this.layers = /* @__PURE__ */ new WeakSet();
      this.shadowObservers = /* @__PURE__ */ new Map();
    }
    watchDocument() {
      this.elements.add(document.documentElement);
      this.scan(document.body);
      new MutationObserver((records) => this.handleMutations(records)).observe(document.body, {
        attributes: true,
        attributeFilter: ["data-native-islands-opaque-surface"],
        childList: true,
        subtree: true
      });
    }
    /** Watches every shadow tree `element` sits in, up to the document. */
    watchRootsOf(element) {
      if (typeof ShadowRoot === "undefined" || typeof element.getRootNode !== "function")
        return;
      const visited = /* @__PURE__ */ new Set();
      for (let current = element; current; current = composedParentElement(current)) {
        const root = current.getRootNode();
        if (root instanceof ShadowRoot && !visited.has(root)) {
          visited.add(root);
          this.watchShadowRoot(root);
        }
      }
    }
    watchShadowRoot(root) {
      if (this.shadowObservers.has(root))
        return;
      this.page.observeEffectRoot(root);
      this.scan(root);
      const observer = new MutationObserver((records) => {
        this.handleMutations(records);
        this.page.handleDomMutations(records);
      });
      observer.observe(root, { attributes: true, characterData: true, childList: true, subtree: true });
      this.shadowObservers.set(root, observer);
    }
    handleMutations(records) {
      if (!tracing())
        return this.applyMutations(records);
      const start = performance.now();
      try {
        this.applyMutations(records);
      } finally {
        trace("scan", { ms: performance.now() - start, records: records.length });
      }
    }
    applyMutations(records) {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLElement) {
          if (record.target.matches(LAYER_SELECTOR))
            this.addLayer(record.target);
          else if (this.layers.delete(record.target))
            this.page.unregister(record.target);
          continue;
        }
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement)
            this.scan(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof HTMLElement)
            this.forget(node);
        }
      }
    }
    scan(root) {
      if (root instanceof HTMLElement && root.matches(LAYER_SELECTOR))
        this.addLayer(root);
      for (const layer of root.querySelectorAll(LAYER_SELECTOR))
        this.addLayer(layer);
      for (const element of elementsOf(root)) {
        this.elements.add(element);
        if (element.shadowRoot)
          this.watchShadowRoot(element.shadowRoot);
      }
    }
    addLayer(el) {
      if (this.layers.has(el))
        return;
      this.layers.add(el);
      this.page.registerLayer({ el });
    }
    /** Forgets a removed subtree and every open shadow tree in it. */
    forget(tree) {
      var _a;
      if (tree instanceof ShadowRoot) {
        (_a = this.shadowObservers.get(tree)) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.shadowObservers.delete(tree);
        this.page.unobserveEffectRoot(tree);
      }
      for (const element of elementsOf(tree)) {
        this.elements.delete(element);
        if (element.matches(LAYER_SELECTOR)) {
          this.layers.delete(element);
          this.page.unregister(element);
        }
        if (element.shadowRoot)
          this.forget(element.shadowRoot);
      }
    }
  }
  class NativeEvents {
    constructor() {
      this.transport = null;
      this.channels = /* @__PURE__ */ new Map();
      this.nextOrder = 0;
    }
    /** Subscribes every event someone listens for on `transport`, instead of the previous one. */
    attach(transport) {
      var _a;
      for (const channel of this.channels.values()) {
        (_a = channel.unsubscribe) === null || _a === void 0 ? void 0 : _a.call(channel);
        channel.unsubscribe = void 0;
      }
      this.transport = transport;
      for (const [eventName, channel] of this.channels)
        this.subscribe(eventName, channel);
    }
    /** Listens for `eventName` from every island, or only from `islandId`; returns the way to stop. */
    listen(eventName, callback, islandId) {
      var _a;
      let channel = this.channels.get(eventName);
      if (!channel) {
        channel = { broadcast: /* @__PURE__ */ new Set(), islands: /* @__PURE__ */ new Map() };
        this.channels.set(eventName, channel);
        this.subscribe(eventName, channel);
      }
      const listener = { callback, order: this.nextOrder++, active: true };
      const listeners = islandId === void 0 ? channel.broadcast : (_a = channel.islands.get(islandId)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Set();
      listeners.add(listener);
      if (islandId !== void 0)
        channel.islands.set(islandId, listeners);
      const owner = channel;
      return () => {
        var _a2;
        if (!listener.active)
          return;
        listener.active = false;
        listeners.delete(listener);
        if (islandId !== void 0 && listeners.size === 0)
          owner.islands.delete(islandId);
        if (owner.broadcast.size === 0 && owner.islands.size === 0) {
          (_a2 = owner.unsubscribe) === null || _a2 === void 0 ? void 0 : _a2.call(owner);
          this.channels.delete(eventName);
        }
      };
    }
    subscribe(eventName, channel) {
      if (!this.transport)
        return;
      channel.unsubscribe = this.transport.on(eventName, (event) => {
        const targeted = typeof event.island === "string" ? channel.islands.get(event.island) : void 0;
        const listeners = [...channel.broadcast, ...targeted !== null && targeted !== void 0 ? targeted : []].sort((a, b) => a.order - b.order);
        for (const listener of listeners) {
          if (listener.active)
            listener.callback(event);
        }
      });
    }
  }
  const SQUARE = [0, 0, 0, 0];
  let projectBounds = null;
  let boundsMemo = null;
  function withBoundsReadScope(read) {
    const previous = boundsMemo;
    boundsMemo = { bounds: /* @__PURE__ */ new WeakMap() };
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
      boundsMemo = { bounds: /* @__PURE__ */ new WeakMap(), scroll: boundsMemo.scroll };
    try {
      return read();
    } finally {
      projectBounds = previous;
      boundsMemo = previousMemo;
    }
  }
  function readBounds(element, bounds) {
    var _a;
    const cached = bounds ? void 0 : boundsMemo === null || boundsMemo === void 0 ? void 0 : boundsMemo.bounds.get(element);
    if (cached)
      return cached;
    const measured = bounds !== null && bounds !== void 0 ? bounds : element.getBoundingClientRect();
    const projected = (_a = projectBounds === null || projectBounds === void 0 ? void 0 : projectBounds(element, measured)) !== null && _a !== void 0 ? _a : measured;
    if (!bounds)
      boundsMemo === null || boundsMemo === void 0 ? void 0 : boundsMemo.bounds.set(element, projected);
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
  function inscribedCornerRadii(style, width, height) {
    const radii = cornerSpans(style, width, height).map(([horizontal, vertical]) => Math.min(horizontal, vertical));
    return fitRadii([radii[0], radii[1], radii[2], radii[3]], width, height);
  }
  function hasEllipticalCorners(style, width, height) {
    return cornerSpans(style, width, height).some(([horizontal, vertical]) => Math.abs(horizontal - vertical) > 0.5);
  }
  function cornerSpans(style, width, height) {
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius
    ].map((corner) => {
      var _a, _b;
      const [horizontal, vertical = horizontal] = (corner !== null && corner !== void 0 ? corner : "").trim().split(/\s+/);
      return [(_a = cssLength(horizontal !== null && horizontal !== void 0 ? horizontal : "0", width)) !== null && _a !== void 0 ? _a : 0, (_b = cssLength(vertical !== null && vertical !== void 0 ? vertical : "0", height)) !== null && _b !== void 0 ? _b : 0];
    });
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
    if (/^0+(?:\.0*)?$/.test(value))
      return 0;
    const match = /^(\S+?)(px|%)$/.exec(value);
    if (!match)
      return null;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number < 0)
      return null;
    return match[2] === "%" ? number * basis / 100 : number;
  }
  function docRect(element) {
    var _a;
    const scroll = boundsMemo ? (_a = boundsMemo.scroll) !== null && _a !== void 0 ? _a : boundsMemo.scroll = windowScroll() : windowScroll();
    return roundedBounds(readBounds(element), scroll.x, scroll.y);
  }
  function windowScroll() {
    return { x: window.scrollX, y: window.scrollY };
  }
  function viewportRect(element) {
    return roundedBounds(readBounds(element), 0, 0);
  }
  function windowRect(space) {
    return space === "document" ? { x: window.scrollX, y: window.scrollY, w: window.innerWidth, h: window.innerHeight } : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }
  function documentToViewport(rect) {
    return Object.assign(Object.assign({}, rect), { x: round2(rect.x - window.scrollX), y: round2(rect.y - window.scrollY) });
  }
  function clientToDocument(bounds) {
    return { x: bounds.left + window.scrollX, y: bounds.top + window.scrollY, w: bounds.width, h: bounds.height };
  }
  function roundedBounds(bounds, offsetX, offsetY) {
    const x = round2(bounds.left + offsetX);
    const y = round2(bounds.top + offsetY);
    const right = round2(bounds.left + bounds.width + offsetX);
    const bottom = round2(bounds.top + bounds.height + offsetY);
    return { x, y, w: round2(right - x), h: round2(bottom - y) };
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
      output.push(...cellRuns(rects, (covered) => covered));
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
    return cellRuns(clipped, (covered) => !covered, layer).map((rect) => Object.assign(Object.assign({}, rect), { r: SQUARE }));
  }
  function cellRuns(rects, keep, bounds) {
    const edges = (start, size) => {
      const values = bounds ? [bounds[start], bounds[start] + bounds[size]] : [];
      for (const rect of rects)
        values.push(rect[start], rect[start] + rect[size]);
      return Array.from(new Set(values)).sort((a, b) => a - b);
    };
    const xs = edges("x", "w");
    const ys = edges("y", "h");
    const output = [];
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex++) {
      const y = ys[yIndex];
      const height = ys[yIndex + 1] - y;
      let runStart = null;
      for (let xIndex = 0; xIndex < xs.length - 1; xIndex++) {
        const x = xs[xIndex];
        const kept = keep(rects.some((rect) => x >= rect.x && xs[xIndex + 1] <= rect.x + rect.w && y >= rect.y && ys[yIndex + 1] <= rect.y + rect.h));
        if (kept && runStart === null)
          runStart = x;
        const last = xIndex === xs.length - 2;
        if (runStart === null || kept && !last)
          continue;
        const right = kept && last ? xs[xIndex + 1] : x;
        const width = right - runStart;
        const left = runStart;
        const previous = output.find((rect) => rect.x === left && rect.w === width && rect.y + rect.h === y);
        if (previous)
          previous.h += height;
        else
          output.push({ x: left, y, w: width, h: height });
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
  function round3(value) {
    return Math.round(value * 1e3) / 1e3;
  }
  function round4(value) {
    return Math.round(value * 1e4) / 1e4;
  }
  function scaledRadii([topLeft, topRight, bottomRight, bottomLeft], factor) {
    return [
      round2(topLeft * factor),
      round2(topRight * factor),
      round2(bottomRight * factor),
      round2(bottomLeft * factor)
    ];
  }
  function radiiDrawnAt(style, width, height, [scaleX, scaleY]) {
    if (scaleX === 1 && scaleY === 1)
      return cssCornerRadii(style, width, height);
    const own = cssCornerRadii(style, width / scaleX, height / scaleY);
    return own && scaledRadii(own, scaleX);
  }
  function failureReason(error, prefix, fallback) {
    return error instanceof Error && error.message ? `${prefix}: ${error.message}` : fallback;
  }
  function clockNow() {
    return round3(performance.now());
  }
  function scrollChannel(name) {
    const channel = name ? globalThis[`nativeIslandsScroll_${name}`] : void 0;
    return typeof (channel === null || channel === void 0 ? void 0 : channel.postMessage) === "function" ? channel : void 0;
  }
  class NativeSession {
    constructor(transport, host) {
      this.transport = transport;
      this.host = host;
      this.status = { phase: "resetting" };
      this.ended = false;
      this.holdsEarlyOffsets = false;
      this.layoutsInFlight = 0;
      this.waitingOffsets = null;
      this.repairing = false;
      this.ready = Promise.resolve().then(() => transport.reset()).then((capabilities) => {
        if (this.ended)
          return;
        this.holdsEarlyOffsets = (capabilities === null || capabilities === void 0 ? void 0 : capabilities.heldOffsets) === true;
        this.status = { phase: "ready" };
        host.ready(capabilities !== null && capabilities !== void 0 ? capabilities : {});
      }).catch((error) => {
        const failure = new Error(failureReason(error, "Native initialization failed", "Native initialization failed while resetting the platform bridge."));
        if (!this.ended)
          this.fail(failure);
        throw failure;
      });
      void this.ready.catch(() => void 0);
    }
    get state() {
      return this.status;
    }
    get current() {
      return !this.ended;
    }
    end() {
      this.ended = true;
    }
    fail(failure) {
      this.status = { phase: "failed", failure };
      this.host.failed(failure);
    }
    applyLayout(payload) {
      this.layoutsInFlight++;
      const settled = () => {
        if (this.ended)
          return;
        this.layoutsInFlight--;
        this.flushOffsets();
      };
      const sentAt = clockNow();
      return this.transport.applyLayout(Object.assign(Object.assign({}, payload), { sentAt })).catch((error) => {
        if (!this.ended && this.state.phase !== "failed") {
          const reason = failureReason(error, "Native layout rejected", "Native layout rejected by the platform bridge.");
          this.host.refused(payload, reason);
        }
        throw error;
      }).then((acknowledgement) => {
        if (this.ended)
          return;
        if (this.state.phase !== "failed" && (acknowledgement === null || acknowledgement === void 0 ? void 0 : acknowledgement.heldOffsets) === true)
          this.holdsEarlyOffsets = true;
        if (typeof (acknowledgement === null || acknowledgement === void 0 ? void 0 : acknowledgement.appliedAt) === "number")
          this.host.applied(acknowledgement.appliedAt - sentAt);
        settled();
      }, (error) => {
        settled();
        throw error;
      });
    }
    /** Sends `payload`, or keeps it as the one sample waiting when it cannot be sent yet. */
    sendOffsets(payload) {
      if (this.state.phase !== "ready")
        return;
      this.waitingOffsets = payload;
      this.flushOffsets();
    }
    /** Native could not apply offsets sent in this session. */
    offsetsRefused(error) {
      if (this.ended || this.state.phase !== "ready" || this.repairing)
        return;
      void this.repairOffsets(error);
    }
    flushOffsets() {
      var _a;
      const payload = this.waitingOffsets;
      if (!payload || this.repairing || this.offsetsBlocked())
        return;
      this.waitingOffsets = null;
      const sample = Object.assign(Object.assign({}, payload), { sentAt: (_a = payload.sentAt) !== null && _a !== void 0 ? _a : clockNow() });
      const channel = scrollChannel(this.transport.scrollChannel);
      if (channel) {
        channel.postMessage(JSON.stringify(sample));
        return;
      }
      this.transport.applyScrollOffsets(sample).catch((error) => this.offsetsRefused(error));
    }
    offsetsBlocked() {
      return this.state.phase !== "ready" || this.layoutsInFlight > 0 && !this.holdsEarlyOffsets;
    }
    async repairOffsets(error) {
      var _a, _b;
      this.repairing = true;
      let repair = null;
      try {
        await this.host.republish();
        if (this.ended || this.state.phase === "failed")
          return;
        repair = this.host.captureOffsets();
        if (repair)
          await this.transport.applyScrollOffsets(repair);
      } catch (_c) {
        if (this.ended || this.state.phase === "failed")
          return;
        this.host.scrollFailed((_b = (_a = repair !== null && repair !== void 0 ? repair : this.waitingOffsets) === null || _a === void 0 ? void 0 : _a.offsets.map((offset) => offset.id)) !== null && _b !== void 0 ? _b : [], failureReason(error, "Native scroll synchronization failed", "Native scroll synchronization failed."));
      } finally {
        if (!this.ended) {
          this.repairing = false;
          this.flushOffsets();
        }
      }
    }
  }
  class NativeIslandError extends Error {
    constructor(message) {
      super(message);
      this.code = "invalid_request";
      this.name = "NativeIslandError";
    }
  }
  function validateCommand(island, nativeComponent, command, properties) {
    if (!island) {
      throw new NativeIslandError("Invalid native island id.");
    }
    if (!nativeComponent) {
      throw new NativeIslandError("Invalid native component name.");
    }
    if (!command) {
      throw new NativeIslandError("Invalid native command.");
    }
    if (properties === void 0)
      return;
    if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
      throw new NativeIslandError("Native island properties must be a JSON object.");
    }
    let json;
    try {
      json = JSON.stringify(properties);
    } catch (_a) {
      throw new NativeIslandError("Native island properties must be JSON-compatible.");
    }
    if (json === void 0) {
      throw new NativeIslandError("Native island properties must be JSON-compatible.");
    }
  }
  function clipsOverflow(style) {
    return [style.overflowX, style.overflowY].some((value) => value === "hidden" || value === "clip");
  }
  function axisScrolls(overflow) {
    return overflow === "auto" || overflow === "scroll" || overflow === "hidden";
  }
  function clipsThroughPaintContainment(style) {
    return /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(style.getPropertyValue("contain").trim());
  }
  function hasOverflowClipMargin(style) {
    const clipMargin = style.getPropertyValue("overflow-clip-margin").trim();
    return clipMargin !== "" && clipMargin !== "0" && clipMargin !== "0px";
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
        if (node !== document.body && node !== document.documentElement && scrolls(node, style))
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
    const individualTransform = ["translate", "scale", "rotate"].some((property) => propertyIsActive(style, property)) || willChange.has("transform");
    return active(style.transform) || individualTransform || active(style.perspective) || active(style.filter) || active(style.getPropertyValue("backdrop-filter")) || contain.has("layout") || contain.has("paint") || contain.has("strict") || contain.has("content") || style.contentVisibility === "auto" || style.contentVisibility === "hidden" || willChange.has("perspective") || willChange.has("filter");
  }
  function overflowClipShape(node, style, around) {
    var _a;
    const bounds = readBounds(node);
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const radii = (_a = cssCornerRadii(style, width, height)) !== null && _a !== void 0 ? _a : inscribedCornerRadii(style, width, height);
    const [borderTop, borderRight, borderBottom, borderLeft] = borderWidths(style);
    const innerRadii = insetRadii(radii, Math.min(borderTop, borderRight, borderBottom, borderLeft));
    const paintContains = clipsThroughPaintContainment(style);
    const hasRadii = innerRadii.some((radius) => radius > 0);
    const clipsX = paintContains || hasRadii || style.overflowX !== "visible";
    const clipsY = paintContains || hasRadii || style.overflowY !== "visible";
    const margin = overflowClipMargin(style);
    const left = bounds.left + borderLeft - margin;
    const top = bounds.top + borderTop - margin;
    return {
      x: clipsX ? left : Math.min(left, around.left),
      y: clipsY ? top : Math.min(top, around.top),
      w: clipsX ? Math.max(0, width - borderLeft - borderRight + 2 * margin) : Math.max(bounds.right, around.right) - Math.min(left, around.left),
      h: clipsY ? Math.max(0, height - borderTop - borderBottom + 2 * margin) : Math.max(bounds.bottom, around.bottom) - Math.min(top, around.top),
      r: margin > 0 ? innerRadii.map((radius) => radius > 0 ? radius + margin : 0) : innerRadii
    };
  }
  function overflowClipMargin(style) {
    var _a;
    const length = ((_a = style.getPropertyValue("overflow-clip-margin")) !== null && _a !== void 0 ? _a : "").match(/(-?[\d.]+)px/);
    return length ? Math.max(0, Number.parseFloat(length[1])) : 0;
  }
  function clipOpaqueShapeContains(node, style, rect) {
    const inner = { x: rect.left, y: rect.top, w: rect.right - rect.left, h: rect.bottom - rect.top };
    return opaqueContainsRect(overflowClipShape(node, style, rect), inner);
  }
  function clipPathShape(node, style) {
    var _a;
    const value = ((_a = style.clipPath) !== null && _a !== void 0 ? _a : "").trim();
    const match = value.match(/^(inset|circle|ellipse)\((.*)\)(?:\s+[a-z-]+)?$/);
    if (!match)
      return null;
    const bounds = readBounds(node);
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const length = (part, basis) => {
      var _a2;
      return (_a2 = cssLength(part !== null && part !== void 0 ? part : "0", basis)) !== null && _a2 !== void 0 ? _a2 : 0;
    };
    const [shape, args] = [match[1], match[2]];
    if (shape === "inset") {
      const [box, round] = args.split(/\s+round\s+/);
      const parts = box.trim().split(/\s+/);
      const [top, right = top, bottom = top, left = right] = parts;
      const t = length(top, height);
      const r = length(right, width);
      const b = length(bottom, height);
      const l = length(left, width);
      const w = Math.max(0, width - l - r);
      const h = Math.max(0, height - t - b);
      const radius2 = round ? length(round.trim().split(/\s+/)[0], Math.min(w, h)) : 0;
      return { x: bounds.left + l, y: bounds.top + t, w, h, r: fitRadii([radius2, radius2, radius2, radius2], w, h) };
    }
    const [size, at = "50% 50%"] = args.split(/\s+at\s+/);
    const [cx, cy = cx] = at.trim().split(/\s+/);
    const centreX = bounds.left + length(cx, width);
    const centreY = bounds.top + length(cy, height);
    const sizes = size.trim() === "" ? [] : size.trim().split(/\s+/);
    const side = (part, basis, near, far) => part === void 0 || part === "closest-side" ? Math.min(near, far) : part === "farthest-side" ? Math.max(near, far) : length(part, basis);
    const rx = shape === "circle" ? side(sizes[0], Math.hypot(width, height) / Math.SQRT2, Math.min(centreX - bounds.left, centreY - bounds.top), Math.min(bounds.right - centreX, bounds.bottom - centreY)) : side(sizes[0], width, centreX - bounds.left, bounds.right - centreX);
    const ry = shape === "circle" ? rx : side(sizes[1], height, centreY - bounds.top, bounds.bottom - centreY);
    const radius = Math.min(rx, ry);
    return { x: centreX - rx, y: centreY - ry, w: 2 * rx, h: 2 * ry, r: [radius, radius, radius, radius] };
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
    const border = borderWidths(style);
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
      if (!clipsOverflow(style) && !clipsThroughPaintContainment(style))
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
  const alphas = /* @__PURE__ */ new Map();
  const ALPHAS_KEPT = 512;
  function colorAlpha(value) {
    const known = alphas.get(value);
    if (known !== void 0)
      return known;
    const alpha = readColorAlpha(value);
    if (alphas.size >= ALPHAS_KEPT)
      alphas.clear();
    alphas.set(value, alpha);
    return alpha;
  }
  function readColorAlpha(value) {
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
  function isTransparent(color) {
    return color === "transparent" || color === "rgba(0, 0, 0, 0)";
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
    const alphas2 = colors.map(colorAlpha);
    if (alphas2.some((alpha2) => alpha2 === null))
      return null;
    const base = Math.max(0, alphas2.lastIndexOf(1));
    const shown = colors.slice(base).filter((_, index) => {
      var _a;
      return ((_a = alphas2[base + index]) !== null && _a !== void 0 ? _a : 0) > 0;
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
  function opaqueHexColor(value) {
    const color = srgba(value);
    if (!color || color[3] !== 1)
      return null;
    const channels = color.slice(0, 3).map((channel) => Math.round(channel));
    if (channels.some((channel) => channel < 0 || channel > 255))
      return null;
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  let canvasProbe = null;
  function pageCanvasColor() {
    var _a, _b, _c;
    if (typeof getComputedStyle !== "function" || typeof matchMedia !== "function")
      return null;
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const painted = [rootStyle, document.body ? getComputedStyle(document.body) : null].find((style) => {
      var _a2;
      return style && ((_a2 = colorAlpha(style.backgroundColor)) !== null && _a2 !== void 0 ? _a2 : 0) > 0;
    });
    if (painted)
      return opaqueHexColor(painted.backgroundColor);
    const meta = (_c = (_b = (_a = document.querySelector) === null || _a === void 0 ? void 0 : _a.call(document, 'meta[name="color-scheme"]')) === null || _b === void 0 ? void 0 : _b.content) !== null && _c !== void 0 ? _c : "";
    const key = `${rootStyle.colorScheme}|${meta}|${matchMedia("(prefers-color-scheme: dark)").matches}`;
    if ((canvasProbe === null || canvasProbe === void 0 ? void 0 : canvasProbe.key) !== key) {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;width:0;height:0;background-color:Canvas";
      root.append(probe);
      canvasProbe = { key, color: opaqueHexColor(getComputedStyle(probe).backgroundColor) };
      probe.remove();
    }
    return canvasProbe.color;
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
  function resolveLength(value, size, pxScale = 1) {
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
    return result.px + result.fraction * size;
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
    const motion = transformOf(value, property, width, height, pxScale);
    return motion && motion.sx === 1 && motion.sy === 1 ? { x: motion.x, y: motion.y } : null;
  }
  function transformOf(value, property, width, height, pxScale = 1) {
    const text = value.trim();
    if (text === "" || text === "none")
      return { x: 0, y: 0, sx: 1, sy: 1 };
    const resolve = (length, size) => length === void 0 ? 0 : resolveLength(length, size, pxScale);
    if (property === "translate") {
      const parts = splitTopLevel(text, /\s/);
      if (parts.length > 3)
        return null;
      const x2 = resolve(parts[0], width);
      const y2 = resolve(parts[1], height);
      const z = parts[2] === void 0 ? 0 : resolve(parts[2], 0);
      return x2 === null || y2 === null || z === null ? null : { x: x2, y: y2, sx: 1, sy: 1 };
    }
    if (property === "scale") {
      const [sx2, sy2 = sx2, ...rest] = splitTopLevel(text, /\s/).map(scaleFactor);
      if (sx2 === null || sx2 === void 0 || sy2 === null || rest.length > 1 || rest.includes(null))
        return null;
      return { x: 0, y: 0, sx: sx2, sy: sy2 };
    }
    let x = 0;
    let y = 0;
    let sx = 1;
    let sy = 1;
    const functions = /([a-z0-9]+)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/gi;
    let consumed = 0;
    for (let match = functions.exec(text); match; match = functions.exec(text)) {
      if (text.slice(consumed, match.index).trim() !== "")
        return null;
      consumed = match.index + match[0].length;
      const step = transformStep(match[1].toLowerCase(), splitTopLevel(match[2], /,/), resolve, width, height, pxScale);
      if (!step)
        return null;
      if ((step.dx !== 0 || step.dy !== 0) && (sx !== 1 || sy !== 1))
        return null;
      x += step.dx;
      y += step.dy;
      sx *= step.fx;
      sy *= step.fy;
    }
    if (text.slice(consumed).trim() !== "" || consumed === 0)
      return null;
    return { x, y, sx, sy };
  }
  function transformStep(name, args, resolve, width, height, pxScale) {
    const step = (dx = 0, dy = 0, fx = 1, fy = 1) => dx === null || dy === null || fx === null || fy === null ? null : { dx, dy, fx, fy };
    if (name === "translate" && args.length <= 2)
      return step(resolve(args[0], width), resolve(args[1], height));
    if (name === "translatex" && args.length === 1)
      return step(resolve(args[0], width));
    if (name === "translatey" && args.length === 1)
      return step(0, resolve(args[0], height));
    if (name === "translatez" && args.length === 1)
      return resolve(args[0], 0) === null ? null : step();
    if (name === "translate3d" && args.length === 3) {
      if (resolve(args[2], 0) === null)
        return null;
      return step(resolve(args[0], width), resolve(args[1], height));
    }
    if (name === "scale" && args.length <= 2 || name === "scale3d" && args.length === 3) {
      if (name === "scale3d" && scaleFactor(args[2]) === null)
        return null;
      const fx = scaleFactor(args[0]);
      return step(0, 0, fx, name === "scale" && args.length === 1 ? fx : scaleFactor(args[1]));
    }
    if (name === "scalex" && args.length === 1)
      return step(0, 0, scaleFactor(args[0]));
    if (name === "scaley" && args.length === 1)
      return step(0, 0, 1, scaleFactor(args[0]));
    if (name === "matrix" || name === "matrix3d") {
      const values = args.map(Number);
      if (values.length !== (name === "matrix" ? 6 : 16) || !values.every(Number.isFinite))
        return null;
      const offDiagonal = name === "matrix" ? [1, 2] : [1, 2, 3, 4, 6, 7, 8, 9, 11];
      if (offDiagonal.some((entryIndex) => Math.abs(values[entryIndex]) > 1e-6))
        return null;
      if (name === "matrix3d" && Math.abs(values[15] - 1) > 1e-6)
        return null;
      return name === "matrix" ? step(values[4] * pxScale, values[5] * pxScale, values[0], values[3]) : step(values[12] * pxScale, values[13] * pxScale, values[0], values[5]);
    }
    return null;
  }
  function scaleFactor(value) {
    if (value === void 0)
      return null;
    const text = value.trim();
    const number = Number.parseFloat(text);
    if (!Number.isFinite(number) || !/^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?%?$/i.test(text))
      return null;
    return text.endsWith("%") ? number / 100 : number;
  }
  const nearZero = (value) => Math.abs(value) < 1e-5;
  const nearOne = (value) => Math.abs(value - 1) < 1e-5;
  const IDENTITY = [1, 0, 0, 1];
  function multiply([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2];
  }
  function isAxisAligned([, b, c]) {
    return nearZero(b) && nearZero(c);
  }
  function isIdentity$1(linear) {
    return isAxisAligned(linear) && nearOne(linear[0]) && nearOne(linear[3]);
  }
  function scaleOf([a, b, c, d]) {
    return [round4(Math.hypot(a, b)), round4(Math.hypot(c, d))];
  }
  function transformLinear(transform) {
    const match = transform.match(/^matrix(3d)?\(([^)]+)\)$/);
    if (!match)
      return IDENTITY;
    const values = match[2].split(",").map((value) => Number(value.trim()));
    if (!values.every(Number.isFinite))
      return IDENTITY;
    if (!match[1] && values.length === 6)
      return [values[0], values[1], values[2], values[3]];
    if (match[1] && values.length === 16)
      return [values[0], values[1], values[4], values[5]];
    return IDENTITY;
  }
  function scaleLinear(style) {
    const value = style.getPropertyValue("scale").trim();
    if (value === "" || value === "none")
      return IDENTITY;
    const [x, y = x] = value.split(/\s+/).map(scaleFactor);
    return x === null || y === null || x === void 0 ? IDENTITY : [x, 0, 0, y];
  }
  const ANGLE_UNITS = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 };
  function degrees(value) {
    var _a;
    const unit = value.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i);
    return unit ? Number(unit[1]) * ANGLE_UNITS[((_a = unit[2]) !== null && _a !== void 0 ? _a : "deg").toLowerCase()] : null;
  }
  function rotateLinear(style) {
    var _a;
    const value = style.getPropertyValue("rotate").trim();
    if (value === "" || value === "none")
      return IDENTITY;
    const parts = value.split(/\s+/);
    const turn = degrees((_a = parts[parts.length - 1]) !== null && _a !== void 0 ? _a : "");
    if (turn === null)
      return IDENTITY;
    const angle = turn * Math.PI / 180;
    const named = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const axis = parts.length === 1 ? named.z : parts.length === 2 ? named[parts[0].toLowerCase()] : parts.slice(0, 3).map(Number);
    const length = axis ? Math.hypot(...axis) : 0;
    if (!axis || !(length > 0))
      return IDENTITY;
    const [x, y, z] = axis.map((component) => component / length);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = 1 - cos;
    return [t * x * x + cos, t * x * y + z * sin, t * x * y - z * sin, t * y * y + cos];
  }
  function offsetRotateLinear(style) {
    var _a;
    const path = style.getPropertyValue("offset-path").trim();
    if (path === "" || path === "none")
      return IDENTITY;
    let turn = 0;
    for (const part of (style.getPropertyValue("offset-rotate").trim() || "auto").split(/\s+/)) {
      if (part === "auto" || part === "reverse")
        turn += pathDirection(path, style) + (part === "reverse" ? 180 : 0);
      else
        turn += (_a = degrees(part)) !== null && _a !== void 0 ? _a : 0;
    }
    const angle = turn * Math.PI / 180;
    return [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)];
  }
  function pathDirection(path, style) {
    var _a, _b;
    const ray = path.match(/^ray\(\s*(\S+)/);
    if (ray)
      return ((_a = degrees(ray[1])) !== null && _a !== void 0 ? _a : 90) - 90;
    const data = (_b = path.match(/^path\((?:\s*(?:nonzero|evenodd)\s*,)?\s*(["'])([^]*)\1\s*\)$/)) === null || _b === void 0 ? void 0 : _b[2];
    if (!data)
      return 0;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", data);
    const length = line.getTotalLength();
    if (!(length > 0))
      return 0;
    const distance = style.getPropertyValue("offset-distance").trim();
    const along = distance.endsWith("%") ? Number.parseFloat(distance) / 100 * length : Number.parseFloat(distance) || 0;
    const at = Math.min(Math.max(along, 0), length);
    const step = Math.min(0.5, length / 2);
    const from = line.getPointAtLength(Math.max(0, at - step));
    const to = line.getPointAtLength(Math.min(length, at + step));
    return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  }
  function ownLinear(style) {
    return multiply(offsetRotateLinear(style), multiply(rotateLinear(style), multiply(scaleLinear(style), transformLinear(style.transform))));
  }
  function drawnLinear(el) {
    return composedLinear(el).map(round4);
  }
  function composedLinear(el) {
    return planMemo$1("composedLinear", el, () => {
      const parent = composedParentElement(el);
      const own = ownLinear(computedStyle(el));
      return parent ? multiply(composedLinear(parent), own) : own;
    });
  }
  function inPerspective(style, parent) {
    var _a;
    const match = style.transform.match(/^matrix3d\(([^)]+)\)$/);
    const values = match ? match[1].split(",").map((value) => Number(value.trim())) : null;
    if (values && [3, 7, 11].some((index) => !nearZero(values[index])))
      return true;
    const perspective = (_a = parent === null || parent === void 0 ? void 0 : parent.getPropertyValue("perspective").trim()) !== null && _a !== void 0 ? _a : "none";
    if (perspective === "" || perspective === "none")
      return false;
    const rotate = style.getPropertyValue("rotate").trim().split(/\s+/);
    const turnsInDepth = rotate.length > 1 && rotate[0].toLowerCase() !== "z";
    return turnsInDepth || !!values && [2, 6, 8, 9].some((index) => !nearZero(values[index]));
  }
  function translatesInPlane(style) {
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
  function isZoomed(style) {
    const zoom = style.getPropertyValue("zoom").trim();
    return zoom !== "" && zoom !== "1" && zoom !== "normal";
  }
  function onlyTranslates(style) {
    return isIdentity$1(ownLinear(style)) && isPlaneTranslation(style.transform) && translatesInPlane(style) && !hasMotionPath(style) && !isZoomed(style);
  }
  function isPlaneTranslation(transform) {
    const match = transform.match(/^matrix3d\(([^)]+)\)$/);
    if (!match)
      return true;
    const values = match[1].split(",").map((value) => Number(value.trim()));
    return values.length === 16 && [2, 3, 6, 7, 8, 9, 11, 14].every((index) => nearZero(values[index])) && nearOne(values[10]) && nearOne(values[15]);
  }
  function hasRootContainment(style) {
    return propertyIsActive(style, "contain") || propertyIsActive(style, "content-visibility", "visible") || propertyIsActive(style, "container-type", "normal");
  }
  function hasBackgroundImage(style) {
    return style.backgroundImage !== "" && style.backgroundImage !== "none";
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
    if (hasBackgroundImage(rootStyle) || colorAlpha(rootStyle.backgroundColor) !== 0)
      return false;
    return !hasRootContainment(rootStyle) && !hasRootContainment(computedStyle(body));
  }
  function separableBackgroundPaint(style) {
    const image = style.backgroundImage.trim() || "none";
    const alpha = colorAlpha(style.backgroundColor);
    if ((alpha === null || alpha === 0) && image === "none")
      return null;
    const imageIsPortable = image === "none" || !/(?:url|image-set|cross-fade|element|paint)\s*\(/i.test(image) && /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(image);
    const layers = (value) => value.split(",").map((layer) => layer.trim());
    if (!imageIsPortable || layers(style.backgroundClip).some((value) => value !== "border-box") || layers(style.backgroundOrigin).some((value) => value !== "padding-box") || layers(style.backgroundAttachment).some((value) => value !== "scroll") || layers(style.backgroundBlendMode).some((value) => (value || "normal") !== "normal")) {
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
    const clips = style.backgroundClip.split(",").map((value) => value.trim()).filter(Boolean);
    return (_a = clips[clips.length - 1]) !== null && _a !== void 0 ? _a : "border-box";
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
    return ((_c = style.display) !== null && _c !== void 0 ? _c : "").includes("list-item") || (includeTranslucentFills ? fill > 0 : fill === 1) || hasBackgroundImage(style) || insetShadow(style) || style.borderImageSource != null && style.borderImageSource !== "" && style.borderImageSource !== "none" || propertyIsActive(style, "filter") || hasBackdropFilter(style) || borderWidths(style).some((width) => width > 0);
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
      return hasBorder || hasVisiblePseudoElement(el) || insetShadow(style) || hasTextShadow(style);
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
    return hasPaintOutsideBorderBox(el, style) || overflowPaintEscapes(el, style);
  }
  function hasPaintOutsideBorderBox(el, style) {
    return hasTextShadow(style) || pseudoPaintEscapes(el);
  }
  function overflowPaintEscapes(el, style) {
    const ownOutsetPaint = hasTextShadow(style) || propertyIsActive(style, "filter");
    return ownOutsetPaint || overflowsVisibly(el, style.overflowX === "visible", style.overflowY === "visible") && contentLeavesBox(el);
  }
  function styleEscapesBorderBox(el, style) {
    return hasTextShadow(style) || propertyIsActive(style, "filter") || pseudoPaintEscapes(el);
  }
  function overflowsVisibly(el, visibleX, visibleY) {
    return visibleX && el.scrollWidth > el.clientWidth + 1 || visibleY && el.scrollHeight > el.clientHeight + 1;
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
  let pseudoEscapes = /* @__PURE__ */ new WeakMap();
  function forgetPseudoPaint(element) {
    if (element)
      pseudoEscapes.delete(element);
    else
      pseudoEscapes = /* @__PURE__ */ new WeakMap();
  }
  function pseudoPaintEscapes(el) {
    const known = pseudoEscapes.get(el);
    if (known !== void 0)
      return known;
    const escapes = ["::before", "::after"].some((pseudo) => {
      var _a;
      const style = computedStyle(el, pseudo);
      if (!pseudoPaints(style))
        return false;
      const margins = [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft];
      return (style.position || "static") !== "static" || ((_a = style.display) !== null && _a !== void 0 ? _a : "").includes("list-item") || margins.some((margin) => Number.parseFloat(margin !== null && margin !== void 0 ? margin : "") < 0) || propertyIsActive(style, "transform") || propertyIsActive(style, "translate") || propertyIsActive(style, "filter") || style.textShadow !== void 0 && hasTextShadow(style) || hasOuterDecoration(style);
    });
    pseudoEscapes.set(el, escapes);
    return escapes;
  }
  const COLOR_STOP = /^([a-z-]+\([^()]*\)|#[\da-f]+|[a-z]+)(?:\s+(.+))?$/i;
  function soleLinearGradient(style) {
    var _a;
    const image = style.backgroundImage.trim();
    return splitTopLevel(image, /,/).length === 1 ? (_a = image.match(/^linear-gradient\((.*)\)$/)) === null || _a === void 0 ? void 0 : _a[1] : void 0;
  }
  function downwardStops(body) {
    var _a;
    const stops = splitTopLevel(body, /,/);
    if (/^(to bottom|180deg)$/.test((_a = stops[0]) !== null && _a !== void 0 ? _a : ""))
      stops.shift();
    return stops;
  }
  function opaqueGradientDepth(el, height) {
    var _a;
    const positions = opaqueGradientStops(el);
    if (positions === null)
      return null;
    let depth = 0;
    for (const position of positions)
      depth = Math.max(depth, (_a = resolveLength(position, height)) !== null && _a !== void 0 ? _a : 0);
    return depth > 0 ? Math.min(depth, height) : null;
  }
  function opaqueGradientStops(el) {
    const style = computedStyle(el);
    const body = soleLinearGradient(style);
    if (!body || colorAlpha(style.backgroundColor) !== 0 || backgroundColorClip(style) !== "border-box" || style.backgroundSize.trim() !== "auto" || !["0% 0%", "0px 0px", "left top"].includes(style.backgroundPosition.trim()) || borderWidths(style).some((width) => width !== 0) || hasPaintOutsideBorderBox(el, style)) {
      return null;
    }
    const positions = [];
    for (const stop of downwardStops(body)) {
      const match = stop.match(COLOR_STOP);
      if (!match || colorAlpha(match[1]) !== 1)
        break;
      if (match[2] === void 0)
        continue;
      if (resolveLength(match[2], 100) === null)
        return null;
      positions.push(match[2]);
    }
    return positions.length > 0 ? positions : null;
  }
  function alphaGradientStops(el, height) {
    var _a, _b, _c, _d;
    if (opaqueGradientDepth(el, height) === null)
      return null;
    const style = computedStyle(el);
    if (style.backgroundOrigin !== "padding-box" || style.backgroundAttachment !== "scroll" || style.backgroundBlendMode !== "normal")
      return null;
    const body = soleLinearGradient(style);
    if (!body)
      return null;
    const parts = downwardStops(body);
    const stops = [];
    for (const [index, part] of parts.entries()) {
      const match = part.match(COLOR_STOP);
      if (!match)
        return null;
      let position;
      if (match[2] !== void 0)
        position = resolveLength(match[2], height);
      else if (index === 0)
        position = 0;
      else if (index === parts.length - 1)
        position = height;
      else
        position = null;
      if (position === null || position < 0 || position > height || position / height < ((_b = (_a = stops[stops.length - 1]) === null || _a === void 0 ? void 0 : _a.offset) !== null && _b !== void 0 ? _b : 0))
        return null;
      stops.push({ color: match[1], offset: position / height });
    }
    if (((_c = stops[0]) === null || _c === void 0 ? void 0 : _c.offset) > 0)
      stops.unshift(Object.assign(Object.assign({}, stops[0]), { offset: 0 }));
    if (((_d = stops[stops.length - 1]) === null || _d === void 0 ? void 0 : _d.offset) !== 1 || stops.length < 2 || stops.length > 8)
      return null;
    return stops;
  }
  function fadesIn(element) {
    if (typeof element.getAnimations !== "function")
      return false;
    return element.getAnimations().some((animation) => {
      if (animation.playState === "finished" || animation.playState === "idle")
        return false;
      const effect = animation.effect;
      const frames = typeof (effect === null || effect === void 0 ? void 0 : effect.getKeyframes) === "function" ? effect.getKeyframes() : [];
      return frames.some((frame) => frame.opacity !== void 0 && Number.parseFloat(String(frame.opacity)) > 0);
    });
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
  function hasAncestorBackdropFilter(el) {
    for (let node = composedParentElement(el); node; node = composedParentElement(node)) {
      if (hasBackdropFilter(computedStyle(node)))
        return true;
    }
    return false;
  }
  function auditIslandComposition(el, modeledScrollContainers = []) {
    var _a;
    const scrollers = new Set(modeledScrollContainers);
    const islandRect = readBounds(el);
    const clips = [];
    const approximations = /* @__PURE__ */ new Set();
    let scrollClip = null;
    for (let node = el; node; node = composedParentElement(node)) {
      const style = computedStyle(node);
      if (Number.parseFloat(style.opacity) === 0 && !fadesIn(node))
        return { transparent: true, clips: [], approximations: [] };
      const parent = composedParentElement(node);
      if (hasDetachedEffect(style) || !runtimeOwnsMask(node, style) && (propertyIsActive(style, "mask-image") || propertyIsActive(style, "-webkit-mask-image")))
        approximations.add("effects");
      if (inPerspective(style, parent ? computedStyle(parent) : null))
        approximations.add("perspective");
      const isViewportRoot = isViewportRootElement(node, style);
      const overflowClips = clipsOverflow(style);
      const paintContains = clipsThroughPaintContainment(style);
      const modeledScrollClip = scrollers.has(node) && (overflowClips || axisScrolls(style.overflowX) || axisScrolls(style.overflowY)) && !paintContains && !hasOverflowClipMargin(style);
      if (modeledScrollClip) {
        scrollClip = { bounds: readBounds(node), port: paddingBox(node), moves: false };
      } else if (scrollClip && (style.position === "fixed" || style.position === "sticky")) {
        scrollClip.moves = true;
      }
      if (node !== el && !isViewportRoot && (overflowClips || paintContains) && !modeledScrollClip && (hasOverflowClipMargin(style) || !clipHoldsIsland(node, style, islandRect, scrollClip))) {
        clips.push({ el: node, rect: overflowClipShape(node, style, islandRect) });
      }
      const clipPath = ((_a = style.clipPath) !== null && _a !== void 0 ? _a : "").trim();
      if (clipPath !== "" && clipPath !== "none" && !runtimeOwnsClip(node, style)) {
        const shape = clipPathShape(node, style);
        if (shape)
          clips.push({ el: node, rect: shape });
        if (!shape || clipPath.startsWith("ellipse") && Math.abs(shape.w - shape.h) > 0.5)
          approximations.add("clip-shape");
      }
    }
    return { transparent: false, clips, approximations: [...approximations] };
  }
  function clipHoldsIsland(node, style, islandRect, scrollClip) {
    return clipOpaqueShapeContains(node, style, islandRect) || clipsOnlyOffscreen(node, style) || !!scrollClip && !scrollClip.moves && (clipOpaqueShapeContains(node, style, scrollClip.bounds) || roundsScrollport(node, style, scrollClip.port));
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
  function auditWebLayerCutoutComposition(el, modeledScrollContainers = [], { backgroundOnly = false, allowViewportPosition = false } = {}) {
    return auditWebLayer(el, modeledScrollContainers, { backgroundOnly, allowViewportPosition, followSticky: false });
  }
  function auditWebPaintAboveUnderlay(el, modeledScrollContainers, allowViewportPosition, island) {
    return walkWebLayer(el, modeledScrollContainers, { backgroundOnly: true, allowViewportPosition, followSticky: false }, island);
  }
  function auditWebLayer(el, containers, audit) {
    var _a, _b;
    const successful = readMemo("successfulWebAudits", el, () => []);
    const reused = successful.find((entry) => entry.audit.backgroundOnly === audit.backgroundOnly && entry.audit.allowViewportPosition === audit.allowViewportPosition && entry.audit.followSticky === audit.followSticky && entry.containers.length === containers.length && entry.containers.every((container, index) => container === containers[index]));
    if (reused) {
      geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.push(...reused.facts);
      return null;
    }
    const firstFact = (_a = geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.length) !== null && _a !== void 0 ? _a : 0;
    const issue = walkWebLayer(el, containers, audit, null);
    if (issue === null) {
      successful.push({ containers: [...containers], audit, facts: (_b = geometryFacts === null || geometryFacts === void 0 ? void 0 : geometryFacts.slice(firstFact)) !== null && _b !== void 0 ? _b : [] });
    }
    return issue;
  }
  const TRANSLUCENT_LAYER = "translucent, filtered, blended, clipped, or masked web layers cannot use box-shaped native cutouts";
  function walkWebLayer(el, containers, audit, aboveIsland) {
    const scrollers = new Set(containers);
    let clipSource2 = el;
    let stickyAllowed = audit.followSticky;
    for (let node = el; node; node = composedParentElement(node)) {
      const style = computedStyle(node);
      if (style.position === "sticky" && stickyAllowed) {
        stickyAllowed = false;
      } else if (style.position === "sticky" || !audit.allowViewportPosition && style.position === "fixed") {
        return {
          reason: "fixed and sticky web layers cannot use document-space native cutouts",
          mayMoveWithoutRefresh: true
        };
      }
      if (aboveIsland === null && Number.parseFloat(style.opacity) !== 1 || readStyleFact("webCutoutEffects", style, () => hasDetachedEffect(style)) || !runtimeOwnsClip(node, style) && propertyIsActive(style, "clip-path") || !runtimeOwnsMask(node, style) && (propertyIsActive(style, "mask-image") || propertyIsActive(style, "-webkit-mask-image"))) {
        return { reason: TRANSLUCENT_LAYER, mayMoveWithoutRefresh: false };
      }
      if (!readStyleFact("webCutoutTransforms", style, () => onlyTranslates(style))) {
        return {
          reason: "opaque web surface coordinates are unsafe under 3D translation, scale, rotation, skew, perspective, motion paths, or zoom",
          mayMoveWithoutRefresh: false
        };
      }
      if (node === el && !(node === document.documentElement || node === document.body && bodyBackgroundPropagates()) && !audit.backgroundOnly && geometryFact(() => overflowPaintEscapes(el, computedStyle(el)))) {
        return {
          reason: "web surfaces with out-of-bounds paint or visible overflow cannot use a box-bounded cutout",
          mayMoveWithoutRefresh: false
        };
      }
      const paintContains = clipsThroughPaintContainment(style);
      if (node !== el && !isViewportRootElement(node, style) && (clipsOverflow(style) || paintContains) && !isModeledScrollClip(scrollers, node, style) && !(aboveIsland !== null && containsComposed(node, aboveIsland)) && (hasOverflowClipMargin(style) || !geometryFact(clipHoldsLayer(node, clipSource2)))) {
        return {
          reason: `opaque web surface coordinates are unsafe under a partially clipping ${paintContains ? "paint-containment" : "overflow"} ancestor`,
          mayMoveWithoutRefresh: false
        };
      }
      if (scrollers.has(node))
        clipSource2 = node;
    }
    return null;
  }
  function hasFilterOrBlend(style) {
    return propertyIsActive(style, "filter") || propertyIsActive(style, "mix-blend-mode", "normal");
  }
  function hasDetachedEffect(style) {
    return hasFilterOrBlend(style) || hasBackdropFilter(style);
  }
  function isModeledScrollClip(scrollers, node, style) {
    return scrollers.has(node) && clipsOverflow(style) && !clipsThroughPaintContainment(style) && !hasOverflowClipMargin(style);
  }
  function clipHoldsLayer(node, source) {
    return () => {
      const style = computedStyle(node);
      return clipOpaqueShapeContains(node, style, readBounds(source)) || clipsOnlyOffscreen(node, style);
    };
  }
  function automaticWebLayerCutoutIssue(el, modeledScrollContainer = null, allowViewportPosition = false, requireOpaqueBox = false, followSticky = false) {
    const style = computedStyle(el);
    const alpha = colorAlpha(style.backgroundColor);
    if ((alpha === 0 || alpha === null) && !hasBackgroundImage(style) && !hasSparsePaint(el, style))
      return void 0;
    const audit = () => auditWebLayer(el, modeledScrollContainer ? [modeledScrollContainer] : [], {
      backgroundOnly: false,
      allowViewportPosition,
      followSticky
    });
    const opaqueBorderBox = alpha === 1 && backgroundColorClip(style) === "border-box";
    if (requireOpaqueBox && (!opaqueBorderBox || hasPaintOutsideBorderBox(el, style))) {
      const opaqueGradient = !opaqueBorderBox && opaqueGradientStops(el) !== null && audit() === null;
      return Object.assign({ reason: "web paint above an overlay island must be fully opaque across its bounded box", mayMoveWithoutRefresh: false }, opaqueGradient ? { opaqueGradient: true } : {});
    }
    if (el.children.length > 0 && (!opaqueBorderBox || hasPaintOutsideBorderBox(el, style))) {
      return {
        reason: "sparse, translucent, or partially painted web content cannot use a box-shaped native cutout",
        mayMoveWithoutRefresh: false
      };
    }
    return audit();
  }
  let sceneReadScope = null;
  function sceneScope() {
    return sceneReadScope;
  }
  function withoutSceneReadScope(read) {
    const previous = sceneReadScope;
    sceneReadScope = null;
    try {
      return read();
    } finally {
      sceneReadScope = previous;
    }
  }
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
    const own = el.hidden || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden" || Number.parseFloat(style.opacity) === 0 && !fadesIn(el);
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
    const probe = (options) => {
      try {
        return !!(visibilityProbe === null || visibilityProbe === void 0 ? void 0 : visibilityProbe.call(el, options));
      } catch (_a) {
        return false;
      }
    };
    if (typeof visibilityProbe === "function" ? !probe() : el.getClientRects().length === 0)
      return false;
    const { hidden, automatic } = styleVisibility(el);
    return !hidden && (!automatic || probe({ contentVisibilityAuto: true }));
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
      if (position === "fixed" || position === "sticky") {
        return { element: el, position, viewportFixed: position === "fixed" && isViewportFixed(el) };
      }
      const parent = composedParentElement(el);
      return parent ? fixedOrStickyAncestor(parent) : null;
    });
  }
  function rendered(element) {
    let at = element;
    while (at && typeof at.checkVisibility === "function") {
      if (at.checkVisibility())
        return true;
      if (computedStyle(at).display !== "contents")
        return false;
      at = at.parentElement;
    }
    return true;
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
  function composedAncestry(element) {
    const cached = sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.ancestors.get(element);
    if (cached)
      return cached;
    const visited = /* @__PURE__ */ new Set();
    let current = element;
    while (current && !visited.has(current)) {
      visited.add(current);
      current = composedParentElement(current);
    }
    sceneReadScope === null || sceneReadScope === void 0 ? void 0 : sceneReadScope.ancestors.set(element, visited);
    return visited;
  }
  function isComposedAncestor(ancestor, element) {
    if (sceneReadScope)
      return composedAncestry(element).has(ancestor);
    const visited = /* @__PURE__ */ new Set();
    let current = element;
    while (current && !visited.has(current)) {
      if (current === ancestor)
        return true;
      visited.add(current);
      current = composedParentElement(current);
    }
    return false;
  }
  function hasComposedAncestorIn(element, ancestors) {
    for (const ancestor of composedAncestry(element)) {
      if (ancestors.has(ancestor))
        return true;
    }
    return false;
  }
  function zIndex(el) {
    const value = Number.parseInt(computedStyle(el).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }
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
  function modalBackdrops() {
    return Array.from(document.querySelectorAll("dialog")).filter((dialog) => {
      try {
        return dialog.matches(":modal");
      } catch (_a) {
        return false;
      }
    }).map((dialog) => ({ dialog, color: srgba(getComputedStyle(dialog, "::backdrop").backgroundColor) }));
  }
  function sameBox(left, right) {
    return left !== null && right !== null && Math.abs(left.x - right.x) < 0.5 && Math.abs(left.y - right.y) < 0.5 && Math.abs(left.w - right.w) < 0.5 && Math.abs(left.h - right.h) < 0.5;
  }
  function directTextIntersects(element, rect) {
    var _a;
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !((_a = node.textContent) === null || _a === void 0 ? void 0 : _a.trim()))
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const bounds of range.getClientRects()) {
        if (intersects(rect, clientToDocument(bounds))) {
          range.detach();
          return true;
        }
      }
      range.detach();
    }
    return false;
  }
  function pageScrollSize() {
    var _a, _b;
    const root = document.documentElement;
    const body = document.body;
    return {
      w: Math.max(root.scrollWidth, (_a = body === null || body === void 0 ? void 0 : body.scrollWidth) !== null && _a !== void 0 ? _a : 0),
      h: Math.max(root.scrollHeight, (_b = body === null || body === void 0 ? void 0 : body.scrollHeight) !== null && _b !== void 0 ? _b : 0)
    };
  }
  function documentCanvasRect() {
    const page = pageScrollSize();
    return {
      x: 0,
      y: 0,
      w: round2(Math.max(window.innerWidth, page.w)),
      h: round2(Math.max(window.innerHeight, page.h))
    };
  }
  const IDLE_FOLLOW_FRAMES = 30;
  const IDLE_FOLLOW_MS = 150;
  const WATCH_FRAMES = 30;
  const ACTIVE_WATCH_MS = 1e3;
  const IDLE_WATCH_MS = 250;
  const SCROLL_IDLE_MS = 100;
  function afterNextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }
  class FrameLoop {
    constructor(canRun, onFrame) {
      this.canRun = canRun;
      this.onFrame = onFrame;
      this.interval = 1e3 / 60;
      this.lastFrameTime = null;
      this.following = false;
      this.lastPlanAt = Number.NEGATIVE_INFINITY;
      this.asked = false;
      this.askedUrgently = false;
      this.asks = 0;
      this.unseen = [];
      this.unseenAt = -1;
      this.scheduled = false;
      this.watchFrames = 0;
      this.activeUntil = Number.NEGATIVE_INFINITY;
      this.idleWatch = null;
      this.lookAgain = false;
      this.idleFollowFrames = 0;
      this.lastScrollAt = Number.NEGATIVE_INFINITY;
    }
    schedule() {
      if (!this.canRun() || this.scheduled)
        return;
      this.scheduled = true;
      requestAnimationFrame((frameTime) => {
        this.scheduled = false;
        this.onFrame(frameTime);
      });
    }
    /** A plan is asked for: the next frame plans. */
    ask() {
      this.askedUrgently = true;
      this.asks += 1;
      this.asked = true;
      this.wake();
    }
    /**
     * A page change at `hosts` asks for a plan, without making it urgent. `deferrable`: the plan may
     * be withdrawn as the frame starts if nothing else asked for it.
     */
    askForChange(hosts, deferrable) {
      const deferring = deferrable && (!this.asked || this.unseen.length > 0 && this.unseenAt === this.asks);
      const urgent = this.askedUrgently;
      this.ask();
      this.askedUrgently = urgent;
      if (deferring) {
        this.unseen.push(...hosts);
        this.unseenAt = this.asks;
      } else {
        this.unseen = [];
      }
    }
    /** Whether a plan is asked for. */
    get requested() {
      return this.asked;
    }
    /** Asked for with a cause besides a page change, which a curtain does not hold back. */
    get urgent() {
      return this.askedUrgently;
    }
    /** A plan is being made: what asked for it is answered. */
    taken() {
      this.asked = false;
      this.askedUrgently = false;
    }
    /**
     * A frame starts at `frameTime`. A plan asked for only by changes inside subtrees the browser does
     * not render is withdrawn. Returns false when no plan is asked for and the page is hidden, so the
     * frame is not looked at.
     */
    beginFrame(frameTime) {
      this.withdrawUnseen();
      if (!this.asked && document.visibilityState === "hidden")
        return false;
      this.noteFrame(frameTime);
      return true;
    }
    /** The page was touched: frames are looked at for ACTIVE_WATCH_MS from now. */
    wake() {
      this.activeUntil = performance.now() + ACTIVE_WATCH_MS;
      if (this.idleWatch !== null) {
        clearTimeout(this.idleWatch);
        this.idleWatch = null;
      }
      this.schedule();
    }
    /**
     * A frame found nothing to plan: the next is looked at while the scene is followed, the page
     * was touched, or a plan was just made; else, while `islands` can show, in IDLE_WATCH_MS.
     */
    idleFrame(islands) {
      const showable = islands();
      if (this.following || showable && this.active || this.watching())
        this.schedule();
      else if (showable)
        this.idle(false);
    }
    /**
     * A frame found every island away: one a plan was asked for is watched afterwards as a plan would
     * be, and the ask is dropped. While `islands` can show, the page is read again in IDLE_WATCH_MS.
     */
    awayFrame(islands) {
      const requested = this.asked;
      this.asked = false;
      if (requested)
        this.watch();
      if (this.watching())
        this.schedule();
      else if (islands())
        this.idle(true);
    }
    get active() {
      return performance.now() < this.activeUntil;
    }
    /** Looks again in IDLE_WATCH_MS; `lookAgain` has a page whose islands are away read again then. */
    idle(lookAgain) {
      if (this.idleWatch !== null)
        return;
      this.idleWatch = setTimeout(() => {
        this.idleWatch = null;
        if (lookAgain)
          this.lookAgain = true;
        this.schedule();
      }, IDLE_WATCH_MS);
    }
    takeLookAgain() {
      const look = this.lookAgain;
      this.lookAgain = false;
      return look;
    }
    /** How long before `frameTime` the last plan was made. */
    sincePlan(frameTime) {
      return frameTime - this.lastPlanAt;
    }
    noteFrame(frameTime) {
      if (!Number.isFinite(frameTime))
        return;
      if (this.lastFrameTime !== null) {
        const interval = frameTime - this.lastFrameTime;
        if (interval >= 4 && interval <= 50)
          this.interval = this.interval * 0.9 + interval * 0.1;
      }
      this.lastFrameTime = frameTime;
    }
    noteScroll() {
      this.lastScrollAt = performance.now();
    }
    get scrolling() {
      return performance.now() - this.lastScrollAt < SCROLL_IDLE_MS;
    }
    /** Frames after a plan are looked at for WATCH_FRAMES more. */
    watch() {
      this.watchFrames = WATCH_FRAMES;
    }
    /** Counts one watched frame off; whether any remain. */
    watching() {
      return --this.watchFrames > 0;
    }
    /** Whether a followed scene is due a plan at `frameTime`; motion `started` this frame restarts the count. */
    followDue(frameTime, started) {
      if (started)
        this.idleFollowFrames = 0;
      return this.following && (this.idleFollowFrames < IDLE_FOLLOW_FRAMES || frameTime - this.lastPlanAt >= IDLE_FOLLOW_MS);
    }
    /** A plan was made at `frameTime`; a followed scene planned the same again counts toward idling. */
    planned(frameTime, unchanged) {
      this.lastPlanAt = frameTime;
      this.watch();
      this.idleFollowFrames = this.following && unchanged ? this.idleFollowFrames + 1 : 0;
    }
    withdrawUnseen() {
      if (this.unseen.length === 0)
        return;
      const unseen = this.unseenAt === this.asks && !this.unseen.some((host) => rendered(host));
      this.unseen = [];
      if (!unseen)
        return;
      trace("unseen");
      this.asked = false;
    }
  }
  const INACTIVE_ATTRIBUTE = "data-native-islands-inactive";
  const APPROXIMATED_ATTRIBUTE = "data-native-islands-approximated";
  class IslandStatus {
    constructor(writes) {
      this.writes = writes;
      this.ready = [];
      this.resumeSince = /* @__PURE__ */ new Map();
    }
    present(natives) {
      var _a;
      this.ready = [];
      for (const native of natives) {
        const { handle, inactiveReason } = native;
        this.setApproximations(handle, native.active ? (_a = native.approximations) !== null && _a !== void 0 ? _a : [] : []);
        if (inactiveReason === null && native.active && native.el.hasAttribute(INACTIVE_ATTRIBUTE)) {
          this.ready.push(handle);
          continue;
        }
        this.setInactive(handle, inactiveReason);
      }
    }
    /** The islands the last presentation found ready to show again; the plan that sends them owns them now. */
    takeReady() {
      const ready = this.ready;
      this.ready = [];
      for (const handle of Array.from(this.resumeSince.keys())) {
        if (!ready.includes(handle))
          this.resumeSince.delete(handle);
      }
      return ready;
    }
    /** `resuming` went to native in the layout with `sequence`. */
    noteSent(resuming, sequence) {
      for (const handle of resuming) {
        if (!this.resumeSince.has(handle))
          this.resumeSince.set(handle, sequence);
      }
    }
    /** Hides the fallbacks of islands native now shows again. */
    resume(resuming) {
      for (const handle of resuming) {
        this.resumeSince.delete(handle);
        if (handle.el.isConnected)
          this.setInactive(handle, null);
      }
    }
    /** Native applied `layout`, a superseded plan's: it still shows the islands it resumes. */
    resumeShownBy(layout, sequence) {
      for (const [handle, since] of Array.from(this.resumeSince)) {
        if (sequence < since)
          continue;
        if (!layout.components.some((component) => component.id === handle.islandId && component.active))
          continue;
        this.resumeSince.delete(handle);
        if (handle.el.isConnected)
          this.setInactive(handle, null);
      }
    }
    setApproximations(handle, approximations) {
      const value = approximations.length > 0 ? Array.from(new Set(approximations)).sort().join(" ") : null;
      if (handle.el.getAttribute(APPROXIMATED_ATTRIBUTE) === value)
        return;
      if (value === null)
        handle.el.removeAttribute(APPROXIMATED_ATTRIBUTE);
      else
        handle.el.setAttribute(APPROXIMATED_ATTRIBUTE, value);
      this.writes.attribute(handle.el, APPROXIMATED_ATTRIBUTE);
    }
    setInactive(handle, reason) {
      const previous = handle.el.getAttribute(INACTIVE_ATTRIBUTE);
      handle.setNativeInactive(reason);
      if (handle.el.getAttribute(INACTIVE_ATTRIBUTE) !== previous)
        this.writes.attribute(handle.el, INACTIVE_ATTRIBUTE);
    }
  }
  function isVisibleInScroller(component, previous, next) {
    if (!component.rect || component.scrollPath.length === 0)
      return true;
    const scrollerFor = (id) => {
      var _a;
      return (_a = next.scrollContainers.find((entry) => entry.id === id)) !== null && _a !== void 0 ? _a : previous.scrollContainers.find((entry) => entry.id === id);
    };
    let x = component.rect.x;
    let y = component.rect.y;
    for (const id of component.scrollPath) {
      const scroller = scrollerFor(id);
      if (!scroller)
        continue;
      x -= scroller.offsetX;
      y -= scroller.offsetY;
    }
    for (const id of component.scrollPath) {
      const scroller = scrollerFor(id);
      if (!scroller || scroller.rect.w <= 0 || scroller.rect.h <= 0)
        continue;
      let scrollerX = scroller.rect.x;
      let scrollerY = scroller.rect.y;
      for (const ancestorId of scroller.scrollPath) {
        const ancestor = scrollerFor(ancestorId);
        if (!ancestor)
          continue;
        scrollerX -= ancestor.offsetX;
        scrollerY -= ancestor.offsetY;
      }
      if (x + component.rect.w <= scrollerX || x >= scrollerX + scroller.rect.w || y + component.rect.h <= scrollerY || y >= scrollerY + scroller.rect.h) {
        return false;
      }
    }
    return true;
  }
  function retirementOf(previous, next, covered) {
    var _a, _b;
    if (!previous)
      return null;
    const shown = new Set(next.components.filter((component) => component.active).map((component) => component.id));
    const retired = new Set(previous.components.filter((component) => component.active && isVisibleInScroller(component, previous, next) && (!shown.has(component.id) || covered.has(component.id) && component.plane === "overlay")).map((component) => component.id));
    if (retired.size === 0)
      return null;
    const keep = (regions) => regions && Object.fromEntries(Object.entries(regions).filter(([id]) => !retired.has(id)));
    return Object.assign(Object.assign({}, previous), { components: previous.components.map((component) => retired.has(component.id) ? Object.assign(Object.assign({}, component), { active: false }) : component), order: previous.order.filter((id) => !retired.has(id)), cutouts: (_a = keep(previous.cutouts)) !== null && _a !== void 0 ? _a : {}, exclusions: (_b = keep(previous.exclusions)) !== null && _b !== void 0 ? _b : {}, tints: keep(previous.tints), panes: previous.panes && Object.fromEntries(Object.entries(previous.panes).map(([id, pane]) => [
      id,
      pane.under !== void 0 && retired.has(pane.under) ? { color: pane.color } : pane
    ])) });
  }
  function sameScrollerIds(before, after) {
    return before.length === after.length && before.every((container, index) => container.id === after[index].id);
  }
  const BOX_KEYS = /* @__PURE__ */ new Set(["x", "y", "w", "h"]);
  function onPixels(dpr) {
    return (key, value) => typeof value === "number" && BOX_KEYS.has(key) ? Math.round(value * dpr) : value;
  }
  function structuralSignature$1(payload, mode) {
    const pixels = onPixels(typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
    if (mode !== "bridge")
      return JSON.stringify(payload, pixels);
    return JSON.stringify(Object.assign(Object.assign({}, payload), { scrollContainers: payload.scrollContainers.map((container) => Object.assign(Object.assign({}, container), { offsetX: 0, offsetY: 0 })) }), pixels);
  }
  function withMotionsHeld(sent, held) {
    var _a;
    return Object.assign(Object.assign({}, sent), { motions: (_a = sent.motions) === null || _a === void 0 ? void 0 : _a.map((motion) => Object.assign(Object.assign({}, motion), { animations: motion.animations.map((animation) => held.has(animation) ? Object.assign(Object.assign({}, animation), { keyframes: animation.keyframes.map((frame) => Object.assign(Object.assign({}, frame), { value: animation.keyframes[0].value })) }) : animation) })) });
  }
  let scriptScrollersAtRest = false;
  function withScriptScrollersAtRest(atRest, read) {
    scriptScrollersAtRest = atRest;
    try {
      return read();
    } finally {
      scriptScrollersAtRest = false;
    }
  }
  function scrollsOnlyFromScript(style) {
    return ![style.overflowX, style.overflowY].some((value) => value === "auto" || value === "scroll");
  }
  const scrollAxes = /* @__PURE__ */ new WeakMap();
  function physicalScrollOffset(element) {
    var _a, _b;
    const cached = (_a = sceneScope()) === null || _a === void 0 ? void 0 : _a.scrollOffsets.get(element);
    if (cached)
      return cached;
    let axes = sceneScope() ? void 0 : scrollAxes.get(element);
    if (!axes) {
      const style = computedStyle(element);
      axes = {
        horizontalReversed: style.direction === "rtl" || style.flexDirection === "row-reverse",
        verticalReversed: style.flexDirection === "column-reverse",
        scriptOnly: scrollsOnlyFromScript(style)
      };
      scrollAxes.set(element, axes);
    }
    if (scriptScrollersAtRest && axes.scriptOnly)
      return { x: 0, y: 0 };
    const { horizontalReversed, verticalReversed } = axes;
    const offset = {
      x: round2(horizontalReversed ? element.scrollWidth - element.clientWidth + element.scrollLeft : element.scrollLeft),
      y: round2(verticalReversed ? element.scrollHeight - element.clientHeight + element.scrollTop : element.scrollTop)
    };
    (_b = sceneScope()) === null || _b === void 0 ? void 0 : _b.scrollOffsets.set(element, offset);
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
    return basis.coordinateSpace === "viewport" ? rectInScrollPathCoordinates(viewportRect(element), basis.scrollPath) : rectInScrollPathCoordinates(docRect(element), basis.scrollPath);
  }
  function scrollPath(element) {
    return independentScrollContainers(element).reverse();
  }
  function innermostScroller(path) {
    var _a;
    return (_a = path[path.length - 1]) !== null && _a !== void 0 ? _a : null;
  }
  function sameScrollPath(left, right) {
    return left.length === right.length && left.every((element, index) => element === right[index]);
  }
  function startsWithScrollPath(path, prefix) {
    return prefix.length <= path.length && prefix.every((element, index) => element === path[index]);
  }
  function commonScrollPrefixLength(left, right) {
    const shared = Math.min(left.length, right.length);
    let index = 0;
    while (index < shared && left[index] === right[index])
      index += 1;
    return index;
  }
  function clippedPaintBound(side) {
    var _a, _b;
    const cached = side.el && ((_a = sceneScope()) === null || _a === void 0 ? void 0 : _a.clippedBounds.get(side.el));
    if (cached && sameCoordinatePath(cached, side))
      return cached.rect;
    const rect = readClippedPaintBound(side);
    if (side.el)
      (_b = sceneScope()) === null || _b === void 0 ? void 0 : _b.clippedBounds.set(side.el, {
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
      if (["hidden", "clip"].includes(style.overflowX) && ["hidden", "clip"].includes(style.overflowY) && !hasOverflowClipMargin(style) && ((_a = fixedOrStickyAncestor(ancestor)) === null || _a === void 0 ? void 0 : _a.position) !== "sticky" && sameCoordinatePath(side, coordinateBasis(ancestor))) {
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
      if (el.childNodes.length === 0 || Array.from(el.childNodes).some((node) => node.nodeType !== Node.TEXT_NODE) || el.shadowRoot || el.getRootNode() instanceof ShadowRoot || style.display.includes("list-item") || ((_a2 = fixedOrStickyAncestor(el)) === null || _a2 === void 0 ? void 0 : _a2.position) === "sticky" || hasOuterDecoration(style) || hasTextShadow(style) || hasVisiblePseudoElement(el, true) || typeof document.createRange !== "function")
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
      return union(docRect(el), clientToDocument(bounds));
    });
  }
  function reachableBound(side, sharedDepth) {
    var _a, _b, _c;
    const outermostUnmatched = side.scrollPath[sharedDepth];
    if (outermostUnmatched !== void 0) {
      const scrollport = scrollContainerRect(outermostUnmatched);
      if (!scrollport || side.scrollPath.length !== sharedDepth + 1 || side.paintEscapesRect || !side.paintRect)
        return scrollport;
      let travelX = (_a = sceneScope()) === null || _a === void 0 ? void 0 : _a.horizontalTravel.get(outermostUnmatched);
      if (travelX === void 0) {
        travelX = Math.max(0, outermostUnmatched.scrollWidth - outermostUnmatched.clientWidth);
        (_b = sceneScope()) === null || _b === void 0 ? void 0 : _b.horizontalTravel.set(outermostUnmatched, travelX);
      }
      if (!Number.isFinite(travelX))
        return scrollport;
      return Object.assign(Object.assign({}, scrollport), { x: side.paintRect.x - travelX, w: side.paintRect.w + travelX * 2 });
    }
    return side.paintEscapesRect ? escapingPaintBound(side) : (_c = side.paintRect) !== null && _c !== void 0 ? _c : null;
  }
  function sameCoordinatePath(left, right) {
    return left.coordinateSpace === right.coordinateSpace && sameScrollPath(left.scrollPath, right.scrollPath);
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
  function stationaryCoordinatePaths(left, right) {
    if (sameCoordinatePath(left, right))
      return true;
    if (left.scrollPath.length > 0 || right.scrollPath.length > 0)
      return false;
    const root = document.scrollingElement;
    return root != null && root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight;
  }
  function staticallyAbove(outer, inner) {
    if (outer.coordinateSpace !== inner.coordinateSpace || !startsWithScrollPath(inner.scrollPath, outer.scrollPath))
      return false;
    return inner.scrollPath.slice(outer.scrollPath.length).every((element) => {
      const style = computedStyle(element);
      return [style.overflowX, style.overflowY].every((value) => value === "hidden" || value === "clip");
    });
  }
  function scrollPathOffset(path) {
    return path.reduce((total, element) => {
      const offset = physicalScrollOffset(element);
      const [a, b, c, d] = drawnLinear(element);
      total.x += a * offset.x + c * offset.y;
      total.y += b * offset.x + d * offset.y;
      return total;
    }, { x: 0, y: 0 });
  }
  function rectInScrollPathCoordinates(rect, path) {
    const offset = scrollPathOffset(path);
    return Object.assign(Object.assign({}, rect), { x: round2(rect.x + offset.x), y: round2(rect.y + offset.y) });
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
    const [outer, ...inner] = path;
    const scrollport = outer && scrollContainerRect(outer);
    return scrollport ? visibleRectInsideScrollPath(scrollport, inner) : null;
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
    const scope = sceneScope();
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
  function viewportReachableBound(side) {
    const pane = side.scrollPath[0];
    if (pane !== void 0) {
      const aperture = scrollContainerRect(pane);
      return aperture && documentToViewport(aperture);
    }
    if (!side.paintEscapesRect)
      return side.rect;
    const clip = escapingPaintBound(side);
    return clip && documentToViewport(clip);
  }
  function rootScrollCanCross(documentRect, viewportRect2) {
    const scope = sceneScope();
    let range = scope === null || scope === void 0 ? void 0 : scope.rootScrollRange;
    if (!range) {
      const page = pageScrollSize();
      range = { x: Math.max(0, page.w - window.innerWidth), y: Math.max(0, page.h - window.innerHeight) };
      if (scope)
        scope.rootScrollRange = range;
    }
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
  const SCROLL_SETTLE_MS = 120;
  class ScrollOffsets {
    constructor(host) {
      this.host = host;
      this.send = null;
      this.followed = /* @__PURE__ */ new Map();
      this.sentTopology = /* @__PURE__ */ new Map();
      this.acknowledged = null;
      this.currentMode = "unsupported";
      this.ids = /* @__PURE__ */ new WeakMap();
      this.nextId = 1;
      this.sequence = 0;
      this.disposers = /* @__PURE__ */ new Map();
      this.scheduled = false;
      this.settledPending = false;
      this.endTimer = null;
      this.seenAt = null;
      this.onScroll = (event) => {
        var _a;
        const frame = (_a = document.timeline) === null || _a === void 0 ? void 0 : _a.currentTime;
        this.seenAt = typeof frame === "number" ? frame : event.timeStamp;
        this.schedule(false);
        this.scheduleSettlement();
      };
    }
    get mode() {
      return this.currentMode;
    }
    set mode(mode) {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function" && this.mode === "bridge") {
        window.removeEventListener("scroll", this.onScroll);
      }
      this.currentMode = mode;
      if (typeof window !== "undefined" && typeof window.addEventListener === "function" && mode === "bridge") {
        window.addEventListener("scroll", this.onScroll, { passive: true });
      }
    }
    idFor(element) {
      const existing = this.ids.get(element);
      if (existing)
        return existing;
      const id = `scroll-${this.nextId++}`;
      this.ids.set(element, id);
      return id;
    }
    nextSequence() {
      return ++this.sequence;
    }
    /**
     * `layout` is on its way to native. Returns each scroller it sends as native binds it to a scroll
     * view, offsets aside, which native has once it acknowledges the layout.
     */
    noteSent(layout) {
      this.sentTopology = this.mode === "bridge" ? new Map(layout.scrollContainers.map((container) => [
        container.id,
        JSON.stringify(Object.assign(Object.assign({}, container), { offsetX: 0, offsetY: 0 }))
      ])) : /* @__PURE__ */ new Map();
      return this.sentTopology;
    }
    acknowledge(sequence, topology) {
      var _a, _b;
      if (sequence > ((_b = (_a = this.acknowledged) === null || _a === void 0 ? void 0 : _a.sequence) !== null && _b !== void 0 ? _b : -1))
        this.acknowledged = { sequence, topology };
    }
    forgetLayouts() {
      this.acknowledged = null;
      this.sentTopology.clear();
    }
    /** Follows exactly `containers`. */
    sync(containers) {
      var _a;
      const next = new Map(containers.map((element) => [this.idFor(element), element]));
      for (const [id, element] of this.followed) {
        if (next.has(id))
          continue;
        (_a = this.disposers.get(id)) === null || _a === void 0 ? void 0 : _a();
        this.disposers.delete(id);
        this.followed.delete(id);
        this.host.unobserve(element);
      }
      for (const [id, element] of next) {
        if (!this.followed.has(id))
          this.host.observe(element);
        this.followed.set(id, element);
        if (this.disposers.has(id))
          continue;
        if (this.mode !== "bridge") {
          if (this.mode !== "native" || !scrollsOnlyFromScript(computedStyle(element)))
            continue;
          const onScriptScroll = () => this.host.refresh();
          element.addEventListener("scroll", onScriptScroll, { passive: true });
          this.disposers.set(id, () => element.removeEventListener("scroll", onScriptScroll));
          continue;
        }
        const onScrollEnd = () => {
          this.clearEndTimer();
          this.schedule(true);
        };
        element.addEventListener("scroll", this.onScroll, { passive: true });
        element.addEventListener("scrollend", onScrollEnd, { passive: true });
        this.disposers.set(id, () => {
          element.removeEventListener("scroll", this.onScroll);
          element.removeEventListener("scrollend", onScrollEnd);
        });
      }
      if (next.size === 0)
        this.clearEndTimer();
    }
    capture(settled = false) {
      if (!this.host.ready() || this.followed.size === 0)
        return null;
      const seenAt = this.seenAt;
      this.seenAt = null;
      return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, seenAt !== null && !settled ? { sentAt: round3(seenAt) } : {}), { sequence: ++this.sequence, layoutSeq: this.host.layoutSequence() }), this.mode === "bridge" ? { documentOffsetY: round2(window.scrollY) } : {}), { offsets: Array.from(this.followed, ([id, element]) => Object.assign({ id }, physicalScrollOffset(element))) }), settled ? { settled: true } : {});
    }
    publish() {
      if (this.mode === "bridge")
        void this.flush(false);
    }
    flush(settled) {
      const send = this.send;
      const payload = send ? this.capture(settled) : null;
      if (!payload || !send)
        return Promise.resolve();
      const installed = this.acknowledged;
      if (installed && installed.sequence < this.host.layoutSequence()) {
        const offsets = payload.offsets.filter(({ id }) => installed.topology.has(id) && installed.topology.get(id) === this.sentTopology.get(id));
        if (offsets.length > 0) {
          void send(Object.assign(Object.assign({}, payload), { layoutSeq: installed.sequence, offsets })).catch(() => void 0);
          payload.sequence = ++this.sequence;
        }
      }
      return send(payload).catch(() => void 0);
    }
    schedule(settled) {
      if (this.mode !== "bridge" || !this.send)
        return;
      if (settled) {
        if (this.scheduled)
          this.settledPending = true;
        else
          void this.flush(true);
        return;
      }
      if (this.scheduled)
        return;
      this.scheduled = true;
      const flush = () => {
        if (!this.scheduled)
          return;
        this.scheduled = false;
        const finalSample = this.settledPending;
        this.settledPending = false;
        void this.flush(finalSample);
      };
      queueMicrotask(flush);
      requestAnimationFrame(flush);
    }
    scheduleSettlement() {
      this.clearEndTimer();
      this.endTimer = window.setTimeout(() => {
        this.endTimer = null;
        this.schedule(true);
      }, SCROLL_SETTLE_MS);
    }
    clearEndTimer() {
      if (this.endTimer !== null)
        window.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }
  const FENCE_RANGE = 1024;
  const FENCE_SENTINEL_Y = 0.6875;
  function afterThisFrameReachesApp() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  const ignore = () => void 0;
  class NativeLink {
    /**
     * `natives` are the islands registered, which the link reads and never changes. `motion` starts
     * the motion held for a plan once native has it; `sizes` keeps a followed scroller's size watched.
     */
    constructor(natives, owner, motion, sizes, writes) {
      this.natives = natives;
      this.owner = owner;
      this.motion = motion;
      this.session = { state: "ready" };
      this.supported = {};
      this.ordered = false;
      this.sendLayout = null;
      this.refusals = new LayoutRefusals();
      this.lastPlan = null;
      this.delivered = null;
      this.waitingFor = null;
      this.refreshAfter = null;
      this.layoutSeq = 0;
      this.generation = 0;
      this.confirmation = { phase: "confirmed", signature: "" };
      this.waiters = /* @__PURE__ */ new Set();
      this.fenceSentinel = null;
      this.fenceSequence = 0;
      this.inFlight = /* @__PURE__ */ new Map();
      this.planes = /* @__PURE__ */ new Map();
      this.planeSequence = -1;
      this.geometry = /* @__PURE__ */ new Map();
      this.canvasColor = null;
      this.held = /* @__PURE__ */ new Set();
      this.sentIn = /* @__PURE__ */ new Map();
      this.appliedSequence = -1;
      this.status = new IslandStatus(writes);
      this.offsets = new ScrollOffsets({
        ready: () => this.session.state === "ready",
        layoutSequence: () => this.layoutSeq,
        refresh: () => owner.refresh(),
        observe: (element) => sizes.observeSize(element),
        unobserve: (element) => sizes.unobserveSize(element)
      });
    }
    /** Takes on how the transport carries plans: set as a transport is picked. */
    configure(innerScrollMode, commandsFollowLayouts) {
      this.offsets.mode = innerScrollMode;
      this.ordered = commandsFollowLayouts;
    }
    get innerScrollMode() {
      return this.offsets.mode;
    }
    /** What the native host said it supports when the session began. */
    get capabilities() {
      return this.supported;
    }
    /** Starts sending plans through `send` and inner scroll offsets through `sendOffsets`; false when already started. */
    attach(send, sendOffsets) {
      if (this.sendLayout)
        return false;
      this.sendLayout = send;
      this.offsets.send = sendOffsets;
      return true;
    }
    /** Plans can be sent: the link is attached and the session is ready. */
    get ready() {
      return this.sendLayout !== null && this.session.state === "ready";
    }
    /** Why native is off, once its session failed. */
    get failure() {
      return this.session.state === "failed" ? this.session.error : null;
    }
    /**
     * Native starts over, as a transport session begins: every plan sent and what native held of it
     * is forgotten. Returns what the session reports to as the reset settles and while it lasts; with
     * `notifyAvailable`, islands hear that native has become available once it says what it supports.
     */
    beginSession(notifyAvailable = false) {
      this.motion.reset();
      this.session = { state: "pending" };
      this.offsets.forgetLayouts();
      this.held.clear();
      for (const handle of /* @__PURE__ */ new Set([...this.natives, ...this.sentIn.keys()]))
        handle.nativeReset();
      this.sentIn.clear();
      this.supported = {};
      this.lastPlan = null;
      this.delivered = null;
      this.waitingFor = null;
      this.forgetSentPlans();
      return {
        ready: (capabilities) => {
          this.supported = capabilities;
          if (notifyAvailable)
            for (const handle of this.natives)
              handle.onTransportAvailable();
          this.completeSession();
        },
        failed: (failure) => this.failSession(failure),
        refused: (payload, reason) => {
          var _a;
          const failed = this.refusals.refuse(payload, reason, this.layoutSeq);
          this.owner.refresh();
          for (const id of failed)
            (_a = this.natives.find((handle) => handle.islandId === id)) === null || _a === void 0 ? void 0 : _a.failNative(reason);
        },
        applied: (latency) => this.motion.noteApplyLatency(latency),
        republish: () => this.owner.republish(),
        captureOffsets: () => this.offsets.capture(),
        scrollFailed: (ids, reason) => this.failScrollContainers(ids, reason)
      };
    }
    /** `handle` is registered: it takes over what native holds for an island registered under its id. */
    registered(handle) {
      for (const held of Array.from(this.held)) {
        if (held.islandId === handle.islandId && held !== handle) {
          this.held.delete(held);
          this.held.add(handle);
        }
      }
      for (const [held, sequence] of Array.from(this.sentIn.entries())) {
        if (held.islandId === handle.islandId && held !== handle) {
          this.sentIn.delete(held);
          this.sentIn.set(handle, sequence);
        }
      }
      if (this.confirmation.phase === "sending")
        this.confirmation.confirmed = "";
      else
        this.confirmation.signature = "";
    }
    /** Drops the plan on its way: what it delivers settles nothing, and the next plan is sent. */
    invalidate() {
      this.generation++;
      this.confirmation = { phase: "confirmed", signature: "" };
    }
    /** Native could not follow the inner scrollers `ids`: the islands in them fail. */
    failScrollContainers(ids, reason) {
      const failed = new Set(ids);
      for (const handle of this.natives) {
        const affected = independentScrollContainers(handle.el).some((container) => failed.has(this.offsets.idFor(container)));
        if (affected)
          handle.failNative(reason);
      }
    }
    /** Settles once native has applied the next plan, which `request` asks for. */
    nextApplied(request) {
      const session = this.session;
      if (session.state === "failed")
        return Promise.reject(session.error);
      if (!this.sendLayout)
        return Promise.resolve();
      return new Promise((resolve, reject) => {
        this.waiters.add({ resolve, reject });
        request();
      });
    }
    /** Someone waits for the next plan to reach native. */
    get awaited() {
      return this.waiters.size > 0;
    }
    /**
     * Whether the next plan waits for the paint the last one waits for; it plans again once that
     * paint is done. A `changed` page whose plan, made now, takes islands away goes ahead of that
     * paint where native starts motion at its own commit, so they leave with the paint that covers
     * them rather than frames after it.
     */
    waitsForPaint(changed, plan) {
      const waiting = this.waitingFor;
      if (!waiting)
        return false;
      if (changed && this.supported.motionStartsAtCommit) {
        const { payload, covered } = plan();
        if (retirementOf(this.delivered, payload, covered) !== null)
          return false;
      }
      trace("paintWait");
      if (this.refreshAfter !== waiting) {
        this.refreshAfter = waiting;
        void waiting.then(this.owner.refresh);
      }
      return true;
    }
    /** An island native does not hold yet is near enough the screen to be created now. */
    awaitsCreation() {
      return this.natives.some((handle) => {
        if (!handle.canAttemptNative() || this.held.has(handle))
          return false;
        const box = handle.el.getBoundingClientRect();
        return box.bottom > -120 && box.top < window.innerHeight + 120 && box.right > -120 && box.left < window.innerWidth + 120;
      });
    }
    /** The last plan sent turns every registered island off, and nothing is on its way or awaited. */
    holdsOff() {
      const sent = this.lastPlan;
      if (!sent || this.natives.length === 0 || sent.components.length !== this.natives.length || this.waiters.size > 0 || this.confirmation.phase !== "confirmed")
        return false;
      if (sent.components.some((component) => component.active))
        return false;
      for (const handle of this.natives) {
        let carried = false;
        for (const component of sent.components) {
          if (component.id !== handle.islandId)
            continue;
          carried = true;
          break;
        }
        if (!carried)
          return false;
      }
      return true;
    }
    /**
     * Sends `plan`, made in `frame`, unless native already has it, starting the motion held for it.
     * Returns whether native has, or is about to have, the same.
     */
    send(plan, frame) {
      const ticket = {
        session: this.session,
        waiters: Array.from(this.waiters),
        generation: this.generation
      };
      const { payload, covered, geometry } = plan;
      const entering = this.entersUnderlay(payload, covered);
      const starting = this.motion.startWithPlan(entering ? 2 * frame.frameInterval : 0);
      const atCommit = !!this.supported.motionStartsAtCommit;
      const followsAtCommit = atCommit && !entering && frame.fresh.length === 0 && !starting;
      const resuming = this.status.takeReady();
      const signature = structuralSignature$1(payload, this.offsets.mode);
      const state = this.confirmation;
      const unchanged = signature === (state.phase === "sending" ? state.delivery.signature : state.signature);
      if (!followsAtCommit)
        this.owner.schedule();
      if (this.repeat(signature, payload, ticket, resuming)) {
        if (followsAtCommit)
          this.owner.schedule();
        return unchanged;
      }
      const fenced = !entering && this.fencesToCommit(plan, frame.changes, frame.still && !starting);
      this.dispatch({
        ticket,
        payload,
        signature,
        geometry,
        resuming,
        retirement: atCommit && !entering ? retirementOf(this.delivered, payload, covered) : null,
        fenced,
        waitsForPaint: entering || atCommit && !fenced,
        followsAtCommit,
        starting,
        paused: frame.paused
      });
      return unchanged;
    }
    /** Whether `record` is the runtime telling native which commit carries a layout. */
    isFenceRecord(record) {
      if (!this.fenceSentinel)
        return false;
      if (record.target === this.fenceSentinel)
        return true;
      const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
      return record.type === "childList" && nodes.length > 0 && nodes.every((node) => node === this.fenceSentinel);
    }
    /** Sends the inner scroll offsets now, where native follows them from the page. */
    publishOffsets() {
      this.offsets.publish();
    }
    // What a plan reads of native.
    /** The plane native shows `islandId` on, by the last acknowledged layout. */
    planeOf(islandId) {
      return this.planes.get(islandId);
    }
    /** Whether native shows, or is about to show, `islandId` under the WebView. */
    mayShowUnder(islandId) {
      if (this.planes.get(islandId) === "underlay")
        return true;
      return Array.from(this.inFlight.values()).some(({ geometry }) => geometry.has(islandId));
    }
    /** Where native shows `islandId` under the WebView, or the latest layout on its way puts it. */
    placedUnder(islandId) {
      var _a;
      const shown = this.planes.get(islandId) === "underlay" ? this.geometry.get(islandId) : void 0;
      if (shown)
        return shown;
      let placed;
      for (const { geometry } of this.inFlight.values())
        placed = (_a = geometry.get(islandId)) !== null && _a !== void 0 ? _a : placed;
      return placed;
    }
    /** The canvas color native paints behind islands under the WebView, or the latest sent. */
    shownCanvasColor() {
      var _a;
      if (this.canvasColor !== null)
        return this.canvasColor;
      let color = null;
      for (const planned2 of this.inFlight.values())
        color = (_a = planned2.canvasColor) !== null && _a !== void 0 ? _a : color;
      return color;
    }
    /** Why native refused the island's last layout, while the island is held out of layouts. */
    refusedBecause(islandId) {
      return this.refusals.heldReason(islandId);
    }
    /**
     * The plan found `natives` so: each shows its web implementation or not. Returns the islands it
     * sends, so native keeps a view for each: those showing, and the inactive ones native already holds.
     */
    planned(natives) {
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
      this.status.present(natives);
      return held;
    }
    /** The scrollers islands sit in, by id, as native is sent them. */
    get scrollers() {
      return this.offsets;
    }
    completeSession() {
      if (this.session.state !== "pending")
        return;
      this.session.state = "ready";
      if (this.supported.paintFence)
        this.writeFence();
      this.owner.refresh();
    }
    failSession(error) {
      this.motion.release();
      if (this.session.state === "failed")
        return;
      this.session = { state: "failed", error };
      this.forgetSentPlans();
      for (const waiter of this.waiters)
        waiter.reject(error);
      this.waiters.clear();
      for (const handle of this.natives)
        handle.failNative(error.message);
    }
    /** Forgets every plan sent and what native confirmed of them, and the paint written for them. */
    forgetSentPlans() {
      this.invalidate();
      this.planes.clear();
      this.geometry.clear();
      this.inFlight.clear();
      this.canvasColor = null;
      this.owner.forgetPaint();
    }
    /**
     * Whether the plan lowers an island native shows above the WebView. It waits for the page to
     * paint its holes, unless a layer painted over it hides it there anyway, as a page pushed over
     * the islands does.
     */
    entersUnderlay(payload, covered) {
      return payload.components.some((component) => component.active && component.plane === "underlay" && this.planes.get(component.id) === "overlay" && !covered.has(component.id));
    }
    /**
     * Whether the layout goes now, fenced to the commit of the frame about to paint: a script drag,
     * or a change to a page otherwise `still`, has already set that frame. Others wait for their frame.
     */
    fencesToCommit(plan, changes, still) {
      if (!this.supported.paintFence)
        return false;
      if (changes.scriptTranslated)
        return true;
      const lastSent = this.lastPlan;
      const sameScrollers = lastSent !== null && sameScrollerIds(lastSent.scrollContainers, plan.payload.scrollContainers);
      return changes.domChanged && sameScrollers && still && !plan.follow;
    }
    /** A plan with nothing new to send: native already has it, or it is on its way. Returns whether it was. */
    repeat(signature, payload, ticket, resuming) {
      const state = this.confirmation;
      if (state.phase === "confirmed" && state.signature === signature) {
        this.offsets.publish();
        this.settle(ticket, ticket.generation);
        this.status.resume(resuming);
        if (this.refusals.accept(payload))
          this.owner.refresh();
        return true;
      }
      if (state.phase === "sending" && state.delivery.signature === signature) {
        this.offsets.publish();
        void state.applied.then(() => {
          this.settle(ticket, ticket.generation);
          this.status.resume(resuming);
        }, (error) => this.settle(ticket, ticket.generation, { error }));
        return true;
      }
      return false;
    }
    dispatch(plan) {
      var _a;
      const { ticket, payload } = plan;
      const generation = ++this.generation;
      this.lastPlan = payload;
      const layoutSeq = ++this.layoutSeq;
      this.status.noteSent(plan.resuming, layoutSeq);
      const sent = Object.assign(Object.assign({}, payload), { layoutSeq, offsetSeq: this.offsets.nextSequence() });
      trace("sent", { layoutSeq, payload: sent });
      const retiredGeometry = this.latestGeometry();
      this.noteSending(layoutSeq, plan.geometry, (_a = sent.canvasColor) !== null && _a !== void 0 ? _a : null);
      const scrollTopology = this.offsets.noteSent(sent);
      const delivery = {
        session: ticket.session,
        generation,
        payload,
        sent,
        geometry: plan.geometry,
        scrollTopology,
        signature: plan.signature
      };
      const frameFence = plan.retirement ? this.sendRetirement(delivery, plan.retirement, retiredGeometry) : void 0;
      if (plan.fenced)
        sent.fence = frameFence !== null && frameFence !== void 0 ? frameFence : this.writeFence();
      if (plan.waitsForPaint)
        this.waitForPaint(plan.followsAtCommit ? afterThisFrameReachesApp() : afterNextPaint());
      if (plan.followsAtCommit)
        this.owner.schedule();
      const deliver = () => this.deliverStartingMotion(delivery, plan.starting);
      const apply = (this.waitingFor ? this.waitingFor.then(deliver) : deliver()).finally(() => {
        if (generation === this.generation)
          this.motion.release(plan.paused);
      });
      if (plan.starting)
        this.waitForPaint(apply.then(ignore, ignore));
      const confirmed = this.confirmation.phase === "sending" ? this.confirmation.confirmed : this.confirmation.signature;
      const sending = { phase: "sending", delivery, applied: apply, confirmed };
      if (generation === this.generation)
        this.confirmation = sending;
      void apply.then(() => this.settle(ticket, generation), (error) => this.settle(ticket, generation, { error }));
      void apply.then(() => this.applied(delivery, plan.resuming)).catch(() => {
        if (generation === this.generation && this.confirmation === sending)
          this.confirmation = { phase: "confirmed", signature: sending.confirmed };
      });
    }
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
    /**
     * Sends the last layout without the islands `delivery` takes away, ahead of it, which then goes
     * under later sequences. Returns the fence it carries, which the plan's own layout shares.
     */
    sendRetirement(delivery, retirement, geometry) {
      const fence = this.supported.paintFence ? this.writeFence() : void 0;
      const layout = Object.assign(Object.assign(Object.assign({}, retirement), { layoutSeq: ++this.layoutSeq, offsetSeq: this.offsets.nextSequence() }), fence !== void 0 ? { fence } : {});
      void this.deliver(delivery, layout, geometry).catch(ignore);
      delivery.sent.layoutSeq = ++this.layoutSeq;
      delivery.sent.offsetSeq = this.offsets.nextSequence();
      return fence;
    }
    waitForPaint(paint) {
      const waiting = paint.then(() => {
        if (this.waitingFor === waiting)
          this.waitingFor = null;
      });
      this.waitingFor = waiting;
    }
    isCurrent(delivery) {
      return delivery.session === this.session && delivery.generation === this.generation;
    }
    /** Settles the waiters of `ticket`, unless a later plan or transport session has taken them over. */
    settle(ticket, generation, failure) {
      const { session } = ticket;
      if (session !== this.session || session.state !== "ready" || generation !== this.generation)
        return;
      for (const waiter of ticket.waiters) {
        if (!this.waiters.delete(waiter))
          continue;
        if (failure)
          waiter.reject(failure.error);
        else
          waiter.resolve();
      }
    }
    /**
     * Delivers the plan. Motion held to start with it goes first paused, in a layout of its own,
     * and starts once native has that, with the plan sent again.
     */
    deliverStartingMotion(delivery, starting) {
      if (!this.isCurrent(delivery))
        return Promise.resolve();
      if (!starting)
        return this.deliver(delivery);
      const { motion } = this;
      if (!motion.waitsFor(starting)) {
        this.restamp(delivery);
        return this.deliver(delivery);
      }
      const held = new Set(starting.entries.map((entry) => entry.payload));
      return this.deliver(delivery, withMotionsHeld(delivery.sent, held)).then(() => {
        if (!this.isCurrent(delivery))
          return;
        motion.startHeld(starting);
        delivery.sent.layoutSeq = ++this.layoutSeq;
        delivery.sent.offsetSeq = this.offsets.nextSequence();
        this.restamp(delivery);
        return this.deliver(delivery);
      });
    }
    /** Starting motion stamps its start time into the payload. */
    restamp(delivery) {
      delivery.signature = structuralSignature$1(delivery.payload, this.offsets.mode);
    }
    /** Sends one layout of the plan, and follows what native confirms of it. */
    deliver(delivery, layout = delivery.sent, geometry = delivery.geometry) {
      var _a, _b, _c;
      const { session, generation } = delivery;
      if (!this.isCurrent(delivery))
        return Promise.resolve();
      const sequence = layout.layoutSeq;
      this.noteSending(sequence, geometry, (_a = layout.canvasColor) !== null && _a !== void 0 ? _a : null);
      const sending = (_c = (_b = this.sendLayout) === null || _b === void 0 ? void 0 : _b.call(this, layout)) !== null && _c !== void 0 ? _c : Promise.resolve();
      this.delivered = layout;
      this.noteSent(layout);
      const creating = this.ordered ? this.nativeApplied(layout) : null;
      return sending.then(() => {
        const current = session === this.session;
        if (current && session.state === "ready") {
          this.offsets.acknowledge(sequence, delivery.scrollTopology);
          if (this.acknowledge(layout))
            this.owner.raised();
        }
        if (!current)
          return;
        const created = creating !== null && creating !== void 0 ? creating : this.nativeApplied(layout);
        if (generation === this.generation)
          return created;
        if (layout !== delivery.sent)
          return;
        if (this.ordered)
          this.status.resumeShownBy(layout, sequence);
        if (session.state === "ready" && this.refusals.accept(layout))
          this.owner.refresh();
      });
    }
    applied(delivery, resuming) {
      if (delivery.generation !== this.generation) {
        if (delivery.session === this.session) {
          if (this.confirmation.phase === "sending")
            this.confirmation.confirmed = "";
          else
            this.confirmation.signature = "";
        }
        return;
      }
      this.status.resume(resuming);
      this.confirmation = { phase: "confirmed", signature: delivery.signature };
      if (this.refusals.accept(delivery.sent))
        this.owner.refresh();
    }
    /** Where the latest layout sent puts the islands under the WebView. */
    latestGeometry() {
      let geometry = this.geometry;
      for (const planned2 of this.inFlight.values())
        geometry = planned2.geometry;
      return geometry;
    }
    /** A layout with `sequence` is on its way, placing islands under the WebView at `geometry`. */
    noteSending(sequence, geometry, canvasColor) {
      if (!this.inFlight.has(sequence))
        this.inFlight.set(sequence, { geometry, canvasColor });
    }
    /** `layout` went to native: the islands it carries are held there now. */
    noteSent(layout) {
      const ids = new Set(layout.components.map((component) => component.id));
      for (const handle of this.natives) {
        if (!ids.has(handle.islandId))
          continue;
        this.sentIn.set(handle, layout.layoutSeq);
        handle.nativeLayoutSent();
      }
    }
    /**
     * Native acknowledged `layout`. Returns whether it raised above the WebView an island an earlier
     * layout put under it, so the holes kept for it can go.
     */
    acknowledge(layout) {
      var _a, _b, _c;
      const sequence = layout.layoutSeq;
      if (sequence <= this.planeSequence)
        return false;
      const planes = new Map(layout.components.filter((component) => component.active).map((component) => [component.id, component.plane]));
      const raised = Array.from(this.planes).some(([id, plane]) => plane === "underlay" && planes.get(id) !== "underlay") || Array.from(this.inFlight).some(([planned2, { geometry }]) => planned2 < sequence && Array.from(geometry.keys()).some((id) => planes.get(id) !== "underlay"));
      this.planeSequence = sequence;
      this.geometry = (_b = (_a = this.inFlight.get(sequence)) === null || _a === void 0 ? void 0 : _a.geometry) !== null && _b !== void 0 ? _b : /* @__PURE__ */ new Map();
      for (const planned2 of this.inFlight.keys()) {
        if (planned2 <= sequence)
          this.inFlight.delete(planned2);
      }
      this.planes = planes;
      this.canvasColor = (_c = layout.canvasColor) !== null && _c !== void 0 ? _c : null;
      return raised;
    }
    /** Native applied `layout`: tells each island it holds whether it is still held, once per sequence. */
    nativeApplied(layout) {
      const sequence = layout.layoutSeq;
      if (sequence <= this.appliedSequence)
        return Promise.resolve();
      this.appliedSequence = sequence;
      const ids = new Set(layout.components.map((component) => component.id));
      const creations = [];
      for (const [handle, sent] of this.sentIn) {
        const holds2 = ids.has(handle.islandId);
        const creation = handle.nativeLayoutApplied(holds2);
        if (holds2 && creation)
          creations.push(creation);
        if (!holds2 && sequence > sent)
          this.sentIn.delete(handle);
      }
      return Promise.all(creations).then(() => void 0);
    }
  }
  const HYDRATION_PROBE_FRAMES = 120;
  function isCustomElement(element) {
    return element.localName.includes("-");
  }
  class CompositionObserver {
    constructor(invalidate, onOpenRoot = () => void 0) {
      this.invalidate = invalidate;
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
      const observer = new MutationObserver(() => this.invalidate());
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
  const scriptedAnimations = {
    listeners: /* @__PURE__ */ new Set(),
    count: 0,
    /** A frozen prototype could not be wrapped: animations are then listed every frame. */
    unwatched: false
  };
  const SCRIPTED_ANIMATION_WATCH = Symbol.for("@capacitor/native-islands/scripted-animation-watch");
  function watchScriptedAnimations() {
    const wrap = (owner, name) => {
      const methods = owner;
      const original = methods === null || methods === void 0 ? void 0 : methods[name];
      if (!methods || typeof original !== "function" || original[SCRIPTED_ANIMATION_WATCH])
        return;
      const watched = function(...args) {
        const result = original.apply(this, args);
        scriptedAnimations.count += 1;
        for (const listener of scriptedAnimations.listeners)
          listener();
        return result;
      };
      Object.defineProperty(watched, SCRIPTED_ANIMATION_WATCH, { value: true });
      try {
        methods[name] = watched;
      } catch (_a) {
        scriptedAnimations.unwatched = true;
      }
    };
    if (typeof Element !== "undefined")
      wrap(Element.prototype, "animate");
    if (typeof Animation !== "undefined")
      wrap(Animation.prototype, "play");
    if (typeof Animation !== "undefined")
      wrap(Animation.prototype, "reverse");
    const keyframes = typeof KeyframeEffect !== "undefined" ? KeyframeEffect.prototype : void 0;
    const setKeyframes = keyframes === null || keyframes === void 0 ? void 0 : keyframes.setKeyframes;
    if (keyframes && typeof setKeyframes === "function" && !setKeyframes[SCRIPTED_ANIMATION_WATCH]) {
      const watched = function(...args) {
        keyframeImpacts.delete(this);
        setKeyframes.apply(this, args);
      };
      Object.defineProperty(watched, SCRIPTED_ANIMATION_WATCH, { value: true });
      try {
        keyframes.setKeyframes = watched;
      } catch (_a) {
        keyframeImpactsUnwatched = true;
      }
    }
  }
  let keyframeImpacts = /* @__PURE__ */ new WeakMap();
  let keyframeImpactsUnwatched = false;
  function forgetKeyframeImpacts() {
    keyframeImpacts = /* @__PURE__ */ new WeakMap();
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
  const TRANSLATE_DECLARATION = /^transform:\s*translate3d\(\s*-?[\d.]+px,\s*-?[\d.]+px,\s*0(?:px)?\s*\)$/;
  function movesByTranslation(before, after) {
    if (before === after)
      return false;
    const declarations = (style) => (style !== null && style !== void 0 ? style : "").split(";").map((declaration) => declaration.trim()).filter(Boolean);
    const [was, now] = [declarations(before), declarations(after)];
    const transforms = [...was, ...now].filter((declaration) => declaration.startsWith("transform:"));
    if (transforms.length === 0 || !transforms.every((declaration) => TRANSLATE_DECLARATION.test(declaration)))
      return false;
    const rest = (list) => list.filter((declaration) => !declaration.startsWith("transform:")).join(";");
    return rest(was) === rest(now);
  }
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
  const KEYFRAME_TIMING_FIELDS = /* @__PURE__ */ new Set(["offset", "computedOffset", "easing", "composite"]);
  function transitionPropertyOf(animation) {
    const property = animation.transitionProperty;
    return typeof property === "string" ? property : void 0;
  }
  function animationImpact(animation) {
    const transitionProperty = transitionPropertyOf(animation);
    if (transitionProperty !== void 0) {
      return transitionImpact(animationTarget(animation), transitionProperty);
    }
    const effect = animation.effect;
    if (typeof (effect === null || effect === void 0 ? void 0 : effect.getKeyframes) !== "function")
      return "global-layout";
    const known = keyframeImpactsUnwatched ? void 0 : keyframeImpacts.get(effect);
    if (known !== void 0)
      return known;
    const impact = keyframeImpact(effect);
    if (!keyframeImpactsUnwatched)
      keyframeImpacts.set(effect, impact);
    return impact;
  }
  function keyframeImpact(effect) {
    try {
      let impact = "none";
      for (const keyframe of effect.getKeyframes()) {
        for (const propertyName of Object.keys(keyframe)) {
          if (KEYFRAME_TIMING_FIELDS.has(propertyName))
            continue;
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
  let contextMemo = /* @__PURE__ */ new WeakMap();
  let nearestContextMemo = /* @__PURE__ */ new WeakMap();
  let planMemo = null;
  const freshPlanMemo = () => ({
    order: /* @__PURE__ */ new WeakMap(),
    level: /* @__PURE__ */ new WeakMap(),
    phase: /* @__PURE__ */ new WeakMap(),
    topLayer: /* @__PURE__ */ new WeakMap()
  });
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
    nearestContextMemo = /* @__PURE__ */ new WeakMap();
    if (planMemo)
      planMemo = freshPlanMemo();
  }
  function withPaintOrderScope(read) {
    const previous = planMemo;
    resetPaintOrderCache();
    planMemo = freshPlanMemo();
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
    const cached = nearestContextMemo.get(el);
    if (cached !== void 0)
      return cached;
    let parent = composedParentElement(el);
    while (parent && !establishesStackingContext(parent))
      parent = composedParentElement(parent);
    nearestContextMemo.set(el, parent);
    return parent;
  }
  function participationChain(el) {
    const chain = [el];
    for (let context = nearestContext(el); context; context = nearestContext(context))
      chain.push(context);
    return chain;
  }
  function paintsBelowAncestor(descendant, ancestor) {
    if (establishesStackingContext(ancestor))
      return false;
    let participant = descendant;
    let context = nearestContext(descendant);
    while (context && context !== ancestor && isComposedAncestor(ancestor, context)) {
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
  function paintUnit(el, context) {
    if (computedStyle(el).position !== "static" || establishesStackingContext(el))
      return el;
    for (let node = composedParentElement(el); node && node !== context; node = composedParentElement(node)) {
      if (computedStyle(node).position !== "static")
        return node;
    }
    return el;
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
    if (isComposedAncestor(a, b))
      return paintsBelowAncestor(b, a) ? 1 : -1;
    if (isComposedAncestor(b, a))
      return paintsBelowAncestor(a, b) ? -1 : 1;
    const chainA = participationChain(a);
    const chainB = participationChain(b);
    const setB = new Set(chainB);
    const common = chainA.find((element) => setB.has(element));
    if (!common)
      return 0;
    if (common === a)
      return -1;
    if (common === b)
      return 1;
    let repA = chainA[chainA.indexOf(common) - 1];
    let repB = chainB[chainB.indexOf(common) - 1];
    if (repA === repB)
      return 0;
    const unitA = paintUnit(repA, common);
    const unitB = paintUnit(repB, common);
    if (unitA !== unitB) {
      repA = unitA;
      repB = unitB;
    }
    const levelA = stackLevel(repA);
    const levelB = stackLevel(repB);
    if (levelA !== levelB)
      return levelA - levelB;
    const phaseA = paintPhase(repA);
    const phaseB = paintPhase(repB);
    if (phaseA !== phaseB)
      return phaseA - phaseB;
    return compareComposedTreeOrder(repA, repB);
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
    var _a;
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
    return { classes, attributes, state: readsState(text), focus: /:focus/i.test(text) };
  }
  function subjectClasses(selector) {
    if (selector.includes("\\"))
      return [];
    let compound = lastCompound(selector).replace(/\[[^\]]*\]/g, "");
    for (let previous = ""; previous !== compound; ) {
      previous = compound;
      compound = compound.replace(/\([^()]*\)/g, "");
    }
    return Array.from(compound.matchAll(/\.([^\s.#:[\]()>+~,*]+)/g), (match) => match[1]);
  }
  function bare(selector) {
    const mask = (part) => part[0] + "_".repeat(part.length - 2) + part[part.length - 1];
    return selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, mask).replace(/\[[^\]]*\]/g, mask);
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
  class StyleScope {
    constructor(hasShadowRoots = () => false) {
      this.hasShadowRoots = hasShadowRoots;
      this.index = { phase: "unread" };
      this.sheets = [];
      this.matches = /* @__PURE__ */ new Map();
      this.containers = /* @__PURE__ */ new Map();
      this.changes = null;
    }
    get scoped() {
      return this.scopedRules() !== null;
    }
    /** The rules, where every change can be traced through them. */
    scopedRules() {
      return this.index.phase === "whole" && !this.hasShadowRoots() ? this.index.rules : null;
    }
    invalidateIndex() {
      if (this.index.phase !== "unread")
        this.index = { phase: "stale" };
    }
    noteChange(records) {
      var _a;
      this.keepPresent(records);
      if (this.changes === "any")
        return;
      if (!records) {
        this.changes = "any";
        return;
      }
      const touched = (_a = this.changes) !== null && _a !== void 0 ? _a : { classes: /* @__PURE__ */ new Set(), attributes: /* @__PURE__ */ new Set(), style: false };
      this.changes = touched;
      for (const record of records) {
        const target = record.target;
        const name = record.attributeName;
        if (record.type !== "attributes" || !name || typeof target.getAttribute !== "function") {
          this.changes = "any";
          return;
        }
        if (name === "class") {
          const before = classTokens(record.oldValue);
          const now = classTokens(target.getAttribute("class"));
          for (const token of before)
            if (!now.has(token))
              touched.classes.add(token);
          for (const token of now)
            if (!before.has(token))
              touched.classes.add(token);
        } else if (name === "style") {
          touched.style = true;
        } else {
          touched.attributes.add(name.toLowerCase());
        }
      }
    }
    keepPresent(records) {
      var _a, _b, _c;
      const present = this.present;
      if (!present)
        return;
      if (!records) {
        this.present = void 0;
        return;
      }
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "class") {
          for (const name of classTokens((_c = (_b = (_a = record.target).getAttribute) === null || _b === void 0 ? void 0 : _b.call(_a, "class")) !== null && _c !== void 0 ? _c : null))
            present.add(name);
        } else if (record.type === "childList") {
          for (const node of Array.from(record.addedNodes)) {
            if (typeof node.querySelectorAll !== "function")
              continue;
            const element = node;
            const classed = [element, ...Array.from(element.querySelectorAll("[class]"))];
            if (!classed.every((each) => addClasses(each, present))) {
              this.present = void 0;
              return;
            }
          }
        }
      }
    }
    collect() {
      const { phase } = this.index;
      if ((phase === "partial" || phase === "whole") && this.sheetsChanged())
        this.index = { phase: "stale" };
      if (this.index.phase === "unread" || this.index.phase === "stale") {
        const first = this.index.phase === "unread";
        this.rebuild(this.changes === null ? this.matches : null);
        this.changes = null;
        return first ? [] : "all";
      }
      const rules = this.scopedRules();
      if (!rules) {
        if (this.changes !== null)
          this.changes = "any";
        return [];
      }
      const changes = this.changes;
      this.changes = null;
      return [...changes === null ? [] : this.changedRoots(rules, changes), ...this.resizedContainers()];
    }
    /** The elements whose non-local rules matched differently after `changes`. */
    changedRoots(rules, changes) {
      var _a;
      const roots = [];
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
      const unmatched = [];
      for (const [selector, read] of rules.nonLocal) {
        if (changes !== "any" && !reads(read.inputs, changes))
          continue;
        if (((_a = this.matches.get(selector)) !== null && _a !== void 0 ? _a : NONE).size > 0) {
          compare(selector);
          continue;
        }
        if (this.possible(read.required))
          unmatched.push(selector);
      }
      for (const selector of matching(unmatched))
        compare(selector);
      for (const subject of rules.subjects)
        roots.push(...queryAll(subject));
      this.findContainers(rules);
      return roots;
    }
    /** The size containers whose size changed since last read, which restyles what they hold. */
    resizedContainers() {
      const resized = [];
      for (const [container, watched] of this.containers) {
        if (!container.isConnected) {
          this.containers.delete(container);
          continue;
        }
        const now = sizeKey(container, watched.type);
        if (now === watched.size)
          continue;
        watched.size = now;
        resized.push(container);
      }
      return resized;
    }
    rebuild(kept) {
      this.index = { phase: "partial" };
      this.matches = /* @__PURE__ */ new Map();
      this.containers.clear();
      this.present = void 0;
      const sheets = documentSheets();
      if (!sheets)
        return;
      this.sheets = sheets;
      const rules = readRuleIndex(sheets);
      if (!rules)
        return;
      this.index = { phase: "whole", rules };
      this.snapshot(rules, kept);
    }
    stateReach(target) {
      var _a;
      const rules = this.scopedRules();
      if (!rules || this.sheetsChanged())
        return "all";
      const anchors = rules.stateAnchors;
      const own = [];
      const subtrees = [];
      try {
        for (let node = target; node; node = node.parentElement) {
          own.push(node);
          if (anchors !== "" && node.matches(anchors))
            subtrees.push((_a = node.parentElement) !== null && _a !== void 0 ? _a : node);
        }
      } catch (_b) {
        return "all";
      }
      return { own, subtrees };
    }
    sheetsChanged() {
      const current = documentSheets();
      if (!current)
        return false;
      return current.length !== this.sheets.length || current.some((sheet, index) => sheet !== this.sheets[index]);
    }
    /** Whether a rule whose subject needs the `required` classes can match, from the classes on the page. */
    possible(required) {
      if (required.length === 0)
        return true;
      if (this.present === void 0)
        this.present = presentClasses();
      const present = this.present;
      return present === null || required.every((name) => present.has(name));
    }
    snapshot(rules, kept) {
      const unread = [];
      for (const [selector, read] of rules.nonLocal) {
        const known = kept === null || kept === void 0 ? void 0 : kept.get(selector);
        if (known)
          this.matches.set(selector, known);
        else if (this.possible(read.required))
          unread.push(selector);
      }
      for (const selector of matching(unread))
        this.matches.set(selector, new Set(queryAll(selector)));
      this.findContainers(rules);
    }
    findContainers(rules) {
      const found = /* @__PURE__ */ new Map();
      const visited = /* @__PURE__ */ new Set();
      for (const selector of rules.containerRules) {
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
  function readRuleIndex(sheets) {
    const all = sheetSelectorSets();
    for (const sheet of sheets) {
      const read = sheetSelectors(sheet);
      if (!read)
        return null;
      for (const kind of SELECTOR_KINDS)
        for (const selector of read[kind])
          all[kind].add(selector);
    }
    return {
      nonLocal: new Map(Array.from(all.nonLocal, (selector) => [selector, selectorRead(selector)])),
      subjects: [...all.subjects],
      containerRules: [...all.containerRules],
      stateAnchors: [...all.stateAnchors].join(", ")
    };
  }
  const selectorReads = /* @__PURE__ */ new Map();
  function selectorRead(selector) {
    let read = selectorReads.get(selector);
    if (!read) {
      read = { inputs: selectorInputs(selector), required: subjectClasses(selector) };
      selectorReads.set(selector, read);
    }
    return read;
  }
  function documentSheets() {
    var _a;
    if (typeof document === "undefined" || !document.styleSheets)
      return null;
    return [
      ...Array.from(document.styleSheets),
      ...(_a = document.adoptedStyleSheets) !== null && _a !== void 0 ? _a : []
    ];
  }
  const SELECTOR_KINDS = ["nonLocal", "subjects", "containerRules", "stateAnchors"];
  function sheetSelectorSets() {
    return { nonLocal: /* @__PURE__ */ new Set(), subjects: /* @__PURE__ */ new Set(), containerRules: /* @__PURE__ */ new Set(), stateAnchors: /* @__PURE__ */ new Set() };
  }
  const sheetReads = /* @__PURE__ */ new WeakMap();
  function sheetSelectors(sheet) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch (_a) {
      return null;
    }
    const known = sheetReads.get(sheet);
    if (known && known.rules === rules.length)
      return known.read;
    const read = sheetSelectorSets();
    let imports = false;
    const walk = (list, inContainer) => {
      var _a, _b;
      for (const rule of Array.from(list)) {
        const style = rule;
        if (typeof style.selectorText === "string") {
          if (style.cssRules && !Array.from(style.cssRules).every(onlyDeclarations))
            return false;
          for (const selector of splitSelectorList(style.selectorText)) {
            const queried = withoutPseudoElements(selector);
            if (queried === "")
              continue;
            if (inContainer)
              read.containerRules.add(queried);
            for (const anchor of stateAnchorsOf(queried))
              read.stateAnchors.add(queryable(anchor) ? anchor : "*");
            if (!isNonLocal(selector))
              continue;
            if (queryable(queried))
              read.nonLocal.add(queried);
            else {
              const subject = withoutPseudoClasses(lastCompound(queried));
              if (!queryable(subject))
                return false;
              read.subjects.add(subject);
            }
          }
          continue;
        }
        const name = (_b = (_a = rule.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "";
        if (name === "CSSScopeRule")
          return false;
        const imported = rule.styleSheet;
        if (imported) {
          imports = true;
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
    if (!walk(rules, false))
      return null;
    if (!imports)
      sheetReads.set(sheet, { rules: rules.length, read });
    return read;
  }
  function classTokens(value) {
    return new Set((value !== null && value !== void 0 ? value : "").split(/\s+/).filter(Boolean));
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
  function matching(selectors) {
    const found = [];
    for (let start = 0; start < selectors.length; start += UNMATCHED_BATCH) {
      const batch = selectors.slice(start, start + UNMATCHED_BATCH);
      if (batch.length > 1 && queryNone(batch.join(", ")))
        continue;
      found.push(...batch);
    }
    return found;
  }
  function presentClasses() {
    try {
      const found = /* @__PURE__ */ new Set();
      for (const element of Array.from(document.querySelectorAll("[class]")))
        if (!addClasses(element, found))
          return null;
      return found;
    } catch (_a) {
      return null;
    }
  }
  function addClasses(element, into) {
    const list = element.classList;
    if (!list)
      return false;
    for (const name of Array.from(list))
      into.add(name);
    return true;
  }
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
  const STYLE_STATE_EVENTS = [
    ...SCOPED_STATE_EVENTS,
    "beforetoggle",
    "toggle",
    "close",
    "cancel",
    "contentvisibilityautostatechange"
  ];
  class PageWatch {
    constructor(host, onOpenRoot) {
      this.host = host;
      this.noted = { scriptTranslated: false, domChanged: false };
      this.styleScope = new StyleScope(() => this.shadowRoots().length > 0);
      this.mutationObserver = null;
      this.resizeObserver = null;
      this.sized = /* @__PURE__ */ new Map();
      this.roots = /* @__PURE__ */ new Set();
      this.listeners = [
        ...this.host.effects.listeners,
        ["load", (event) => this.onLoad(event)],
        ...STYLE_STATE_EVENTS.flatMap((eventName) => [
          [eventName, (event) => this.onStyleStateChange(event)],
          [eventName, (event) => this.onTopLayerState(event)]
        ])
      ];
      this.onScroll = (event) => {
        const target = event === null || event === void 0 ? void 0 : event.target;
        const scroller = target instanceof Element && target !== document.scrollingElement ? target : null;
        const scriptScroller = scroller !== null && this.host.link.innerScrollMode === "native" && scrollsOnlyFromScript(computedStyle(scroller));
        const movesIslands = scroller === null || this.host.natives.some((handle) => isComposedAncestor(scroller, handle.el));
        if (movesIslands && !scriptScroller)
          this.host.frames.noteScroll();
        this.host.frames.wake();
      };
      this.compositionObserver = new CompositionObserver(() => host.refresh(), onOpenRoot);
    }
    start() {
      watchScriptedAnimations();
      scriptedAnimations.listeners.add(() => {
        this.host.effects.markDue();
        this.host.frames.wake();
      });
      setTopLayerRoots(() => [document, ...this.shadowRoots()]);
      this.mutationObserver = new MutationObserver((records) => this.host.handleDomMutations(records));
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
            this.host.scene.forgetLayers();
          this.host.refresh();
        });
        this.resizeObserver.observe(document.documentElement);
        for (const element of this.sized.keys())
          this.resizeObserver.observe(element);
      }
      this.observeRoot(document);
    }
    /** Watches `element`'s size until as many `unobserveSize` calls release it. */
    observeSize(element) {
      var _a, _b;
      const count = (_a = this.sized.get(element)) !== null && _a !== void 0 ? _a : 0;
      this.sized.set(element, count + 1);
      if (count === 0)
        (_b = this.resizeObserver) === null || _b === void 0 ? void 0 : _b.observe(element);
    }
    unobserveSize(element) {
      var _a;
      const count = this.sized.get(element);
      if (count === void 0)
        return;
      if (count > 1) {
        this.sized.set(element, count - 1);
        return;
      }
      this.sized.delete(element);
      (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.unobserve(element);
    }
    observeRoot(root) {
      if (this.roots.has(root))
        return;
      this.roots.add(root);
      for (const [eventName, listener] of this.listeners)
        root.addEventListener(eventName, listener, true);
      root.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    }
    unobserveRoot(root) {
      if (!this.roots.delete(root))
        return;
      for (const [eventName, listener] of this.listeners)
        root.removeEventListener(eventName, listener, true);
      root.removeEventListener("scroll", this.onScroll, { capture: true });
    }
    /**
     * Mutations not yet delivered, except the runtime's own writes to `box`'s style, which a read
     * made: those that found it as one of `written`. The page's own change to it is kept.
     */
    takePendingMutations(box, written) {
      var _a, _b;
      return ((_b = (_a = this.mutationObserver) === null || _a === void 0 ? void 0 : _a.takeRecords()) !== null && _b !== void 0 ? _b : []).filter((record) => record.target !== box || record.attributeName !== "style" || !written.has(record.oldValue));
    }
    /** What changed since the last plan. */
    get changes() {
      return this.noted;
    }
    /** What changed since the last plan; the next plan starts from nothing. */
    takeChanges() {
      const changes = Object.assign({}, this.noted);
      this.noted.scriptTranslated = false;
      this.noted.domChanged = false;
      return changes;
    }
    /** Where style may have changed since the last plan, or 'all'; the next plan starts from nothing. */
    takeRestyled() {
      return this.styleScope.collect();
    }
    /** Watches what can change how `elements` composite without a mutation or a resize. */
    observeComposition(elements) {
      this.compositionObserver.sync(elements);
    }
    /** Notes what `records` changed and forgets the layers it reaches; null when it changed nothing seen. */
    noteMutations(records) {
      if (records.some((record) => record.type === "childList"))
        this.host.effects.forgetRoots();
      const change = { records: [], hosts: [], reachesAll: false, uncovering: false };
      const roots = [];
      for (const record of records) {
        if (this.host.link.isFenceRecord(record))
          continue;
        if (typeof ShadowRoot !== "undefined" && record.target instanceof ShadowRoot) {
          change.reachesAll = true;
          continue;
        }
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (!target || this.changesNothing(record, target))
          continue;
        if (this.host.scene.notePageChange(target, record.type === "attributes" ? record.attributeName : void 0))
          change.uncovering = true;
        change.records.push(record);
        change.hosts.push(record.type === "attributes" ? target.parentElement : target);
        if (record.type === "attributes" && record.attributeName === "style") {
          const style = target.getAttribute("style");
          if (movesByTranslation(record.oldValue, style))
            this.noted.scriptTranslated = true;
          if (translationOnly(record.oldValue, style))
            continue;
        }
        this.noted.domChanged = true;
        const reached = recordRoots(record);
        if (reached === "all")
          change.reachesAll = true;
        else
          roots.push(...reached);
      }
      if (!change.reachesAll && change.records.length === 0)
        return null;
      if (change.reachesAll) {
        this.styleScope.invalidateIndex();
        forgetKeyframeImpacts();
      }
      if (change.reachesAll || !this.styleScope.scoped)
        this.host.scene.forgetLayers();
      else {
        this.styleScope.noteChange(change.records);
        for (const root of outermost(roots))
          this.host.scene.forgetLayers(root);
      }
      return change;
    }
    shadowRoots() {
      return Array.from(this.roots).filter((root) => typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot);
    }
    /** A change inside hosted content, to an attribute's own value, or that the runtime wrote itself. */
    changesNothing(record, target) {
      if (changesOnlyHostedContent(target, record.type === "childList"))
        return true;
      if (record.type !== "attributes")
        return false;
      if (record.attributeName && target.getAttribute(record.attributeName) === record.oldValue)
        return true;
      return target instanceof HTMLElement && this.host.writes.wrote(target, record.attributeName);
    }
    onLoad(event) {
      var _a;
      if (event.target instanceof HTMLStyleElement || event.target instanceof HTMLLinkElement && /(?:^|\s)stylesheet(?:\s|$)/i.test((_a = event.target.getAttribute("rel")) !== null && _a !== void 0 ? _a : "")) {
        this.styleScope.invalidateIndex();
        this.host.scene.forgetLayers();
      }
      this.host.refresh();
    }
    onStyleStateChange(event) {
      if (event.pointerType === "touch" && event.type !== "pointerup") {
        if (event.type === "pointerdown")
          this.host.link.publishOffsets();
        this.host.frames.wake();
        return;
      }
      const reach = SCOPED_STATE_EVENTS.has(event.type) && event.target instanceof Element ? this.styleScope.stateReach(event.target) : "all";
      if (reach === "all")
        this.host.scene.forgetLayers();
      else {
        for (const element of reach.own)
          this.host.scene.forgetLayers(element, true);
        for (const root of outermost(reach.subtrees))
          this.host.scene.forgetLayers(root);
      }
      this.host.refresh();
    }
    onTopLayerState(event) {
      if (!(event.target instanceof Element))
        return;
      if (event.type === "beforetoggle") {
        noteTopLayerState(event.target, event.newState === "open");
      } else if (event.type === "close" || event.type === "cancel") {
        noteTopLayerState(event.target, false);
      } else {
        const owner = activeTopLayerAncestor(event.target);
        if (owner)
          noteTopLayerState(owner, true);
      }
    }
  }
  const MIN_SAMPLED_SCALE = 0.05;
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
      const transition = probe.getAnimations().find((animation) => transitionPropertyOf(animation) === "transform");
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
  function isIdentity(transform) {
    const motion = transformOf(transform, "transform", 0, 0);
    return !!motion && motion.x === 0 && motion.y === 0 && motion.sx === 1 && motion.sy === 1;
  }
  function currentScale(element, property) {
    const motion = transformOf(computedStyle(element).getPropertyValue(property), property, 0, 0);
    return motion && [motion.sx, motion.sy];
  }
  function ownScale(element, width, height) {
    var _a;
    const style = computedStyle(element);
    const property = transformOf(style.getPropertyValue("scale"), "scale", width, height);
    const transform = (_a = transformOf(style.transform, "transform", width, height)) !== null && _a !== void 0 ? _a : { sx: 1, sy: 1 };
    if (!property)
      return null;
    return { sx: property.sx * transform.sx, sy: property.sy * transform.sy };
  }
  function scaleSample(element, property) {
    var _a;
    const current = currentScale(element, property);
    const origin = ((_a = computedStyle(element).transformOrigin) !== null && _a !== void 0 ? _a : "").trim().split(/\s+/).map((part) => Number.parseFloat(part));
    if (!current || origin.length < 2 || !origin.slice(0, 2).every(Number.isFinite))
      return null;
    return { property, current, originX: round4(origin[0]), originY: round4(origin[1]) };
  }
  function elementFrame(element, allowScale) {
    const rect = element.getBoundingClientRect();
    const html = element instanceof HTMLElement ? element : null;
    const scaled = (drawn, laid) => laid === void 0 || laid <= 0 || Math.abs(drawn - laid) <= 1 ? { size: drawn, scale: 1 } : { size: laid, scale: drawn / laid };
    const horizontal = scaled(rect.width, html === null || html === void 0 ? void 0 : html.offsetWidth);
    const vertical = scaled(rect.height, html === null || html === void 0 ? void 0 : html.offsetHeight);
    const own = allowScale ? ownScale(element, horizontal.size, vertical.size) : { sx: 1, sy: 1 };
    if (own === null)
      return null;
    return {
      width: horizontal.size,
      height: vertical.size,
      parentX: own.sx === 1 ? horizontal.scale : rect.width / (horizontal.size || 1) / own.sx,
      parentY: own.sy === 1 ? vertical.scale : rect.height / (vertical.size || 1) / own.sy
    };
  }
  function readTiming(animation, effect, captureGeometry) {
    var _a, _b, _c, _d, _e;
    const timing = effect.getComputedTiming();
    const easing = parseEasing(typeof timing.easing === "string" ? timing.easing : void 0);
    const duration = typeof timing.duration === "number" ? timing.duration : Number.NaN;
    const iterations = (_a = timing.iterations) !== null && _a !== void 0 ? _a : 1;
    const delay = (_b = timing.delay) !== null && _b !== void 0 ? _b : 0;
    const fill = timing.fill === "auto" || timing.fill === void 0 ? "none" : timing.fill;
    const direction = (_c = timing.direction) !== null && _c !== void 0 ? _c : "normal";
    const iterationStart = (_d = timing.iterationStart) !== null && _d !== void 0 ? _d : 0;
    const currentTime = typeof animation.currentTime === "number" ? animation.currentTime : 0;
    if (easing === null || !Number.isFinite(duration) || duration <= 0 || !(iterations >= 0))
      return null;
    if (!Number.isFinite(animation.playbackRate) || animation.playbackRate === 0)
      return null;
    const roundedStart = delay === 0 && currentTime < 0 && currentTime >= -0.5 && direction === "normal" && !iterationStart;
    if (currentTime < delay && fill !== "backwards" && fill !== "both" && !roundedStart)
      return null;
    return {
      easing,
      duration,
      iterations,
      delay,
      endDelay: (_e = timing.endDelay) !== null && _e !== void 0 ? _e : 0,
      iterationStart,
      direction,
      fill,
      currentTime,
      measuresNow: captureGeometry || roundedStart,
      startsAtFirstFrame: !iterationStart && (direction === "normal" || direction === "alternate")
    };
  }
  function keyframeValues(name, value, frame, properties, allowScale, pxScale) {
    if (name === "transform" || name === "translate") {
      if (properties.transform !== null && properties.transform !== name)
        return null;
      properties.transform = name;
      const motion = transformOf(value, name, frame.width, frame.height, pxScale);
      if (!motion)
        return null;
      const values = [];
      if (name === "transform" && allowScale) {
        if (properties.scale !== null && properties.scale !== "transform")
          return null;
        properties.scale = "transform";
        values.push(["scale", [round4(motion.sx), round4(motion.sy)]]);
      } else if (motion.sx !== 1 || motion.sy !== 1) {
        return null;
      }
      values.push(["translate", [round4(motion.x * frame.parentX), round4(motion.y * frame.parentY)]]);
      return values;
    }
    if (name === "scale" && allowScale) {
      if (properties.scale !== null && properties.scale !== "scale")
        return null;
      properties.scale = "scale";
      const motion = transformOf(value, "scale", frame.width, frame.height);
      return motion && [["scale", [round4(motion.sx), round4(motion.sy)]]];
    }
    if (name === "visibility")
      return [];
    if (name === "opacity") {
      const opacity = Number.parseFloat(value);
      return Number.isFinite(opacity) ? [["opacity", [round4(Math.min(1, Math.max(0, opacity)))]]] : null;
    }
    return null;
  }
  function channelKeyframes(effect, frame, properties, allowScale, pxScale) {
    var _a, _b;
    const perChannel = /* @__PURE__ */ new Map();
    for (const keyframe of effect.getKeyframes()) {
      const offset = (_a = keyframe.computedOffset) !== null && _a !== void 0 ? _a : keyframe.offset;
      if (typeof offset !== "number" || !Number.isFinite(offset))
        return null;
      if (keyframe.composite !== void 0 && keyframe.composite !== "auto" && keyframe.composite !== "replace") {
        return null;
      }
      const easing = parseEasing(typeof keyframe.easing === "string" ? keyframe.easing : void 0);
      if (easing === null)
        return null;
      for (const [name, raw] of Object.entries(keyframe)) {
        if (KEYFRAME_TIMING_FIELDS.has(name))
          continue;
        const value = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null;
        if (value === null)
          return null;
        const values = keyframeValues(name, value, frame, properties, allowScale, pxScale);
        if (!values)
          return null;
        for (const [channel, point] of values) {
          const list = (_b = perChannel.get(channel)) !== null && _b !== void 0 ? _b : [];
          list.push(Object.assign({ offset: round4(offset), value: point }, easing ? { easing } : {}));
          perChannel.set(channel, list);
        }
      }
    }
    const scales = perChannel.get("scale");
    if (scales === null || scales === void 0 ? void 0 : scales.every((point) => point.value[0] === 1 && point.value[1] === 1))
      perChannel.delete("scale");
    else if (scales === null || scales === void 0 ? void 0 : scales.some((point) => !(point.value[0] >= 0 && point.value[1] >= 0)))
      return null;
    return perChannel;
  }
  function anchorOf(element, channel, frames, frame, properties, timing) {
    if (channel === "translate" && properties.transform) {
      const property = properties.transform;
      const measured = timing.measuresNow ? transformOf(computedStyle(element).getPropertyValue(property), property, frame.width, frame.height) : null;
      if (!measured)
        return { anchored: false, geometry: {} };
      const anchored = timing.startsAtFirstFrame;
      const at = anchored ? { x: frames[0].value[0] / frame.parentX, y: frames[0].value[1] / frame.parentY } : { x: measured.x, y: measured.y };
      return {
        anchored,
        geometry: {
          translation: Object.assign(Object.assign({
            anchored,
            property
          }, at), { width: frame.width, height: frame.height, scaleX: frame.parentX, scaleY: frame.parentY })
        }
      };
    }
    if (channel === "scale") {
      const sample = properties.scale && scaleSample(element, properties.scale);
      if (!sample)
        return null;
      const anchored = timing.measuresNow && timing.startsAtFirstFrame;
      const sampled = anchored ? frames[0].value : sample.current;
      if (!(sampled[0] >= MIN_SAMPLED_SCALE && sampled[1] >= MIN_SAMPLED_SCALE))
        return null;
      return {
        anchored,
        geometry: {
          scaling: Object.assign(Object.assign({ anchored, property: sample.property }, timing.measuresNow ? { x: sampled[0], y: sampled[1] } : {}), { originX: sample.originX, originY: sample.originY })
        }
      };
    }
    return { anchored: false, geometry: {} };
  }
  function describeMotion(element, animations, captureGeometry = false, allowScale = false) {
    if (animations.length === 0)
      return null;
    const frame = elementFrame(element, allowScale);
    if (!frame)
      return null;
    const entries = [];
    const channels = /* @__PURE__ */ new Set();
    const properties = { transform: null, scale: null };
    for (const animation of animations) {
      const effect = animation.effect;
      if (!effect || typeof effect.getKeyframes !== "function" || typeof effect.getComputedTiming !== "function") {
        return null;
      }
      if (effect.pseudoElement || effect.composite !== void 0 && effect.composite !== "replace")
        return null;
      const timing = readTiming(animation, effect, captureGeometry);
      if (!timing)
        return null;
      const transition = transitionPropertyOf(animation) !== void 0;
      const perChannel = channelKeyframes(effect, frame, properties, allowScale, transition ? 1 / transitionLengthZoom() : 1);
      if (!perChannel)
        return null;
      for (const [channel, frames] of perChannel) {
        if (channels.has(channel))
          return null;
        if (frames[0].offset !== 0 || frames[frames.length - 1].offset !== 1)
          return null;
        channels.add(channel);
        const anchor = anchorOf(element, channel, frames, frame, properties, timing);
        if (!anchor)
          return null;
        const { anchored, geometry } = anchor;
        entries.push(Object.assign(Object.assign({ animation, measuredAt: performance.now() }, geometry), { payload: Object.assign(Object.assign({ channel, keyframes: frames }, timing.easing ? { easing: timing.easing } : {}), { delay: round4(timing.delay), endDelay: round4(timing.endDelay), duration: round4(timing.duration), iterations: Number.isFinite(timing.iterations) ? timing.iterations : null, iterationStart: timing.iterationStart, direction: timing.direction, fill: timing.fill, startTime: typeof animation.startTime === "number" ? round4(animation.startTime) : 0, playbackRate: animation.playbackRate, sampledTime: anchored ? 0 : round4(timing.currentTime) }) }));
      }
    }
    if (entries.length === 0)
      return null;
    return drawsAsCarried(element, channels, properties) ? entries : null;
  }
  function drawsAsCarried(element, channels, properties) {
    if (channels.has("scale")) {
      const style = computedStyle(element);
      if (propertyIsActive(style, "rotate"))
        return false;
      if (properties.scale === "scale" && (properties.transform === "transform" || !isIdentity(style.transform))) {
        return false;
      }
    }
    const html = element instanceof HTMLElement ? element : null;
    return !(channels.has("opacity") && html && html.children.length > 0 && Number.parseFloat(computedStyle(html).opacity) === 0);
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
        continue;
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
  function drawnOrigin(target, scaling) {
    const { offsetWidth = 0, offsetHeight = 0 } = target;
    if (!(offsetWidth > 0 && offsetHeight > 0))
      return null;
    const drawn = target.getBoundingClientRect();
    return {
      x: drawn.left + drawn.width / offsetWidth * scaling.originX,
      y: drawn.top + drawn.height / offsetHeight * scaling.originY
    };
  }
  const APPLY_LATENCY_SAMPLES = 12;
  const MAX_MOTION_LEAD_FRAMES = 2;
  function pageTime() {
    var _a;
    return typeof ((_a = document.timeline) === null || _a === void 0 ? void 0 : _a.currentTime) === "number" ? document.timeline.currentTime : null;
  }
  class RunningEffects {
    constructor(host) {
      this.host = host;
      this.planned = /* @__PURE__ */ new WeakSet();
      this.announced = /* @__PURE__ */ new Map();
      this.watched = /* @__PURE__ */ new WeakSet();
      this.delayed = /* @__PURE__ */ new WeakSet();
      this.roots = null;
      this.due = true;
      this.listed = [];
      this.scriptedSeen = -1;
      this.frameAnimations = null;
      this.paused = /* @__PURE__ */ new Set();
      this.starting = null;
      this.session = 0;
      this.held = /* @__PURE__ */ new WeakSet();
      this.sentStarts = /* @__PURE__ */ new WeakMap();
      this.applyLatencies = [];
      this.fresh = /* @__PURE__ */ new Set();
      this.timeline = null;
      this.listeners = [
        ["transitionrun", (event) => this.onTransitionRun(event)],
        ["transitionend", (event) => this.onTransitionEnd(event)],
        ["transitioncancel", (event) => this.onTransitionEnd(event)],
        ["animationstart", (event) => this.onAnimationStart(event)],
        ["animationend", (event) => this.onAnimationEnd(event)],
        ["animationcancel", (event) => this.onAnimationEnd(event)]
      ];
    }
    /** Something may have started an animation: the next frame lists them again. */
    markDue() {
      this.due = true;
    }
    /** What is registered, or the DOM's structure, changed. */
    forgetRoots() {
      this.roots = null;
    }
    /**
     * Lists the running animations for this frame's plan. Returns those no plan has seen yet, and
     * holds those of them that start this frame; while the page is `scrolling`, those far from every
     * island count as seen.
     */
    listFrame(scrolling) {
      if (this.due || scriptedAnimations.unwatched || this.scriptedSeen !== scriptedAnimations.count) {
        this.due = false;
        this.scriptedSeen = scriptedAnimations.count;
        this.listed = this.running();
      } else {
        this.listed = this.listed.filter((animation) => this.isRunning(animation));
      }
      this.frameAnimations = this.listed;
      const fresh = [];
      for (const animation of this.listed) {
        if (this.planned.has(animation))
          continue;
        if (scrolling && !this.mayReachIsland(animation)) {
          this.planned.add(animation);
          continue;
        }
        fresh.push(animation);
      }
      this.holdStarting(fresh);
      return fresh;
    }
    endFrame() {
      this.frameAnimations = null;
    }
    mayReachIsland(animation) {
      var _a, _b;
      const target = (_b = (_a = animation.effect) === null || _a === void 0 ? void 0 : _a.target) !== null && _b !== void 0 ? _b : null;
      return !target || this.host.mayReachIsland(target);
    }
    /** The effects a plan reads: the frame's animations, less those still in their delay, and those events announced. */
    collect() {
      var _a, _b;
      const running = [];
      for (const animation of (_a = this.frameAnimations) !== null && _a !== void 0 ? _a : this.running()) {
        if (this.waitingOutDelay(animation))
          continue;
        const impact = animationImpact(animation);
        const target = animationTarget(animation);
        if (!target || impact === "none")
          continue;
        this.watchEnd(animation);
        const pseudo = !!((_b = animation.effect) === null || _b === void 0 ? void 0 : _b.pseudoElement);
        running.push({ target, impact, animation, pseudo });
      }
      for (const [target, effects] of this.announced) {
        for (const [key, impact] of effects)
          running.push({ target, impact, key });
      }
      return running;
    }
    pruneDetached() {
      for (const element of this.announced.keys()) {
        if (!element.isConnected)
          this.announced.delete(element);
      }
    }
    /** Whether motion is held for, or starting with, a plan still to be delivered. */
    get busy() {
      return this.paused.size > 0 || this.starting !== null;
    }
    /** Held motion waits for the layout that starts it. */
    get preparing() {
      return this.paused.size > 0 && this.starting !== null;
    }
    /**
     * A plan starts with `fresh`, the animations no plan has seen, and sees every animation this
     * frame listed; returns the motion held paused now.
     */
    beginPlan(fresh) {
      var _a;
      this.fresh = new Set(fresh);
      this.timeline = pageTime();
      const paused = new Set(this.paused);
      for (const animation of (_a = this.frameAnimations) !== null && _a !== void 0 ? _a : [])
        this.planned.add(animation);
      return paused;
    }
    /** Holds those of `fresh`, the animations no plan has seen, that start this frame. */
    holdStarting(fresh) {
      const timeline = pageTime();
      for (const animation of fresh) {
        if (startsThisFrame(animation, timeline, true))
          this.hold(animation);
      }
    }
    /**
     * Starts the motion held for this plan, `delay` after the next frame it can reach native in,
     * unless it still waits for native: returns that motion, which the plan then carries paused.
     */
    startWithPlan(delay) {
      if (this.preparing)
        return this.starting;
      this.start(delay);
      return null;
    }
    hold(animation) {
      var _a, _b, _c;
      const target = (_a = animation.effect) === null || _a === void 0 ? void 0 : _a.target;
      if (this.host.scriptTranslated() || !this.host.motionStartsAtCommit() || this.paused.has(animation) || this.held.has(animation) || !target || !this.host.natives.some((handle) => isComposedAncestor(target, handle.el)))
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
      const session = this.session;
      const held = /* @__PURE__ */ new Set();
      for (const sibling of siblings) {
        if (this.held.has(sibling) || sibling.startTime !== start || sibling.playState !== "running" && !sibling.pending)
          continue;
        sibling.pause();
        sibling.currentTime = 0;
        this.paused.add(sibling);
        this.held.add(sibling);
        held.add(sibling);
      }
      void afterNextPaint().then(() => {
        var _a2;
        if (session !== this.session)
          return;
        if (!Array.from(held).some((sibling) => this.paused.has(sibling)))
          return;
        if ((_a2 = this.starting) === null || _a2 === void 0 ? void 0 : _a2.animations.has(animation))
          this.start(0);
        else
          this.release(held);
      });
    }
    /** Whether `starting` still waits paused for the layout that carries it. */
    waitsFor(starting) {
      return this.starting === starting && Array.from(starting.animations).some((animation) => this.paused.has(animation) && animation.playState === "paused");
    }
    /** Native has the layout that carries `starting` paused: it starts now, unless motion moved on. */
    startHeld(starting) {
      if (this.starting === starting)
        this.start(0);
    }
    /** Starts the motion held for the plan, `delay` after the next frame it can reach native in. */
    start(delay) {
      const starting = this.starting;
      this.starting = null;
      if (!starting) {
        this.release();
        return;
      }
      this.release(starting.animations);
      const atCommit = this.host.motionStartsAtCommit();
      const earliest = performance.now() + delay + this.lead();
      const at = atCommit ? performance.now() : round3(motionStartTime(earliest, this.host.clock.lastFrameTime, this.host.clock.interval));
      if (!atCommit)
        startMotionAt(starting.animations, at);
      for (const entry of starting.entries) {
        const own = entry.animation.startTime;
        entry.payload.startTime = this.sentStart(entry.animation, typeof own === "number" ? own : at);
      }
    }
    release(animations = this.paused) {
      for (const animation of animations) {
        if (!this.paused.delete(animation))
          continue;
        if (animation.playState === "paused")
          animation.play();
      }
    }
    /** Releases everything and forgets what was held, as a new transport session starts. */
    reset() {
      this.release();
      this.session += 1;
      this.held = /* @__PURE__ */ new WeakSet();
      this.applyLatencies = [];
    }
    noteApplyLatency(latency) {
      if (!Number.isFinite(latency) || latency < 0)
        return;
      this.applyLatencies.push(latency);
      if (this.applyLatencies.length > APPLY_LATENCY_SAMPLES)
        this.applyLatencies.shift();
    }
    /**
     * The motions of `targets` as the plan sends them. Motion starting with this plan is stamped with
     * its start, or, where it must wait for native, kept as `starting`.
     */
    payloads(motion, targets, effects) {
      var _a, _b;
      const entries = Array.from(targets).flatMap((target) => {
        var _a2;
        return (_a2 = motion.entries.get(target)) !== null && _a2 !== void 0 ? _a2 : [];
      });
      const startsNow = (animation) => this.paused.has(animation) || startsThisFrame(animation, this.timeline, this.fresh.has(animation));
      const started = entries.filter((entry) => startsNow(entry.animation));
      this.starting = null;
      if (started.length > 0 && this.host.motionStartsAtCommit() && this.paused.size === 0) {
        for (const entry of started) {
          const start = entry.animation.startTime;
          entry.payload.startTime = typeof start === "number" ? start : (_a = this.timeline) !== null && _a !== void 0 ? _a : entry.payload.startTime;
        }
      } else if (started.length > 0) {
        this.starting = {
          entries: started,
          animations: /* @__PURE__ */ new Set([
            ...started.map((entry) => entry.animation),
            ...effects.flatMap((effect) => effect.animation && startsNow(effect.animation) ? [effect.animation] : [])
          ])
        };
      }
      const deferred = new Set((_b = this.starting) === null || _b === void 0 ? void 0 : _b.entries);
      for (const entry of entries) {
        if (!deferred.has(entry))
          entry.payload.startTime = this.sentStart(entry.animation, entry.payload.startTime);
      }
      return Array.from(targets, (target) => {
        var _a2;
        return {
          id: motion.idFor(target),
          animations: ((_a2 = motion.entries.get(target)) !== null && _a2 !== void 0 ? _a2 : []).map((entry) => entry.payload)
        };
      });
    }
    /** The start native was first sent for `animation`, kept once WebKit resolves its own. */
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
    lead() {
      const interval = this.host.clock.interval;
      if (this.applyLatencies.length === 0)
        return interval;
      const sorted = [...this.applyLatencies].sort((left, right) => right - left);
      return Math.min(sorted[Math.min(2, sorted.length - 1)], MAX_MOTION_LEAD_FRAMES * interval);
    }
    isRunning(animation) {
      return animation.playState === "running" || animation.pending || this.paused.has(animation);
    }
    running() {
      const found = /* @__PURE__ */ new Set();
      const append = (animation) => {
        if (this.isRunning(animation))
          found.add(animation);
      };
      const getDocumentAnimations = document.getAnimations;
      if (typeof getDocumentAnimations === "function") {
        for (const animation of Array.from(getDocumentAnimations.call(document)))
          append(animation);
      }
      for (const root of this.shadowRootsHolding()) {
        const getAnimations = root.getAnimations;
        if (typeof getAnimations === "function") {
          for (const animation of Array.from(getAnimations.call(root)))
            append(animation);
        }
      }
      return Array.from(found);
    }
    shadowRootsHolding() {
      if (this.roots)
        return this.roots;
      const roots = /* @__PURE__ */ new Set();
      for (const handle of [...this.host.natives, ...this.host.layers]) {
        let current = handle.el;
        while (current) {
          const root = current.getRootNode();
          if (root instanceof ShadowRoot)
            roots.add(root);
          current = composedParentElement(current);
        }
      }
      this.roots = [...roots];
      return this.roots;
    }
    /** An animation still in its delay with no backwards fill draws nothing yet, so it is planned when it starts. */
    waitingOutDelay(animation) {
      var _a;
      const effect = animation.effect;
      if (!effect || animation.playState !== "running" || typeof effect.getComputedTiming !== "function")
        return false;
      const timing = effect.getComputedTiming();
      const local = timing.localTime;
      const delay = (_a = timing.delay) !== null && _a !== void 0 ? _a : 0;
      if (timing.progress !== null || typeof local !== "number" || local >= delay || animation.playbackRate <= 0) {
        return false;
      }
      if (!this.delayed.has(animation)) {
        this.delayed.add(animation);
        window.setTimeout(() => {
          this.delayed.delete(animation);
          this.host.refresh();
        }, (delay - local) / animation.playbackRate);
      }
      return true;
    }
    watchEnd(animation) {
      if (this.watched.has(animation))
        return;
      this.watched.add(animation);
      const ended = () => {
        if (this.endsUnseen(animationTarget(animation), animationImpact(animation)))
          return;
        this.host.refresh();
      };
      void animation.finished.then(ended, ended);
    }
    /** Whether an effect ending changed no layout and neither holds an island nor paints where one is. */
    endsUnseen(target, impact) {
      if (!target || impact === void 0 || impact === "global-layout")
        return false;
      return !this.host.mayReachIsland(target);
    }
    begin(target, key, impact, animation) {
      var _a;
      this.due = true;
      if (!(target instanceof Element) || impact === "none")
        return;
      if (animation && !this.planned.has(animation))
        this.hold(animation);
      const effects = (_a = this.announced.get(target)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Map();
      effects.set(key, impact);
      this.announced.set(target, effects);
      if (!animation || !this.planned.has(animation))
        this.host.refresh();
    }
    end(target, key) {
      this.due = true;
      if (!(target instanceof Element))
        return;
      const effects = this.announced.get(target);
      const impact = effects === null || effects === void 0 ? void 0 : effects.get(key);
      if (effects) {
        effects.delete(key);
        if (effects.size === 0)
          this.announced.delete(target);
      }
      if (this.endsUnseen(target, impact))
        return;
      this.host.refresh();
    }
    onTransitionRun(event) {
      if (!(event instanceof TransitionEvent))
        return;
      const element = event.target;
      const getAnimations = element instanceof Element ? element.getAnimations : void 0;
      const transition = typeof getAnimations === "function" ? Array.from(getAnimations.call(element)).find((candidate) => transitionPropertyOf(candidate) === event.propertyName) : void 0;
      this.begin(element, `transition:${event.propertyName}`, transitionImpact(element, event.propertyName), transition);
    }
    onTransitionEnd(event) {
      if (event instanceof TransitionEvent)
        this.end(event.target, `transition:${event.propertyName}`);
    }
    onAnimationStart(event) {
      if (!(event instanceof AnimationEvent) || !(event.target instanceof Element))
        return;
      const target = event.target;
      const getAnimations = target.getAnimations;
      const animation = typeof getAnimations === "function" ? Array.from(getAnimations.call(target, { subtree: true })).find((candidate) => {
        var _a;
        const effect = candidate.effect;
        return (effect === null || effect === void 0 ? void 0 : effect.target) === target && ((_a = effect.pseudoElement) !== null && _a !== void 0 ? _a : "") === event.pseudoElement && candidate.animationName === event.animationName && this.isRunning(candidate);
      }) : void 0;
      this.begin(target, `animation:${event.animationName}`, animation ? animationImpact(animation) : "global-layout", animation);
    }
    onAnimationEnd(event) {
      if (event instanceof AnimationEvent)
        this.end(event.target, `animation:${event.animationName}`);
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
  function inOwnBox(desired, [scaleX, scaleY]) {
    if (scaleX === 1 && scaleY === 1)
      return desired;
    const { rect } = desired;
    const own = (box) => Object.assign({ x: round2(rect.x + (box.x - rect.x) / scaleX), y: round2(rect.y + (box.y - rect.y) / scaleY), w: round2(box.w / scaleX), h: round2(box.h / scaleY) }, box.r && { r: scaledRadii(box.r, 1 / scaleX) });
    return Object.assign(Object.assign({}, desired), { rect: own(rect), holes: desired.holes.map(own) });
  }
  function clipValues(clip) {
    const box = clip.rect;
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
  function roundedHolesOverlap(holes) {
    return holes.some((left, index) => holes.slice(index + 1).some((right) => intersects(left, right) && (hasComplexOpaqueShape(left) || hasComplexOpaqueShape(right))));
  }
  function coversViewport(layer) {
    if (layer.el === document.documentElement)
      return true;
    if (layer.el === document.body && bodyBackgroundPropagates())
      return true;
    return layer.scrollPath.length === 0 && contains(layer.visualRect, windowRect(layer.coordinateSpace));
  }
  const UNFOLLOWED_STICKY = {
    reason: "web layers in a sticky box native cannot follow cannot use native cutouts",
    mayMoveWithoutRefresh: true
  };
  function edgeStrip(cover, island) {
    const spansX = cover.x <= island.x && cover.x + cover.w >= island.x + island.w;
    const spansY = cover.y <= island.y && cover.y + cover.h >= island.y + island.h;
    return spansX && (cover.y <= island.y || cover.y + cover.h >= island.y + island.h) || spansY && (cover.x <= island.x || cover.x + cover.w >= island.x + island.w);
  }
  const clipsProtectedSurface = (native) => !!(native.handle.requiresUnobscuredSurface && native.handle.supportsProtectedSurfaceClip);
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
  const notCarrying = (targets, native) => (targets !== null && targets !== void 0 ? targets : []).some((target) => !isComposedAncestor(target, native.el));
  function movesAgainst(layer, native) {
    return notCarrying(layer.movers, native);
  }
  function animatesAgainst(layer, native) {
    return notCarrying(layer.animators, native);
  }
  function animatesAgainstCut(layer, native) {
    return notCarrying(layer.cutAnimators, native);
  }
  function reachFrom(layer, native) {
    return movesAgainst(layer, native) ? Object.assign(Object.assign({}, layer), { paintEscapesRect: true }) : layer;
  }
  function canMeet(left, right) {
    return canMoveIntoIntersection(reachFrom(left, right), reachFrom(right, left));
  }
  const SIDES = ["Top", "Right", "Bottom", "Left"];
  function ownBoxPaints(element) {
    const style = computedStyle(element);
    const visible = (color) => {
      var _a;
      return ((_a = colorAlpha(color)) !== null && _a !== void 0 ? _a : 1) > 0;
    };
    const border = SIDES.some((side) => Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none" && visible(style[`border${side}Color`]));
    return visible(style.backgroundColor) || hasBackgroundImage(style) || border || style.boxShadow !== "" && style.boxShadow !== "none" || hasOuterDecoration(style) || hasVisiblePseudoElement(element, true);
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
    const widths = borderWidths(style);
    const painted = SIDES.some((side, index) => style[`border${side}Style`] !== "none" && !isTransparent(style[`border${side}Color`]) && widths[index] > 0);
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
  function scrollingHoleCarries(native, layer) {
    const scroller = innermostScroller(native.scrollPath);
    if (!scroller || !(layer.el === scroller || isComposedAncestor(layer.el, scroller)))
      return false;
    const basis = coordinateBasis(scroller);
    return native.coordinateSpace === basis.coordinateSpace && sameScrollPath(native.scrollPath.slice(0, -1), basis.scrollPath) && staticallyAbove(layer, basis);
  }
  function hidesIsland(cover, native, shown) {
    var _a, _b;
    return cover.cutoutIssue === null && !cover.translucentFill && ((_b = (_a = cover.animators) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) === 0 && isElementVisible(cover.el) && above(cover, native) && opaqueContainsRect(cover.visualRect, shown);
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
  function canClipLayerAsUnit(layer, native) {
    return establishesStackingContext(layer.el) && !isComposedAncestor(layer.el, native) && auditWebLayerCutoutComposition(layer.el, layer.scrollPath, {
      allowViewportPosition: layer.coordinateSpace === "viewport"
    }) === null;
  }
  const MAX_PAINT_PASSES = 8;
  const MASK_OVERRIDDEN = "authored mask properties override native knockout geometry";
  const BACKGROUND_INSEPARABLE = "the page background cannot be separated from its web content";
  function transitionsBackground(style) {
    var _a, _b;
    const properties = ((_a = style.transitionProperty) !== null && _a !== void 0 ? _a : "").split(",").map((property) => property.trim());
    const durations = ((_b = style.transitionDuration) !== null && _b !== void 0 ? _b : "").split(",").map((duration) => parseFloat(duration) || 0);
    return properties.some((property, index) => {
      var _a2;
      return (property === "all" || property.startsWith("background")) && ((_a2 = durations[index % durations.length]) !== null && _a2 !== void 0 ? _a2 : 0) > 0;
    });
  }
  function finishBackgroundTransitions(element) {
    var _a, _b, _c;
    for (const animation of (_b = (_a = element.getAnimations) === null || _a === void 0 ? void 0 : _a.call(element)) !== null && _b !== void 0 ? _b : []) {
      if ((_c = transitionPropertyOf(animation)) === null || _c === void 0 ? void 0 : _c.startsWith("background"))
        animation.finish();
    }
  }
  const CLIP_ATTRIBUTE = "data-ni-runtime-clip";
  const BACKGROUND_ATTRIBUTE = "data-ni-runtime-background";
  function inlineValues(element, properties) {
    return new Map(Array.from(properties, (property) => [property, element.style.getPropertyValue(property)]));
  }
  function snapshotStyle(element, properties) {
    return new Map(Array.from(properties, (property) => [
      property,
      { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }
    ]));
  }
  function holds(element, property, value) {
    return element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === "";
  }
  function writeStyle(element, values) {
    let wrote = false;
    for (const [property, value] of values) {
      if (holds(element, property, value))
        continue;
      element.style.setProperty(property, value);
      wrote = true;
    }
    return wrote;
  }
  function takenOver(element, attribute, written, mark) {
    if (attribute === "style") {
      return !Array.from(written.applied).every(([property, value]) => holds(element, property, value));
    }
    return attribute === mark ? !element.hasAttribute(mark) : null;
  }
  class RuntimeWrites {
    constructor() {
      this.styles = /* @__PURE__ */ new WeakMap();
      this.attributes = /* @__PURE__ */ new WeakMap();
    }
    /** Whether a change to `attribute` on `element` leaves it as the runtime last wrote it. */
    wrote(element, attribute) {
      if (attribute === "style")
        return this.styles.get(element) === element.style.cssText;
      const written = this.attributes.get(element);
      return attribute !== null && (written === null || written === void 0 ? void 0 : written.has(attribute)) === true && written.get(attribute) === element.getAttribute(attribute);
    }
    /** The runtime set or removed `name` on `element`. */
    attribute(element, name) {
      let attributes = this.attributes.get(element);
      if (!attributes)
        this.attributes.set(element, attributes = /* @__PURE__ */ new Map());
      attributes.set(name, element.getAttribute(name));
    }
    /** The runtime wrote `element`'s inline style. */
    style(element) {
      this.styles.set(element, element.style.cssText);
    }
  }
  class RuntimePaint {
    constructor(host) {
      this.host = host;
      this.clips = /* @__PURE__ */ new Map();
      this.backgrounds = /* @__PURE__ */ new Map();
      this.desired = /* @__PURE__ */ new Map();
      this.panes = /* @__PURE__ */ new Map();
      this.ownScrollerPaint = /* @__PURE__ */ new Map();
      this.rejectedMasks = /* @__PURE__ */ new Map();
      this.rejectedBackgrounds = /* @__PURE__ */ new Set();
      this.sourcesDirty = false;
      this.anchoredHoles = [];
    }
    /** Each scroller pane native paints, with its color. */
    get paneColors() {
      return this.panes;
    }
    /** The scrollers whose background the runtime took, with their own solid color before it did. */
    get scrollerPaint() {
      return this.ownScrollerPaint;
    }
    /** The background paint the page draws on `element` while the runtime holds it, if it does. */
    backgroundSource(element) {
      var _a;
      return (_a = this.backgrounds.get(element)) === null || _a === void 0 ? void 0 : _a.source;
    }
    /** Whether the runtime holds a clip it wrote on `element`. */
    ownsClip(element) {
      return this.clips.has(element);
    }
    /** The page changed: a write it refused may take now. */
    pageChanged() {
      this.rejectedMasks.clear();
      this.rejectedBackgrounds.clear();
    }
    /** `element` no longer takes part in plans: a mask it refused is forgotten. */
    forgetMask(element) {
      this.rejectedMasks.delete(element);
    }
    /**
     * Style may have changed on `element` (and in it, unless `own`), or anywhere: a background the
     * runtime holds there may no longer be what the page paints, so the next plan takes it again.
     */
    restyled(element, own = false) {
      var _a;
      if (!element) {
        this.pageChanged();
        this.sourcesDirty = this.backgrounds.size > 0;
        return;
      }
      for (const held of this.backgrounds.keys()) {
        if (held === element || !own && ((_a = element.contains) === null || _a === void 0 ? void 0 : _a.call(element, held)))
          this.sourcesDirty = true;
      }
    }
    /** Gives back every background held, once the page may have restyled one since it was written. */
    releaseStaleBackgrounds() {
      if (this.sourcesDirty)
        this.releaseBackgrounds();
    }
    /**
     * Writes the paint the plan wants, planning again while a write changes what it read (a clip
     * that makes a stacking context, a background the page would not draw). Returns the pages that
     * keep holes for islands native may still show under them.
     */
    apply(natives, layers, canvas, covered = [], handoffs = /* @__PURE__ */ new Map()) {
      for (let pass = 1; ; pass++) {
        const { paint, held } = this.desirePaint(natives, layers, canvas, covered, handoffs);
        if (this.reconcile(paint) || pass === MAX_PAINT_PASSES)
          return held;
      }
    }
    desirePaint(natives, layers, stack, covered, handoffs) {
      var _a;
      const clippedLayers = [...layers, ...covered];
      const current = new Set(clippedLayers.map((layer) => layer.el));
      for (const element of this.rejectedMasks.keys()) {
        if (!current.has(element))
          this.rejectedMasks.delete(element);
      }
      for (const [element, clip] of this.clips) {
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
        let relocated = /* @__PURE__ */ new Set();
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
            suspend(native, MASK_OVERRIDDEN);
        }
        const scrolling = this.host.compositionEnabled ? withSceneReadScope(() => this.planScrollingHoles(natives.filter((native) => !native.holding || native.heldInPlace), layers, relocated)) : { scrollports: /* @__PURE__ */ new Map(), backgrounds: /* @__PURE__ */ new Map() };
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
          const rawHoles = this.host.compositionEnabled ? hidden ? [layer.rect] : [
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
              // A hole stays where its island holds on screen; one whose island travels with the
              // surface moves with it.
              anchored: backgroundCandidates.some(({ native }) => native.holding)
            };
            if (separable(layer.el, background))
              desire(layer.el).background = background;
            else
              for (const native of [
                ...backgroundCandidates.map(({ native: native2 }) => native2),
                ...scrollports.flatMap(({ islands }) => islands)
              ])
                suspend(native, BACKGROUND_INSEPARABLE);
            if (!clipLayerAsUnit)
              continue;
          }
          const kind = !hidden && (unionMask || clipCandidates.some(({ native }) => !native.interactive)) ? "mask" : "path";
          if (kind === "mask" && this.maskRejected(layer.el)) {
            for (const { native } of clipCandidates)
              suspend(native, MASK_OVERRIDDEN);
            continue;
          }
          desire(layer.el).clip = {
            kind,
            rect: layer.rect,
            holes,
            anchored: !hidden && clipCandidates.some(({ native }) => native.holding)
          };
          if (hidden)
            held.set(layer.el, planned(natives, "underlay").map((native) => Object.assign({}, native)));
          else if (kept.length > 0)
            held.set(layer.el, kept);
        }
        for (const [scroller, { rect, color, islands }] of scrolling.backgrounds) {
          const paneColor = this.host.capabilities.paneColor ? opaqueHexColor(color) : null;
          const holes = islands.filter((native) => native.active).map((native) => native.rect);
          const unionMask = !paneColor && roundedHolesOverlap(holes);
          const background = Object.assign({ rect, holes: paneColor ? [rect] : unionMask ? holes : disjointHoles(holes), unionMask, attachment: "local", source: Object.assign(Object.assign({}, TRANSPARENT_PAINT), { color }), anchored: false }, paneColor && { paneColor });
          if (separable(scroller, background))
            desire(scroller).background = background;
          else
            for (const native of islands)
              suspend(native, BACKGROUND_INSEPARABLE);
        }
        if (!suspended)
          return { paint, held };
      }
    }
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
            if (scrollingHoleCarries(native, layer) && canMeet(native, layer) && above(native, layer))
              candidates.add(native);
          }
        }
        for (const native of candidates) {
          if (stationaryCoordinatePaths(native, layer))
            continue;
          const scroller = innermostScroller(native.scrollPath);
          if (scroller)
            groups.set(scroller, ((_a = groups.get(scroller)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Set()).add(native));
          else
            refuse(native);
        }
      }
      for (const [scroller, group] of groups) {
        const basis = coordinateBasis(scroller);
        const documentPort = scrollContainerRect(scroller);
        const scrollport = documentPort && basis.coordinateSpace === "viewport" ? documentToViewport(documentPort) : documentPort;
        const islands = Array.from(group).filter((native) => native.active);
        const ownLayer = layers.find((layer) => layer.el === scroller);
        const outside = layers.filter((layer) => layer.el !== scroller && !relocatedCanvas.has(layer.el) && isComposedAncestor(layer.el, scroller) && layer.backgroundPaint !== null);
        let ownPaint = this.ownScrollerPaint.get(scroller);
        if (ownPaint === void 0 || !this.backgrounds.has(scroller)) {
          const own = computedStyle(scroller);
          ownPaint = own.backgroundImage === "none" ? own.backgroundColor : null;
          this.ownScrollerPaint.set(scroller, ownPaint);
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
          return cut !== null && ((_a2 = layer.backgroundPaint) === null || _a2 === void 0 ? void 0 : _a2.image) === "none" && staticallyAbove(layer, basis) && contains(layer.rect, cut);
        }) && !(ownLayer && knockoutCandidates(natives, ownLayer).some(({ native }) => stationaryCoordinatePaths(native, ownLayer))) && !layers.some((layer) => layer.el !== scroller && !isComposedAncestor(layer.el, scroller) && !isComposedAncestor(scroller, layer.el) && comparePaintOrder(layer.el, scroller) < 0 && isElementVisible(layer.el) && documentPort !== null && intersects(layer.visualRect, documentPort));
        if (!movable) {
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
    /**
     * An author changed `attribute` on `target`: paint they took over is let go. `releaseCoveredClip`
     * lets go of the whole clip on a covered page that no longer holds an island.
     */
    noteAuthorChange(target, attribute, releaseCoveredClip) {
      var _a;
      const clip = this.clips.get(target);
      if (clip && ((_a = takenOver(target, attribute, clip, CLIP_ATTRIBUTE)) !== null && _a !== void 0 ? _a : releaseCoveredClip))
        this.releaseClip(target);
      const background = this.backgrounds.get(target);
      if (!background)
        return;
      const taken = takenOver(target, attribute, background, BACKGROUND_ATTRIBUTE);
      if (taken === null)
        this.sourcesDirty = true;
      else if (taken)
        this.releaseBackground(target);
    }
    /** Lets go of everything written. */
    release() {
      this.anchoredHoles = [];
      for (const element of this.clips.keys())
        this.releaseClip(element);
      this.releaseBackgrounds();
      this.desired = /* @__PURE__ */ new Map();
    }
    /** Marks `element` with `attribute`; true when it was not already marked. */
    mark(element, attribute) {
      if (element.hasAttribute(attribute))
        return false;
      element.setAttribute(attribute, "");
      this.host.writes.attribute(element, attribute);
      return true;
    }
    /**
     * Puts back what `element` had for each property that still holds what the runtime applied, and
     * takes off `attribute`.
     */
    giveBack(element, written, attribute) {
      for (const [property, value] of written.applied) {
        if (!holds(element, property, value))
          continue;
        const original = written.original.get(property);
        if (original === null || original === void 0 ? void 0 : original.value)
          element.style.setProperty(property, original.value, original.priority);
        else
          element.style.removeProperty(property);
      }
      if (element.hasAttribute(attribute)) {
        element.removeAttribute(attribute);
        this.host.writes.attribute(element, attribute);
      }
      this.host.writes.style(element);
    }
    releaseClip(element) {
      const state = this.clips.get(element);
      if (!state)
        return;
      this.giveBack(element, state, CLIP_ATTRIBUTE);
      this.clips.delete(element);
      resetPaintOrderCache();
    }
    releaseBackground(element) {
      this.ownScrollerPaint.delete(element);
      this.panes.delete(element);
      const state = this.backgrounds.get(element);
      if (!state)
        return;
      this.giveBack(element, state, BACKGROUND_ATTRIBUTE);
      if (state.transitions)
        finishBackgroundTransitions(element);
      this.backgrounds.delete(element);
    }
    releaseBackgrounds() {
      for (const element of this.backgrounds.keys())
        this.releaseBackground(element);
      this.sourcesDirty = false;
    }
    writeBackground(element, background) {
      let state = this.backgrounds.get(element);
      if (!state) {
        state = {
          original: snapshotStyle(element, BACKGROUND_PROPERTIES),
          applied: /* @__PURE__ */ new Map(),
          source: background.source,
          transitions: transitionsBackground(computedStyle(element))
        };
        this.backgrounds.set(element, state);
      }
      const values = backgroundValues(inOwnBox(background, this.host.drawnAt(element)));
      if (!values)
        return false;
      let wrote = writeStyle(element, values);
      state.applied = inlineValues(element, BACKGROUND_PROPERTIES);
      if (this.mark(element, BACKGROUND_ATTRIBUTE))
        wrote = true;
      this.host.writes.style(element);
      if (!wrote && state.verified)
        return true;
      state.verified = false;
      if (state.transitions)
        finishBackgroundTransitions(element);
      const applied = computedStyle(element);
      const image = values.get("background-image");
      if (isTransparent(applied.backgroundColor) && (image === "none" ? applied.backgroundImage === "none" : hasBackgroundImage(applied))) {
        state.verified = true;
        return true;
      }
      this.releaseBackground(element);
      this.rejectedBackgrounds.add(element);
      return false;
    }
    writeClip(element, clip) {
      const values = clipValues(inOwnBox(clip, this.host.drawnAt(element)));
      let state = this.clips.get(element);
      if (!state) {
        state = { kind: clip.kind, original: snapshotStyle(element, values.keys()), applied: /* @__PURE__ */ new Map() };
        this.clips.set(element, state);
      }
      if (writeStyle(element, values))
        resetPaintOrderCache();
      state.applied = inlineValues(element, values.keys());
      this.mark(element, CLIP_ATTRIBUTE);
      this.host.writes.style(element);
      if (clip.kind === "mask" && !runtimeOwnsMask(element, computedStyle(element))) {
        this.releaseClip(element);
        this.rejectedMasks.set(element, maskStyleKey(element));
        return false;
      }
      return true;
    }
    /** Moves the holes of anchored paint with its element, which moved in the document since the plan. */
    followAnchoredHoles() {
      for (const anchored of this.anchoredHoles) {
        const { el, channel } = anchored;
        const wanted = this.desired.get(el);
        const applied = channel === "clip" ? this.clips.get(el) : this.backgrounds.get(el);
        if (!el.isConnected || !(wanted === null || wanted === void 0 ? void 0 : wanted[channel]) || !applied)
          continue;
        const box = docRect(el);
        if (Math.abs(box.x - anchored.rect.x) < 0.25 && Math.abs(box.y - anchored.rect.y) < 0.25)
          continue;
        anchored.rect = Object.assign(Object.assign({}, anchored.rect), { x: box.x, y: box.y });
        if (channel === "clip" && wanted.clip)
          this.writeClip(el, Object.assign(Object.assign({}, wanted.clip), { rect: anchored.rect }));
        if (channel === "background" && wanted.background) {
          this.writeBackground(el, Object.assign(Object.assign({}, wanted.background), { rect: anchored.rect }));
        }
      }
    }
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
     * Writes `paint` and lets go of what it no longer wants; false when a write was refused or
     * changed which elements establish stacking contexts, so the plan it came from is stale.
     */
    reconcile(paint) {
      var _a, _b, _c;
      let settled = true;
      for (const [element, clip] of this.clips) {
        if (((_b = (_a = paint.get(element)) === null || _a === void 0 ? void 0 : _a.clip) === null || _b === void 0 ? void 0 : _b.kind) === clip.kind)
          continue;
        const before = establishesStackingContext(element);
        this.releaseClip(element);
        if (establishesStackingContext(element) !== before)
          settled = false;
      }
      for (const element of this.backgrounds.keys()) {
        if (!((_c = paint.get(element)) === null || _c === void 0 ? void 0 : _c.background))
          this.releaseBackground(element);
      }
      for (const [element, { clip, background }] of paint) {
        if (background && !this.writeBackground(element, background))
          settled = false;
        if (!clip)
          continue;
        const before = this.clips.has(element) ? null : establishesStackingContext(element);
        if (!this.writeClip(element, clip))
          settled = false;
        else if (before !== null && establishesStackingContext(element) !== before)
          settled = false;
      }
      this.remember(paint);
      return settled;
    }
    remember(paint) {
      this.desired = new Map(paint);
      this.anchoredHoles = [];
      this.panes.clear();
      for (const [el, { clip, background }] of paint) {
        if ((clip === null || clip === void 0 ? void 0 : clip.anchored) && this.clips.has(el)) {
          this.anchoredHoles.push({ el, channel: "clip", rect: clip.rect });
        }
        if (!background || !this.backgrounds.has(el))
          continue;
        if (background.anchored)
          this.anchoredHoles.push({ el, channel: "background", rect: background.rect });
        if (background.paneColor)
          this.panes.set(el, background.paneColor);
      }
    }
  }
  function readNativeState(handle, dom, reading) {
    const { el } = handle;
    const { motion } = reading;
    const attempting = handle.canAttemptNative();
    const visible = attempting && isElementVisible(el);
    const positionedAncestor = attempting ? fixedOrStickyAncestor(el) : null;
    const basis = coordinateBasis(el, visible ? scrollPath(el) : []);
    const { coordinateSpace } = basis;
    const linear = visible ? drawnLinear(el) : IDENTITY;
    const stickyBox = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" ? positionedAncestor.element : null;
    const sticky = stickyBox ? reading.stickyMotion(stickyBox, basis) : null;
    const overlayOnly = (
      // Holes cut around a turned or skewed island would be square to the screen; a sticky one moves
      // over the page it scrolls with, which holes under it could not follow.
      !isAxisAligned(linear) || stickyBox !== null || handle.requiresUnobscuredSurface === true || reading.refusedUnderlays.has(el) || visible && hasAncestorBackdropFilter(el)
    );
    const plane = coordinateSpace === "viewport" || overlayOnly ? "overlay" : "underlay";
    const modeledScrollPath = reading.innerScrollMode === "unsupported" ? [] : basis.scrollPath;
    const audit = visible ? auditIslandComposition(el, modeledScrollPath) : null;
    const backdrops = reading.backdrops.filter(({ dialog }) => !isComposedAncestor(dialog, el)).flatMap(({ color }) => color && color[3] > 0 ? [color] : []);
    const covered = backdrops.some((color) => color[3] >= 1) || outsideFullscreen(el);
    let inactiveReason = refusal(handle, reading);
    let active = visible && inactiveReason === null && !(audit === null || audit === void 0 ? void 0 : audit.transparent) && !covered;
    const scrollIssue = active ? scrollPathIssue(basis.scrollPath, reading.innerScrollMode) : null;
    if (scrollIssue !== null) {
      active = false;
      inactiveReason = scrollIssue;
    }
    const activeScrollPath = active ? basis.scrollPath : [];
    const placement = active ? place(handle, { coordinateSpace, scrollPath: activeScrollPath }, linear) : { rect: null, visualRect: null, paintRect: null, placed: false, issue: null };
    if (active && !placement.placed) {
      active = false;
      inactiveReason = placement.issue;
    }
    const clips = active && audit ? audit.clips.map((clip) => clipSource(clip, reading)) : [];
    const approximations = active && audit ? [...audit.approximations] : [];
    if (active && stickyBox && !sticky)
      approximations.push("unfollowed-sticky");
    if (active && hasEllipticalCorners(computedStyle(el), el.offsetWidth, el.offsetHeight))
      approximations.push("elliptical-corners");
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({
      handle,
      el,
      z: zIndex(el),
      dom,
      active,
      interactive: handle.interactive && computedStyle(el).pointerEvents !== "none" && inertAncestor(el) === null,
      rect: placement.rect,
      visualRect: placement.visualRect,
      paintRect: sticky && placement.paintRect ? union(placement.paintRect, sticky.reach) : placement.paintRect,
      plane,
      overlayOnly,
      coordinateSpace,
      scrollPath: activeScrollPath,
      motionDependencies: new Set(activeScrollPath),
      opacity: active ? inheritedOpacity(el, reading.fading) : 1
    }, active && placement.transform ? { transform: placement.transform } : {}), active && sticky ? { sticky } : {}), clips.length > 0 ? { clips } : {}), active && backdrops.length > 0 ? { backdrops } : {}), approximations.length > 0 ? { approximations } : {}), { inactiveReason }), motion.entries.size > 0 ? {
      movers: motion.targets(el).filter((target) => {
        var _a;
        return (_a = motion.entries.get(target)) === null || _a === void 0 ? void 0 : _a.some((entry) => entry.payload.channel === "translate" || entry.payload.channel === "scale");
      })
    } : {});
  }
  function refusal(handle, reading) {
    const refused = reading.refusedBecause(handle.islandId);
    return refused === void 0 ? null : `native refused this island's last layout: ${refused}`;
  }
  function outsideFullscreen(el) {
    const fullscreen = document.fullscreenElement;
    return !!fullscreen && !isComposedAncestor(fullscreen, el);
  }
  function scrollPathIssue(path, mode) {
    if (path.length === 0)
      return null;
    if (mode === "unsupported")
      return "independent scroll containers are not supported by the active native transport";
    const unsafe = path.some((container) => {
      const scrollport = scrollContainerRect(container);
      return !scrollport || !isSafeBridgeRect(scrollport);
    });
    return unsafe ? "the scroll container geometry cannot be represented safely by the native host" : null;
  }
  function clipSource({ el, rect }, reading) {
    const basis = coordinateBasis(el);
    const page = basis.coordinateSpace === "document" ? { x: window.scrollX, y: window.scrollY } : { x: 0, y: 0 };
    const positioned = fixedOrStickyAncestor(el);
    const sticky = (positioned === null || positioned === void 0 ? void 0 : positioned.position) === "sticky" ? reading.stickyMotion(positioned.element, basis) : null;
    return {
      el,
      coordinateSpace: basis.coordinateSpace,
      scrollPath: basis.scrollPath,
      rect: rectInScrollPathCoordinates(Object.assign(Object.assign({}, rect), { x: round2(rect.x + page.x), y: round2(rect.y + page.y), w: round2(rect.w), h: round2(rect.h) }), basis.scrollPath),
      sticky
    };
  }
  function place(handle, basis, linear) {
    const { el } = handle;
    const bounds = basisRect(el, basis);
    const paintRect = docRect(el);
    const visualRect = visibleRectInsideScrollPath(paintRect, basis.scrollPath);
    const style = computedStyle(el);
    const transform = isIdentity$1(linear) ? void 0 : islandTransform(el.offsetWidth, el.offsetHeight, linear, bounds);
    const own = transform ? { w: transform.size[0], h: transform.size[1] } : bounds;
    const rect = Object.assign(Object.assign({}, bounds), { r: inscribedCornerRadii(style, own.w, own.h) });
    const empty = (rect.w <= 0 || rect.h <= 0) && isSafeBridgeRect(Object.assign(Object.assign({}, rect), { w: 1, h: 1 }));
    if (empty || !isSafeBridgeRect(rect)) {
      return {
        rect: null,
        visualRect: null,
        paintRect: null,
        placed: false,
        // An island with no area is simply not shown.
        issue: empty ? null : "native island geometry exceeds the shared safe coordinate or size range"
      };
    }
    return Object.assign(Object.assign({ rect, visualRect, paintRect }, transform ? { transform } : {}), { placed: true, issue: null });
  }
  function islandTransform(width, height, linear, drawn) {
    if (!(width > 0 && height > 0))
      return void 0;
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height]
    ].map(([x, y]) => [linear[0] * x + linear[2] * y, linear[1] * x + linear[3] * y]);
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const fitX = spanX > 0 ? drawn.w / spanX : 1;
    const fitY = spanY > 0 ? drawn.h / spanY : 1;
    return {
      size: [round2(width), round2(height)],
      matrix: [
        round4(linear[0] * fitX),
        round4(linear[1] * fitY),
        round4(linear[2] * fitX),
        round4(linear[3] * fitY),
        round2(0 - Math.min(...xs) * fitX),
        round2(0 - Math.min(...ys) * fitY)
      ]
    };
  }
  function overlayIssue(classification, unfollowedSticky) {
    if (classification === void 0) {
      return {
        reason: "web paint above an overlay island must be opaque across its bounded box",
        mayMoveWithoutRefresh: false
      };
    }
    return unfollowedSticky ? UNFOLLOWED_STICKY : classification;
  }
  class LayerBuilder {
    /**
     * `candidates` lists every element that may paint over or under an island; `settleWrite` hands
     * back the page's own changes made while a read took `box` out of flow.
     */
    constructor(host, candidates, settleWrite) {
      this.host = host;
      this.candidates = candidates;
      this.settleWrite = settleWrite;
      this.stickyBoxes = /* @__PURE__ */ new Map();
      this.classifications = /* @__PURE__ */ new WeakMap();
      this.ownPaint = /* @__PURE__ */ new WeakMap();
    }
    /** Forgets what was read of `element`, or of every element. */
    forget(element) {
      if (element) {
        this.classifications.delete(element);
        this.ownPaint.delete(element);
      } else {
        this.classifications = /* @__PURE__ */ new WeakMap();
        this.ownPaint = /* @__PURE__ */ new WeakMap();
      }
    }
    build(effects = []) {
      var _a, _b;
      this.stickyBoxes.clear();
      const over = (element, kept) => effects.filter((effect) => kept(effect) && isComposedAncestor(effect.target, element)).map(({ target }) => target);
      const moves = (element) => over(element, (effect) => effect.impact === "local-composition");
      const animates = (element) => over(element, (effect) => effect.impact !== "global-layout");
      const glides = this.host.motion.gliding();
      const cutAnimates = (element) => over(element, (effect) => effect.impact !== "global-layout" && (effect.pseudo || !glides.has(effect.target)));
      const explicitElements = new Set(this.host.layers.map((layer) => layer.el));
      const layers = this.host.layers.filter((layer) => layer.el.isConnected && (isElementVisible(layer.el) || this.host.motion.fadesIn(layer.el))).map((layer, dom2) => {
        var _a2;
        const style = computedStyle(layer.el);
        const positionedAncestor = fixedOrStickyAncestor(layer.el);
        const basis = coordinateBasis(layer.el);
        const { coordinateSpace, scrollPath: layerScrollPath } = basis;
        const allowFixedPosition = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "fixed";
        const sticky = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" ? this.stickyMotion(positionedAncestor.element, basis) : null;
        const box = docRect(layer.el);
        const radius = radiiDrawnAt(style, box.w, box.h, this.host.motion.drawnAt(layer.el));
        const wholeLayerIssue = auditWebLayerCutoutComposition(layer.el, layerScrollPath, {
          allowViewportPosition: allowFixedPosition
        });
        const backgroundPaint = layer.el.children.length > 0 && (radius === null || wholeLayerIssue !== null || hasOuterDecoration(style)) ? (_a2 = this.host.paint.backgroundSource(layer.el)) !== null && _a2 !== void 0 ? _a2 : separableBackgroundPaint(style) : null;
        const overlayClassification = automaticWebLayerCutoutIssue(layer.el, innermostScroller(layerScrollPath), allowFixedPosition, true, true);
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
          translucentFill: isTranslucentFill(layer.el, this.host.motion.fades(layer.el)),
          coordinateSpace,
          scrollPath: layerScrollPath,
          backgroundPaint,
          cutoutIssue: backgroundPaint !== null ? auditWebLayerCutoutComposition(layer.el, layerScrollPath, {
            backgroundOnly: true,
            allowViewportPosition: allowFixedPosition
          }) : radius === null ? {
            reason: "declared opaque surfaces require a uniform pixel border-radius",
            mayMoveWithoutRefresh: false
          } : wholeLayerIssue,
          overlayCutoutIssue: overlayIssue(radius === null ? void 0 : overlayClassification, (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" && !sticky)
        };
      }).filter((layer) => hasArea(layer.rect));
      if (!this.host.compositionEnabled || this.host.natives.length === 0)
        return layers;
      const nativeElements = new Set(this.host.natives.map((native) => native.el));
      const bodyPaintsCanvas = this.host.paint.backgroundSource(document.documentElement) === void 0 && bodyBackgroundPropagates();
      const nativeBounds = this.host.natives.filter((native) => native.el.isConnected && (isElementVisible(native.el) || this.host.motion.fadesIn(native.el))).map((native) => {
        const basis = coordinateBasis(native.el);
        const { coordinateSpace, scrollPath: nativeScrollPath } = basis;
        const rect = basisRect(native.el, basis);
        return {
          el: native.el,
          rect,
          visualRect: docRect(native.el),
          paintRect: docRect(native.el),
          paintEscapesRect: false,
          coordinateSpace,
          scrollPath: nativeScrollPath
        };
      });
      let dom = layers.length;
      const meets = (reach) => nativeBounds.some((native) => canMoveIntoIntersection(reachFrom(reach, native), native));
      for (const element of this.candidates()) {
        if (!element.isConnected || explicitElements.has(element) || nativeElements.has(element) || this.settledAway(element, moves, meets) || hasComposedAncestorIn(element, nativeElements) || !(isElementVisible(element) || this.host.motion.fadesIn(element))) {
          continue;
        }
        const positionedAncestor = fixedOrStickyAncestor(element);
        const basis = coordinateBasis(element);
        const { coordinateSpace, scrollPath: layerScrollPath } = basis;
        const allowFixedPosition = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "fixed";
        const sourceBackground = (_a = this.host.paint.backgroundSource(element)) !== null && _a !== void 0 ? _a : separableBackgroundPaint(computedStyle(element));
        const isViewportRoot = element === document.body || element === document.documentElement;
        const paintsDocumentCanvas = element === document.documentElement || element === document.body && bodyPaintsCanvas;
        const backgroundPaint = sourceBackground !== null && (element.children.length > 0 || isViewportRoot) ? sourceBackground : null;
        const scroller = innermostScroller(layerScrollPath);
        const known = this.classifications.get(element);
        const classification = (known === null || known === void 0 ? void 0 : known.scroller) === scroller && geometryHolds(known.facts) ? known : void 0;
        const cached = classification === null || classification === void 0 ? void 0 : classification.issue;
        let issue;
        if (backgroundPaint !== null) {
          issue = auditWebLayerCutoutComposition(element, layerScrollPath, {
            backgroundOnly: true,
            allowViewportPosition: allowFixedPosition
          });
        } else if (cached === void 0) {
          const recorded = recordGeometry(() => automaticWebLayerCutoutIssue(element, scroller, allowFixedPosition));
          issue = recorded.value;
          this.classifications.set(element, {
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
        const sticky = (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" ? this.stickyMotion(positionedAncestor.element, basis) : null;
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
        if (!hasArea(rect) || !(meets(reach) || layerViewport !== null && nativeBounds.some((native) => intersects(layerViewport, native.visualRect)))) {
          continue;
        }
        const entry = this.classifications.get(element);
        const current = (entry === null || entry === void 0 ? void 0 : entry.scroller) === scroller ? entry : void 0;
        let overlay = (current === null || current === void 0 ? void 0 : current.overlay) !== void 0 && geometryHolds((_b = current.overlayFacts) !== null && _b !== void 0 ? _b : []) ? current.overlay : void 0;
        if (overlay === void 0) {
          const strict = recordGeometry(() => automaticWebLayerCutoutIssue(element, scroller, allowFixedPosition, true, true));
          overlay = strict.value === void 0 ? false : strict.value;
          if (current) {
            current.overlay = overlay;
            current.overlayFacts = strict.facts;
          }
        }
        const overlayCutoutIssue = overlayIssue(overlay === false ? void 0 : overlay, (positionedAncestor === null || positionedAncestor === void 0 ? void 0 : positionedAncestor.position) === "sticky" && !sticky);
        const radius = paintsDocumentCanvas ? SQUARE : radiiDrawnAt(computedStyle(element), rect.w, rect.h, this.host.motion.drawnAt(element));
        layers.push(Object.assign(Object.assign({}, reach), { el: element, z: zIndex(element), dom: dom++, rect: Object.assign(Object.assign({}, rect), { r: radius !== null && radius !== void 0 ? radius : SQUARE }), visualRect: Object.assign(Object.assign({}, visualRect), { r: radius !== null && radius !== void 0 ? radius : SQUARE }), translucentFill: isTranslucentFill(element, this.host.motion.fades(element)), backgroundPaint, cutoutIssue: radius === null ? {
          reason: "automatically detected web surfaces require a uniform pixel border-radius",
          mayMoveWithoutRefresh: false
        } : issue, overlayCutoutIssue }));
      }
      return layers;
    }
    /**
     * Whether `element` sits in the page where it is laid out, paints only inside its box and cannot
     * reach any island: the reach a full read would find, from its rect alone. Most of a large page
     * is ruled out here, before the reads only a layer near an island needs.
     */
    settledAway(element, moves, meets) {
      if (element === document.body || element === document.documentElement)
        return false;
      const own = this.readOwnPaint(element);
      if (own.positioned || own.escapes || !this.settledIn(composedParentElement(element)))
        return false;
      if (element.firstChild && overflowsVisibly(element, own.overflowX, own.overflowY))
        return false;
      if (moves(element).length > 0)
        return false;
      const rect = docRect(element);
      if (!hasArea(rect))
        return true;
      return !meets({
        rect,
        visualRect: rect,
        paintRect: rect,
        paintEscapesRect: false,
        movers: [],
        coordinateSpace: "document",
        scrollPath: []
      });
    }
    /** Whether nothing from `element` up moves what it holds apart from the page: no scroller, no fixed or sticky box. */
    settledIn(element) {
      if (!element)
        return true;
      return planMemo$1("settledIn", element, () => {
        const own = this.readOwnPaint(element);
        const root = element === document.body || element === document.documentElement;
        return !own.positioned && (root || !own.scrolls) && this.settledIn(composedParentElement(element));
      });
    }
    readOwnPaint(element) {
      let own = this.ownPaint.get(element);
      if (!own) {
        const style = computedStyle(element);
        own = {
          positioned: style.position === "fixed" || style.position === "sticky",
          scrolls: axisScrolls(style.overflowX) || axisScrolls(style.overflowY),
          escapes: styleEscapesBorderBox(element, style),
          overflowX: style.overflowX === "visible" && style.display !== "inline",
          overflowY: style.overflowY === "visible" && style.display !== "inline"
        };
        this.ownPaint.set(element, own);
      }
      return own;
    }
    /** How `box`, the sticky box a layer sits in, moves the layer with coordinates in `basis`. */
    stickyMotion(box, basis) {
      const boxBasis = coordinateBasis(box);
      if (!sameCoordinatePath(boxBasis, basis))
        return null;
      let motion = this.stickyBoxes.get(box);
      if (motion === void 0) {
        motion = this.measureStickyBox(box, boxBasis);
        this.stickyBoxes.set(box, motion);
      }
      return motion && motion.scroller === innermostScroller(basis.scrollPath) ? motion : null;
    }
    measureStickyBox(box, basis) {
      var _a;
      const scroller = (_a = independentScrollContainers(box)[0]) !== null && _a !== void 0 ? _a : null;
      const parent = composedParentElement(box);
      if (!parent || scroller === null && basis.coordinateSpace !== "document")
        return null;
      const style = computedStyle(box);
      const padding = scroller ? computedStyle(scroller) : null;
      const inset = (value, side) => {
        var _a2;
        return value === "auto" ? void 0 : /^-?[\d.]+px$/.test(value) ? Number.parseFloat(value) + (Number.parseFloat((_a2 = padding === null || padding === void 0 ? void 0 : padding.getPropertyValue(`padding-${side}`)) !== null && _a2 !== void 0 ? _a2 : "") || 0) : null;
      };
      const insets = {
        top: inset(style.top, "top"),
        right: inset(style.right, "right"),
        bottom: inset(style.bottom, "bottom"),
        left: inset(style.left, "left")
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
    inFlow(box, read) {
      const hadStyle = box.hasAttribute("style");
      const written = /* @__PURE__ */ new Set([box.getAttribute("style")]);
      const value = box.style.getPropertyValue("position");
      const priority = box.style.getPropertyPriority("position");
      const scrollers = independentScrollContainers(box);
      if (document.scrollingElement)
        scrollers.push(document.scrollingElement);
      const offsets = scrollers.map((element) => [element.scrollLeft, element.scrollTop]);
      box.style.setProperty("position", "static", "important");
      written.add(box.getAttribute("style"));
      try {
        return withoutSceneReadScope(() => withCompositionReadScope(() => withoutBoundsReadScope(read)));
      } finally {
        if (value)
          box.style.setProperty("position", value, priority);
        else
          box.style.removeProperty("position");
        written.add(box.getAttribute("style"));
        if (!hadStyle && box.getAttribute("style") === "")
          box.removeAttribute("style");
        scrollers.forEach((element, index) => {
          const [left, top] = offsets[index];
          if (element.scrollLeft !== left)
            element.scrollLeft = left;
          if (element.scrollTop !== top)
            element.scrollTop = top;
        });
        this.settleWrite(box, written);
      }
    }
  }
  function islandRegions(natives, layers, writer, planes, motion) {
    const regions = new RegionPlan(natives, layers, writer, planes, motion);
    const result = { cutouts: {}, exclusions: {}, tints: {} };
    for (const native of natives) {
      if (!native.active || !native.rect)
        continue;
      const id = native.handle.islandId;
      result.cutouts[id] = [];
      result.exclusions[id] = [];
      if (!hasPlanGeometry(native))
        continue;
      writer.scrollers = native.motionDependencies;
      const island = regions.island(native);
      if (native.plane === "overlay") {
        result.cutouts[id] = island.overlayCutouts();
        const tints = island.tints();
        if (tints.length > 0)
          result.tints[id] = tints;
      }
      result.exclusions[id] = island.exclusions();
      if (native.handle.requiresUnobscuredSurface) {
        const cut = new Set(result.cutouts[id].map((region) => JSON.stringify(region)));
        result.cutouts[id].push(...result.exclusions[id].filter((region) => !cut.has(JSON.stringify(region))));
      }
    }
    writer.scrollers = null;
    return result;
  }
  class RegionPlan {
    constructor(natives, layers, writer, planes, motion) {
      this.natives = natives;
      this.layers = layers;
      this.writer = writer;
      this.planes = planes;
      this.motion = motion;
      this.tintColors = /* @__PURE__ */ new Map();
      this.fading = motion.fading();
    }
    island(native) {
      return new IslandRegionPlan(this, native);
    }
    /** Each layer stretched over where its motion takes it within the next frame. */
    leading() {
      var _a;
      return (_a = this.leadingLayers) !== null && _a !== void 0 ? _a : this.leadingLayers = this.layers.map((layer) => {
        const { lead } = layer;
        if (!lead)
          return layer;
        const reach = (rect) => union(rect, Object.assign(Object.assign({}, rect), { x: rect.x + lead.x, y: rect.y + lead.y }));
        return Object.assign(Object.assign({}, layer), { rect: reach(layer.rect), visualRect: reach(layer.visualRect), paintRect: reach(layer.paintRect) });
      });
    }
    tinting() {
      var _a;
      return (_a = this.tintLayers) !== null && _a !== void 0 ? _a : this.tintLayers = this.layers.filter((layer) => (layer.translucentFill || !!this.planes.gradientTint(layer)) && (isElementVisible(layer.el) || this.motion.fadesIn(layer.el)));
    }
    touchable() {
      var _a;
      return (_a = this.touchableLayers) !== null && _a !== void 0 ? _a : this.touchableLayers = this.layers.filter(touchable);
    }
    tintColor(layer) {
      var _a, _b, _c;
      if (this.tintColors.has(layer))
        return (_a = this.tintColors.get(layer)) !== null && _a !== void 0 ? _a : null;
      const color = (_c = (_b = this.planes.gradientTint(layer)) === null || _b === void 0 ? void 0 : _b.color) !== null && _c !== void 0 ? _c : srgba(computedStyle(layer.el).backgroundColor);
      const alpha = color ? round3(color[3] * inheritedOpacity(layer.el, this.fading)) : 0;
      const tint = color && alpha > 0 ? [...color.slice(0, 3).map(Math.round), alpha] : null;
      this.tintColors.set(layer, tint);
      return tint;
    }
    /** `side` as far as it can move against `partner`, while any motion is planned. */
    moving(side, partner) {
      return this.motion.entries.size > 0 ? reachFrom(side, partner) : side;
    }
  }
  class IslandRegionPlan {
    constructor(plan, native) {
      this.plan = plan;
      this.native = native;
      this.reach = /* @__PURE__ */ new Map();
    }
    /** Whether `layer` paints above the island anywhere either can move to. */
    reachesAbove(layer) {
      const known = this.reach.get(layer);
      if (known !== void 0)
        return known;
      const { native, plan } = this;
      const reaches = canMoveIntoIntersection(plan.moving(layer, native), plan.moving(native, layer)) && above(layer, native);
      this.reach.set(layer, reaches);
      return reaches;
    }
    /** For an island that must not be obscured: the parts of `layer` that would cover it. */
    protectedRegions(layer) {
      const { native, plan } = this;
      if (movesAgainst(layer, native) && !layer.translucentFill && above(layer, native) && isElementVisible(layer.el) && canMoveIntoIntersection(reachFrom(layer, native), native)) {
        return [plan.writer.nativeRegion(native)];
      }
      if (layer.translucentFill)
        return [];
      const source = plan.planes.protectedWebRegion(native, layer);
      if (source)
        return [plan.writer.region(source)];
      return source === null && !plan.planes.protectedCoveredByAncestor(native, layer, plan.layers) ? [plan.writer.region(layer)] : [];
    }
    overlayCutouts() {
      const { native, plan } = this;
      if (clipsProtectedSurface(native))
        return plan.layers.flatMap((layer) => this.protectedRegions(layer));
      return plan.leading().filter((layer) => !layer.translucentFill && isElementVisible(layer.el) && this.reachesAbove(layer) && (layer.overlayCutoutIssue === null ? layer.cutoutIssue === null || !!layer.sticky : !plan.planes.opaqueWebCover(layer, native, plan.layers))).map((layer) => {
        var _a;
        if (!plan.planes.gradientTint(layer, native))
          return plan.writer.region(layer);
        const height = opaqueGradientDepth(layer.el, layer.rect.h);
        if (height === null)
          return plan.writer.region(layer);
        const r = (_a = layer.rect.r) !== null && _a !== void 0 ? _a : SQUARE;
        return plan.writer.region(Object.assign(Object.assign({}, layer), { rect: Object.assign(Object.assign({}, layer.rect), { h: height, r: height < layer.rect.h ? [r[0], r[1], 0, 0] : r }) }));
      });
    }
    tints() {
      var _a;
      const { native, plan } = this;
      if (native.handle.requiresUnobscuredSurface)
        return [];
      const backdrops = ((_a = native.backdrops) !== null && _a !== void 0 ? _a : []).map((color) => Object.assign(Object.assign({}, plan.writer.region({
        rect: { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
        coordinateSpace: "viewport",
        scrollPath: [],
        sticky: null
      })), { color: [...color] }));
      return backdrops.concat(plan.tinting().flatMap((layer) => {
        if (!this.reachesAbove(layer))
          return [];
        const color = plan.tintColor(layer);
        if (!color)
          return [];
        const gradient = plan.planes.gradientTint(layer, native);
        if (!layer.translucentFill && !gradient)
          return [];
        return [
          Object.assign(Object.assign(Object.assign({}, plan.writer.region(layer)), { color: color.slice() }), gradient ? { alphaStops: gradient.alphaStops } : {})
        ];
      }));
    }
    exclusions() {
      const { native, plan } = this;
      const layers = plan.touchable();
      let exclusions;
      if (clipsProtectedSurface(native)) {
        exclusions = layers.flatMap((layer) => this.protectedRegions(layer));
      } else {
        const reaching = layers.filter((layer) => this.reachesAbove(layer));
        exclusions = reaching.filter((layer) => layer.overlayCutoutIssue !== UNFOLLOWED_STICKY || !plan.planes.opaqueWebCover(layer, native, reaching)).map((layer) => plan.writer.region(layer));
      }
      for (const other of plan.natives) {
        if (other !== native && hasPlanGeometry(other) && canMoveIntoIntersection(plan.moving(other, native), plan.moving(native, other)) && above(other, native)) {
          exclusions.push(plan.writer.nativeRegion(other));
        }
      }
      return exclusions;
    }
  }
  function cornerOf(rect, coordinateSpace, scrollPath2) {
    return () => {
      const offset = scrollPathOffset(scrollPath2);
      const page = coordinateSpace === "document" ? { x: window.scrollX, y: window.scrollY } : { x: 0, y: 0 };
      return { x: rect.x - offset.x - page.x, y: rect.y - offset.y - page.y };
    };
  }
  class RegionWriter {
    constructor(scrollOffsets, motion) {
      this.scrollOffsets = scrollOffsets;
      this.motion = motion;
      this.sentMotions = /* @__PURE__ */ new Set();
      this.scrollers = null;
      this.regions = /* @__PURE__ */ new WeakMap();
      this.paths = /* @__PURE__ */ new Map();
      this.origins = /* @__PURE__ */ new Map();
    }
    region(source) {
      var _a;
      const { coordinateSpace, scrollPath: scrollPath2, rect, sticky, el } = source;
      for (const element of scrollPath2)
        (_a = this.scrollers) === null || _a === void 0 ? void 0 : _a.add(element);
      const motion = this.motionPath(el, cornerOf(rect, coordinateSpace, scrollPath2));
      let payload = this.regions.get(source);
      if (!payload) {
        payload = Object.assign({ rect: sticky ? this.unstuck(rect, sticky) : rect, coordinateSpace, scrollPath: scrollPath2.map((element) => this.scrollOffsets.idFor(element)) }, sticky && { sticky: this.sticky(sticky) });
        this.regions.set(source, payload);
      }
      return Object.assign(Object.assign(Object.assign(Object.assign({}, payload), { scrollPath: payload.scrollPath.slice() }), payload.sticky && { sticky: Object.assign({}, payload.sticky) }), motion);
    }
    /** `rect`, read where `sticky` holds it now, where it sits unstuck. */
    unstuck(rect, sticky) {
      return Object.assign(Object.assign({}, rect), { x: round2(rect.x - sticky.shift.x), y: round2(rect.y - sticky.shift.y) });
    }
    /** How native moves what `sticky` holds. */
    sticky(sticky) {
      return Object.assign(Object.assign(Object.assign({}, sticky.scroller && { scroller: this.scrollOffsets.idFor(sticky.scroller) }), { natural: sticky.natural, bounds: sticky.bounds }), sticky.insets);
    }
    nativeRegion(native) {
      var _a;
      for (const element of native.scrollPath)
        (_a = this.scrollers) === null || _a === void 0 ? void 0 : _a.add(element);
      return Object.assign(Object.assign({}, this.motionPath(native.el, cornerOf(native.rect, native.coordinateSpace, native.scrollPath))), { rect: native.rect, coordinateSpace: native.coordinateSpace, scrollPath: native.scrollPath.map((element) => this.scrollOffsets.idFor(element)) });
    }
    /** The motions `element` travels with, and where each that scales does so from `corner`. */
    motionPath(element, corner) {
      if (!element)
        return {};
      let path = this.paths.get(element);
      if (!path) {
        const targets = this.motion.targets(element);
        path = { targets, ids: targets.map((target) => this.motion.idFor(target)) };
        this.paths.set(element, path);
      }
      for (const target of path.targets)
        this.sentMotions.add(target);
      if (path.ids.length === 0)
        return {};
      const scaling = path.targets.map((target) => {
        var _a, _b;
        if (!((_a = this.motion.entries.get(target)) === null || _a === void 0 ? void 0 : _a.some((entry) => entry.payload.channel === "scale")))
          return null;
        if (!this.origins.has(target))
          this.origins.set(target, this.motion.sampledOrigin(target));
        return (_b = this.origins.get(target)) !== null && _b !== void 0 ? _b : null;
      });
      if (!corner || scaling.every((origin) => origin === null))
        return { motionPath: path.ids.slice() };
      const at = corner();
      return {
        motionPath: path.ids.slice(),
        motionOrigins: scaling.map((origin) => origin ? [round2(origin.x - at.x), round2(origin.y - at.y)] : [0, 0])
      };
    }
  }
  function writeLayout(natives, layers, effects, canvasColor, context) {
    const { scrollOffsets } = context;
    const order = natives.filter((native) => native.active).sort((a, b) => above(a, b) ? 1 : above(b, a) ? -1 : 0).map((native) => native.handle.islandId);
    const writer = new RegionWriter(scrollOffsets, context.motion);
    const { cutouts, exclusions, tints } = islandRegions(natives, layers, writer, context.planes, context.motion);
    const components = natives.filter((native) => context.holds(native.handle)).map((native) => {
      const portal = native.handle.portal;
      return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ id: native.handle.islandId, type: native.handle.type, plane: native.plane, coordinateSpace: native.coordinateSpace, scrollPath: native.scrollPath.map((element) => scrollOffsets.idFor(element)), motionDependencies: Array.from(native.motionDependencies, (element) => scrollOffsets.idFor(element)), rect: native.rect && native.sticky ? writer.unstuck(native.rect, native.sticky) : native.rect, interactive: native.interactive, active: native.active }, native.opacity < 1 ? { opacity: round2(native.opacity) } : {}), native.transform ? { transform: native.transform } : {}), native.sticky ? { sticky: writer.sticky(native.sticky) } : {}), native.clips ? { clips: native.clips.map((clip) => writer.region(clip)) } : {}), portal ? { portal } : {}), writer.motionPath(native.el, native.rect ? cornerOf(native.rect, native.coordinateSpace, native.scrollPath) : void 0));
    });
    const scrollContainers = scrollContainerPayloads(natives, writer, context);
    const sent = new Set(scrollContainers.map((container) => container.id));
    const panes = {};
    const ordered = order.map((id) => {
      var _a;
      return (_a = natives.find((native) => native.handle.islandId === id)) === null || _a === void 0 ? void 0 : _a.el;
    });
    for (const [pane, color] of context.paneColors) {
      const id = scrollOffsets.idFor(pane);
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
    const motions = context.motionPayloads(writer.sentMotions, effects);
    return Object.assign(Object.assign(Object.assign(Object.assign({
      components,
      scrollContainers,
      order,
      cutouts,
      exclusions
    }, canvasColor ? { canvasColor } : {}), Object.keys(panes).length > 0 ? { panes } : {}), motions.length > 0 ? { motions } : {}), Object.keys(tints).length > 0 ? { tints } : {});
  }
  function scrollContainerPayloads(natives, writer, context) {
    const { scrollOffsets } = context;
    const dependencies = (include) => Array.from(new Set(natives.filter(include).flatMap((native) => Array.from(native.motionDependencies))));
    scrollOffsets.sync(dependencies((native) => native.active).filter((element) => hasArea(scrollContainerRect(element))));
    const referencedSet = new Set(dependencies((native) => context.holds(native.handle)));
    for (const element of Array.from(referencedSet)) {
      for (const ancestor of coordinateBasis(element).scrollPath)
        referencedSet.add(ancestor);
    }
    const referenced = Array.from(referencedSet).sort((left, right) => comparePaintOrder(right, left));
    const activeIds = /* @__PURE__ */ new Set();
    for (const element of referenced) {
      if (hasArea(scrollContainerRect(element)))
        activeIds.add(scrollOffsets.idFor(element));
    }
    const scrollContainers = [];
    for (const element of referenced) {
      const visualRect = scrollContainerRect(element);
      if (!hasArea(visualRect))
        continue;
      const basis = coordinateBasis(element);
      const originRect = basis.coordinateSpace === "viewport" ? documentToViewport(visualRect) : visualRect;
      const offset = physicalScrollOffset(element);
      const [a, b, c, d] = drawnLinear(element);
      scrollContainers.push(Object.assign(Object.assign({ id: scrollOffsets.idFor(element), rect: rectInScrollPathCoordinates(originRect, basis.scrollPath), scrollPath: basis.scrollPath.map((ancestor) => scrollOffsets.idFor(ancestor)).filter((id) => activeIds.has(id)), coordinateSpace: basis.coordinateSpace, contentWidth: round2(element.scrollWidth), contentHeight: round2(element.scrollHeight), offsetX: offset.x, offsetY: offset.y }, isIdentity$1([a, b, c, d]) ? {} : { linear: [a, b, c, d] }), writer.motionPath(element, () => ({ x: visualRect.x - window.scrollX, y: visualRect.y - window.scrollY }))));
    }
    return scrollContainers;
  }
  class MotionPlan {
    constructor() {
      this.entries = /* @__PURE__ */ new Map();
      this.ids = /* @__PURE__ */ new WeakMap();
      this.nextId = 1;
    }
    /** Reads what each target's running effects move, as native can run them. */
    describe(effects, capabilities) {
      var _a, _b, _c;
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
        const explained = list.every((effect) => effect.animation !== void 0 || all.some((animation) => effect.key === `transition:${transitionPropertyOf(animation)}` || effect.key === `animation:${animation.animationName}`));
        if (!explained || animations.length === 0)
          continue;
        const entries = describeMotion(target, animations, capabilities.motionStartsAtCommit, capabilities.motionScale);
        if (entries) {
          if (capabilities.motionStartsAtCommit) {
            for (const entry of entries) {
              if (!((_b = entry.translation) === null || _b === void 0 ? void 0 : _b.anchored) && !((_c = entry.scaling) === null || _c === void 0 ? void 0 : _c.anchored) && entry.animation.playState === "running" && typeof entry.animation.startTime === "number") {
                entry.payload.sampledTime = (entry.measuredAt - entry.animation.startTime) * entry.animation.playbackRate;
              }
            }
          }
          motions.set(target, entries);
        }
      }
      this.entries = motions;
    }
    /** Targets whose every motion native plays (moves, scales and fades), so a cut through them
     * follows them natively and the page is not planned again each frame to move it. */
    gliding() {
      return new Set([...this.entries.keys()].filter((target) => !this.fadesItself(target)));
    }
    fading() {
      return new Set([...this.entries.keys()].filter((target) => this.fadesItself(target)));
    }
    fadesItself(target) {
      var _a, _b;
      return (_b = (_a = this.entries.get(target)) === null || _a === void 0 ? void 0 : _a.some((entry) => entry.payload.channel === "opacity")) !== null && _b !== void 0 ? _b : false;
    }
    /**
     * The [x, y] factors `element` is drawn at in the box a plan reads for it: the scales on it and
     * around it now, carried back to the motions' samples the plan's geometry is read at.
     */
    drawnAt(element) {
      const [x, y] = scaleOf(drawnLinear(element));
      if (this.targets(element).length === 0)
        return [x, y];
      const read = readBounds(element);
      const live = element.getBoundingClientRect();
      const at = (scale, sampled, now) => {
        const value = now > 0 ? scale * sampled / now : scale;
        return Math.abs(value - 1) < 1e-4 ? 1 : round4(value);
      };
      return [at(x, read.width, live.width), at(y, read.height, live.height)];
    }
    targets(element) {
      if (this.entries.size === 0)
        return [];
      const targets = [];
      for (let current = element; current; current = composedParentElement(current)) {
        if (this.entries.has(current))
          targets.unshift(current);
      }
      return targets;
    }
    fades(element) {
      return this.targets(element).some((target) => this.fadesItself(target));
    }
    fadesIn(element) {
      if (element.children.length > 0 || !this.fades(element))
        return false;
      const parent = composedParentElement(element);
      if (parent instanceof HTMLElement && !isElementVisible(parent))
        return false;
      const style = computedStyle(element);
      return !element.hidden && style.display !== "none" && (style.visibility !== "hidden" || element.getAnimations().some((animation) => transitionPropertyOf(animation) === "visibility"));
    }
    idFor(element) {
      const existing = this.ids.get(element);
      if (existing)
        return existing;
      const id = `motion-${this.nextId++}`;
      this.ids.set(element, id);
      return id;
    }
    bounds(element, bounds) {
      const targets = this.targets(element);
      if (targets.length === 0)
        return bounds;
      const { x, y, w, h } = this.rebase(targets, bounds.left, bounds.top, bounds.width, bounds.height);
      return x === bounds.left && y === bounds.top && w === bounds.width && h === bounds.height ? bounds : DOMRect.fromRect({ x, y, width: w, height: h });
    }
    /**
     * A box drawn now under `targets` (outermost first), as drawn at the motions' samples. Inner
     * motions are undone first, each about where its origin is drawn now under the ones around it.
     */
    rebase(targets, x, y, w, h) {
      var _a;
      for (let index = targets.length - 1; index >= 0; index--) {
        const target = targets[index];
        const entries = this.entries.get(target);
        const scale = this.sampleScale(target, entries);
        if (scale) {
          x = scale.originX + scale.kx * (x - scale.originX);
          y = scale.originY + scale.ky * (y - scale.originY);
          w *= scale.kx;
          h *= scale.ky;
        }
        const sample = (_a = entries === null || entries === void 0 ? void 0 : entries.find((entry) => entry.translation)) === null || _a === void 0 ? void 0 : _a.translation;
        if (!sample)
          continue;
        const current = transformOf(getComputedStyle(target).getPropertyValue(sample.property), sample.property, sample.width, sample.height);
        if (!current)
          continue;
        x += (sample.x - current.x) * sample.scaleX;
        y += (sample.y - current.y) * sample.scaleY;
      }
      return { x, y, w, h };
    }
    /** How a target's sampled scale differs from the one it draws now, about its origin as drawn now. */
    sampleScale(target, entries) {
      var _a;
      const scaling = (_a = entries === null || entries === void 0 ? void 0 : entries.find((entry) => entry.scaling)) === null || _a === void 0 ? void 0 : _a.scaling;
      if (!scaling || scaling.x === void 0 || scaling.y === void 0)
        return null;
      const current = currentScale(target, scaling.property);
      if (!current || !(current[0] > 0 && current[1] > 0))
        return null;
      const kx = scaling.x / current[0];
      const ky = scaling.y / current[1];
      if (kx === 1 && ky === 1)
        return null;
      const origin = drawnOrigin(target, scaling);
      return origin && { kx, ky, originX: origin.x, originY: origin.y };
    }
    /** Where a scaling target's origin is drawn at its sample, in viewport px. */
    sampledOrigin(target) {
      var _a;
      const entries = this.entries.get(target);
      const scaling = (_a = entries === null || entries === void 0 ? void 0 : entries.find((entry) => entry.scaling)) === null || _a === void 0 ? void 0 : _a.scaling;
      const drawn = scaling && drawnOrigin(target, scaling);
      if (!drawn)
        return null;
      const targets = this.targets(target);
      const own = this.rebase([target], drawn.x, drawn.y, 0, 0);
      const placed = this.rebase(targets.slice(0, -1), own.x, own.y, 0, 0);
      return { x: placed.x, y: placed.y };
    }
  }
  class ScenePlanes {
    constructor(host) {
      this.host = host;
    }
    /**
     * Refuses the underlay of one island of each overlapping pair no plane order separates: it is
     * planned again above the WebView, where native stacks the two as the page does.
     */
    refuseInseparableOverlaps(states) {
      states.forEach((left, leftIndex) => {
        for (let rightIndex = leftIndex + 1; rightIndex < states.length && hasResolvedGeometry(left); rightIndex++) {
          const right = states[rightIndex];
          if (!hasResolvedGeometry(right))
            continue;
          const reason = unsupportedOverlapReason(left, right);
          if (reason === null)
            continue;
          const under = [left, right].filter((native) => native.plane === "underlay");
          suspendNative(under.length === 2 ? smallerNative(left, right) : under[0], reason);
        }
      });
    }
    resolveHostPlanes(natives, layers) {
      raiseUntilStable(natives, (native) => this.mustCrossWebView(native, natives, layers));
      raiseUntilStable(natives, (native) => !this.drawnUnderSomething(native, natives, layers));
    }
    /** Whether an underlay island must cross the WebView to be drawn right. */
    mustCrossWebView(native, natives, layers) {
      return this.underlayConflict(native, layers) !== null || layers.some((layer) => (layer.coordinateSpace === "viewport" || (animatesAgainst(layer, native) || this.holedAgainst(native, layer)) && isElementVisible(layer.el)) && canMeet(native, layer) && above(native, layer)) || natives.some((other) => other !== native && other.plane === "overlay" && hasPlanGeometry(other) && canMoveIntoIntersection(native, other) && above(native, other));
    }
    /** Whether web paint, or another underlay island, is drawn over an underlay island. */
    drawnUnderSomething(native, natives, layers) {
      return layers.some((layer) => this.webCutsAbove(layer, native, layers) && isElementVisible(layer.el)) || natives.some((other) => other !== native && other.plane === "underlay" && hasPlanGeometry(other) && canMoveIntoIntersection(other, native) && above(other, native));
    }
    /** Whether `layer` paints over `native` where a cutout cannot show it, so it must stay above. */
    webCutsAbove(layer, native, layers) {
      return (layer.overlayCutoutIssue !== null || animatesAgainstCut(layer, native)) && !this.gradientTint(layer, native) && canMeet(layer, native) && above(layer, native) && !this.opaqueWebCover(layer, native, layers);
    }
    resolveWebUnderlays(natives, layers) {
      const overlayNatives = planned(natives, "overlay");
      if (overlayNatives.length === 0)
        return;
      const webAbove = this.webAboveScan(overlayNatives, layers);
      for (const native of overlayNatives) {
        if (!webAbove(native))
          continue;
        const group = overlaysUnder(native, natives);
        if (Array.from(group).every((candidate) => this.canSink(candidate, layers))) {
          for (const candidate of group)
            candidate.plane = "underlay";
        }
      }
    }
    /**
     * Asks whether web paint must stay above an overlay island. When the overlay islands share one
     * scroll path, the layers that hold still in it are sorted by top so each island asks only
     * those that can reach its rows; the rest are asked always.
     */
    webAboveScan(overlayNatives, layers) {
      const cutsAbove = (layer, native) => this.webCutsAbove(layer, native, layers);
      const basis = overlayNatives[0];
      const bounded = [];
      const rest = [];
      if (overlayNatives.every((native) => holdsStillIn(native, basis))) {
        for (const layer of layers)
          (!layer.sticky && holdsStillIn(layer, basis) ? bounded : rest).push(layer);
      }
      if (bounded.length === 0)
        return (native) => layers.some((layer) => cutsAbove(layer, native));
      bounded.sort((left, right) => left.paintRect.y - right.paintRect.y);
      const maxHeight = bounded.reduce((tallest, layer) => Math.max(tallest, layer.paintRect.h), 0);
      return (native) => {
        let low = 0;
        let high = bounded.length;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (bounded[middle].paintRect.y + maxHeight <= native.paintRect.y)
            low = middle + 1;
          else
            high = middle;
        }
        const bottom = native.paintRect.y + native.paintRect.h;
        for (let index = low; index < bounded.length && bounded[index].paintRect.y < bottom; index++) {
          if (cutsAbove(bounded[index], native))
            return true;
        }
        return rest.some((layer) => cutsAbove(layer, native));
      };
    }
    /** Whether an overlay island can be drawn under the WebView with what lies about it. */
    canSink(candidate, layers) {
      return !candidate.overlayOnly && this.underlayConflict(candidate, layers) === null && layers.every((layer) => !canMeet(candidate, layer) || (above(candidate, layer) ? !animatesAgainst(layer, candidate) && !this.holedAgainst(candidate, layer) && (stationaryCoordinatePaths(candidate, layer) || scrollingHoleCarries(candidate, layer)) : auditWebPaintAboveUnderlay(layer.el, layer.scrollPath, layer.coordinateSpace === "viewport", candidate.el) === null));
    }
    detectBackgroundPaintConflicts(natives, layers) {
      for (const layer of layers) {
        if (!layer.backgroundPaint || this.host.paint.scrollerPaint.has(layer.el))
          continue;
        const style = computedStyle(layer.el);
        const backgroundClip = backgroundColorClip(style);
        for (const native of natives) {
          if (!native.active || native.plane !== "underlay" || !native.visualRect || !intersects(native.visualRect, layer.visualRect) || !above(native, layer)) {
            continue;
          }
          if (canClipLayerAsUnit(layer, native.handle.el))
            continue;
          const unsafe = backgroundClip !== "border-box" || directTextIntersects(layer.el, native.visualRect) || hasVisiblePseudoElement(layer.el, true) || /\binset\b/i.test(style.boxShadow) || style.boxShadow !== "none" && style.boxShadow !== "" && !contains(layer.visualRect, native.visualRect) || !borderContains(layer.el, native.visualRect);
          if (unsafe)
            suspendNative(native, "overlapping web paint cannot be separated from its background");
        }
      }
    }
    underlayConflict(native, layers) {
      var _a;
      if (!this.host.compositionEnabled || !native.active || !native.rect || !native.visualRect)
        return null;
      for (const layer of layers) {
        const issue = (_a = layer.cutoutIssue) !== null && _a !== void 0 ? _a : !isSafeBridgeRect(layer.rect) ? {
          reason: "opaque web surface geometry exceeds the shared safe coordinate or size range",
          mayMoveWithoutRefresh: false
        } : null;
        if (!issue || !issue.mayMoveWithoutRefresh && !intersects(native.visualRect, layer.visualRect) || !above(native, layer)) {
          continue;
        }
        const covered = layers.some((cover) => cover !== layer && cover.cutoutIssue === null && !cover.translucentFill && opaqueContainsRect(cover.visualRect, layer.visualRect) && isElementVisible(cover.el) && above(cover, native));
        if (covered)
          continue;
        if (isComposedAncestor(layer.el, native.el) && !paintsUnderIsland(layer.el, native.el, native.visualRect, this.host.paint.scrollerPaint)) {
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
    /**
     * Whether what is cut out of an overlay island moves under it, so the cuts are followed every
     * frame. A cover native cannot carry exactly is cut by its box where it is now, followed the
     * same way, and noted on the island. An underlay island with moving paint under it has already
     * risen.
     */
    overlayCutsFollow(natives, layers) {
      var _a;
      let follow = false;
      for (const native of planned(natives, "overlay")) {
        if (clipsProtectedSurface(native))
          continue;
        const over = (layer) => canMeet(layer, native) && above(layer, native);
        const reaches = (layer) => !layer.translucentFill && over(layer) && !this.opaqueWebCover(layer, native, layers);
        const boxCut = layers.filter((layer) => layer.overlayCutoutIssue !== null && reaches(layer));
        if (boxCut.length > 0)
          ((_a = native.approximations) !== null && _a !== void 0 ? _a : native.approximations = []).push("box-cut");
        follow || (follow = boxCut.some((layer) => {
          var _a2;
          return ((_a2 = layer.overlayCutoutIssue) === null || _a2 === void 0 ? void 0 : _a2.mayMoveWithoutRefresh) === true;
        }) || layers.some((layer) => animatesAgainstCut(layer, native) && (layer.translucentFill ? !native.handle.requiresUnobscuredSurface && !this.host.motion.fades(layer.el) && over(layer) : reaches(layer))));
      }
      return follow;
    }
    resolveMotionDependencies(natives, layers) {
      for (const native of natives) {
        native.motionDependencies = new Set(native.scrollPath);
        if (!hasPlanGeometry(native))
          continue;
        const others = natives.filter((other) => other !== native && hasPlanGeometry(other));
        for (const other of [...layers, ...others]) {
          if (!sameCoordinatePath(other, native) && pathsMayCross(native.paintRect, native.scrollPath, other.paintRect, other.scrollPath)) {
            addSymmetricPathDifference(native.motionDependencies, native.scrollPath, other.scrollPath);
          }
        }
      }
    }
    holedAgainst(native, layer) {
      var _a;
      return movesAgainst(native, layer) && layer.cutoutIssue === null && !((_a = this.host.planCanvas) === null || _a === void 0 ? void 0 : _a.elements.has(layer.el));
    }
    gradientTint(layer, native) {
      var _a;
      if (!this.host.capabilities.tintAlphaGradient || !((_a = layer.overlayCutoutIssue) === null || _a === void 0 ? void 0 : _a.opaqueGradient) || native && (native.handle.requiresUnobscuredSurface || animatesAgainstCut(layer, native)))
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
    protectedWebRegion(native, layer) {
      if (!above(layer, native) || !isElementVisible(layer.el) || !canMoveIntoIntersection(layer, native))
        return;
      const horizontalScroll = [document.documentElement, document.body, ...native.scrollPath, ...layer.scrollPath].some((element) => element.scrollWidth > element.clientWidth + 1);
      if (!horizontalScroll) {
        const positioned = fixedOrStickyAncestor(layer.el);
        if (stickyFooterBelow(native, layer, positioned) || paintsLeftOf(native, layer))
          return;
        const sticky = positioned === null || positioned === void 0 ? void 0 : positioned.element;
        if (sticky && isFullWidthStickyHeader(sticky, layer)) {
          if (sticky === layer.el && !hasComplexOpaqueShape(layer.rect)) {
            return { rect: viewportRect(sticky), coordinateSpace: "viewport", scrollPath: [], el: sticky };
          }
          if (!layer.paintEscapesRect && contains(viewportRect(sticky), viewportRect(layer.el)))
            return;
        }
        if (tuckedIntoBottomCorners(native, layer))
          return Object.assign(Object.assign({}, layer), { rect: Object.assign(Object.assign({}, layer.rect), { r: SQUARE }) });
      }
      if (hasComplexOpaqueShape(layer.rect) || layer.cutoutIssue !== null || layer.overlayCutoutIssue !== null)
        return null;
      if (sameCoordinatePath(layer, native)) {
        if (!intersects(layer.rect, native.rect))
          return;
        return edgeStrip(layer.rect, native.rect) ? layer : null;
      }
      if (!horizontalScroll && layer.coordinateSpace === "viewport" && layer.scrollPath.length === 0 && native.coordinateSpace === "document" && edgeStrip(layer.rect, windowRect("viewport")))
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
        return cover !== layer && (cover.cutoutIssue === null || !!cover.sticky) && !animatesAgainst(cover, native) && above(cover, native) && isElementVisible(cover.el) && (opaque !== null && ((_a = cover.sticky) !== null && _a !== void 0 ? _a : null) === ((_b = layer.sticky) !== null && _b !== void 0 ? _b : null) && stationaryCoordinatePaths(cover, layer) && opaqueContainsRect(opaque, layer.visualRect) && (!reachFrom(layer, native).paintEscapesRect || isComposedAncestor(cover.el, layer.el) && computedStyle(cover.el).overflow === "hidden") || this.stickyCoverClipsDescendant(cover, layer));
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
    stickyCoverClipsDescendant(cover, layer) {
      var _a, _b;
      const scroller = layer.scrollPath[cover.scrollPath.length];
      const opaque = this.opaqueLayerRect(cover);
      if (opaque === null || !cover.sticky || layer.overlayCutoutIssue !== UNFOLLOWED_STICKY || layer.paintEscapesRect || movesAgainst(layer, cover) || animatesAgainst(layer, cover) || cover.coordinateSpace !== layer.coordinateSpace || !scroller || !startsWithScrollPath(layer.scrollPath, cover.scrollPath) || !isComposedAncestor(cover.el, scroller) || !isComposedAncestor(scroller, layer.el) || ((_a = fixedOrStickyAncestor(cover.el)) === null || _a === void 0 ? void 0 : _a.element) !== ((_b = fixedOrStickyAncestor(layer.el)) === null || _b === void 0 ? void 0 : _b.element) || !sameCoordinatePath(cover, coordinateBasis(scroller)) || touchable(layer) && !touchable(cover))
        return false;
      const style = computedStyle(scroller);
      if (!["hidden", "clip", "auto", "scroll"].includes(style.overflowX) || !["hidden", "clip", "auto", "scroll"].includes(style.overflowY) || hasOverflowClipMargin(style))
        return false;
      for (let node = scroller; node && node !== cover.el; node = composedParentElement(node)) {
        const inherited = computedStyle(node);
        if (establishesFixedContainingBlock(node) || Number.parseFloat(inherited.opacity) !== 1 || paintEscapesBorderBox(node) || hasOuterDecoration(inherited) || hasOverflowClipMargin(inherited))
          return false;
      }
      const aperture = scrollContainerRect(scroller);
      return aperture !== null && opaqueContainsRect(opaque, aperture);
    }
  }
  function raiseUntilStable(natives, rises) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const native of planned(natives, "underlay")) {
        if (!rises(native))
          continue;
        native.plane = "overlay";
        changed = true;
      }
    }
  }
  function overlaysUnder(native, natives) {
    const group = /* @__PURE__ */ new Set([native]);
    for (const upper of group) {
      for (const lower of natives) {
        if (hasPlanGeometry(lower) && lower.plane === "overlay" && canMoveIntoIntersection(upper, lower) && above(upper, lower))
          group.add(lower);
      }
    }
    return group;
  }
  function holdsStillIn(item, basis) {
    var _a, _b, _c;
    const rect = item.paintRect;
    return !item.paintEscapesRect && ((_b = (_a = item.movers) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) === 0 && ((_c = fixedOrStickyAncestor(item.el)) === null || _c === void 0 ? void 0 : _c.position) !== "sticky" && rect != null && [rect.x, rect.y, rect.w, rect.h, rect.x + rect.w, rect.y + rect.h].every(Number.isFinite) && rect.w > 0 && rect.h > 0 && sameCoordinatePath(basis, item);
  }
  function stickyFooterBelow(native, layer, positioned) {
    const owner = innermostScroller(layer.scrollPath);
    const stickyParent = positioned === null || positioned === void 0 ? void 0 : positioned.element.parentElement;
    if ((positioned === null || positioned === void 0 ? void 0 : positioned.position) !== "sticky" || positioned.element === layer.el || native.coordinateSpace !== "document" || !sameCoordinatePath(layer, native) || computedStyle(positioned.element).bottom !== "0px" || !owner || !stickyParent)
      return false;
    const ownerBox = readBounds(owner);
    return Math.abs(ownerBox.top) <= 1 && ownerBox.height >= window.innerHeight - 1 && readBounds(stickyParent).height >= owner.scrollHeight - 1 && readBounds(positioned.element).top > native.rect.y + native.rect.h;
  }
  function paintsLeftOf(native, layer) {
    var _a, _b, _c;
    if (layer.coordinateSpace !== "viewport" || layer.scrollPath.length !== 0)
      return false;
    const box = readBounds(layer.el);
    const islandLeft = readBounds(native.el).left;
    return box.left + Math.max(box.width, layer.el.scrollWidth) < islandLeft && !((_c = (_b = (_a = layer.el).getAnimations) === null || _b === void 0 ? void 0 : _b.call(_a, { subtree: true })) !== null && _c !== void 0 ? _c : []).some((animation) => animation.playState === "running") && [layer.el, ...layer.el.querySelectorAll("*")].every((element) => {
      const style = computedStyle(element);
      return readBounds(element).right < islandLeft && style.textShadow === "none" && style.filter === "none";
    });
  }
  function isFullWidthStickyHeader(sticky, layer) {
    const style = computedStyle(sticky);
    const scroller = innermostScroller(layer.scrollPath);
    if (style.position !== "sticky" || style.top !== "0px" || !/^rgb\(\d+,\d+,\d+\)$/.test(style.backgroundColor.replace(/\s/g, "")) || !scroller || !sticky.parentElement)
      return false;
    const scrollBox = readBounds(scroller);
    const box = readBounds(sticky);
    return Math.abs(scrollBox.left) <= 1 && Math.abs(scrollBox.top) <= 1 && scrollBox.width >= window.innerWidth - 1 && scrollBox.height >= window.innerHeight - 1 && readBounds(sticky.parentElement).height >= scroller.scrollHeight - 1 && Math.abs(box.top - scrollBox.top) <= 1 && box.left <= 0 && box.right >= window.innerWidth - 1;
  }
  function tuckedIntoBottomCorners(native, layer) {
    var _a, _b;
    const layerRadius = Math.max(...(_a = layer.rect.r) !== null && _a !== void 0 ? _a : SQUARE);
    const [, , nativeBottomRight, nativeBottomLeft] = (_b = native.rect.r) !== null && _b !== void 0 ? _b : SQUARE;
    const nativeRadius = Math.min(nativeBottomRight, nativeBottomLeft);
    return layerRadius > 0 && nativeRadius >= layerRadius && sameCoordinatePath(layer, native) && layer.rect.y >= native.rect.y + native.rect.h - nativeRadius && layer.rect.y < native.rect.y + native.rect.h && layer.rect.x + layerRadius <= native.rect.x + nativeRadius && layer.rect.x + layer.rect.w - layerRadius >= native.rect.x + native.rect.w - nativeRadius && !layer.paintEscapesRect && colorAlpha(computedStyle(layer.el).backgroundColor) === 1;
  }
  class SceneFacts {
    constructor(natives, layers, writes) {
      this.natives = natives;
      this.layers = layers;
      this.writes = writes;
      this.compositionEnabled = false;
      this.capabilities = {};
      this.planCanvas = null;
      this.motion = new MotionPlan();
      this.paint = new RuntimePaint(this);
    }
    drawnAt(element) {
      return this.motion.drawnAt(element);
    }
  }
  const RESTING_INPUTS = {
    compositionEnabled: false,
    capabilities: {},
    innerScrollMode: "unsupported",
    frameInterval: 1e3 / 60
  };
  class ScenePlanner {
    constructor(ports) {
      this.ports = ports;
      this.inputs = RESTING_INPUTS;
      this.heldUnder = /* @__PURE__ */ new Map();
      this.pageHandoffs = /* @__PURE__ */ new Map();
      this.planEffects = [];
      this.animatedTargets = /* @__PURE__ */ new Set();
      this.motionSamples = /* @__PURE__ */ new Map();
      this.facts = new SceneFacts(ports.natives, ports.layers, ports.writes);
      this.layerBuilder = new LayerBuilder(this.facts, () => ports.candidates(), (box, written) => ports.settleWrite(box, written));
      this.planes = new ScenePlanes(this.facts);
    }
    /** Plans the scene, writing the paint it wants on the page. */
    plan(inputs) {
      this.begin(inputs);
      const { motion } = this.facts;
      motion.entries.clear();
      return withScriptScrollersAtRest(inputs.innerScrollMode === "native", () => withScrollStructure(() => withPlanScope(() => withPaintOrderScope(() => withBoundsProjection((element, bounds) => motion.bounds(element, bounds), () => this.planScene())))));
    }
    /** The islands and layers as a plan first reads them, before planes are chosen. */
    read(inputs) {
      this.begin(inputs);
      const layers = this.layerBuilder.build();
      return { natives: this.buildNatives(), layers };
    }
    /**
     * Forgets what was read of `element` (alone when `own`, else with everything in it), or of the
     * whole page.
     */
    forgetLayers(element, own = false) {
      const { paint } = this.facts;
      if (!element) {
        this.layerBuilder.forget();
        forgetPseudoPaint();
        paint.restyled();
        return;
      }
      if (element instanceof HTMLElement)
        this.layerBuilder.forget(element);
      forgetPseudoPaint(element);
      if (!own) {
        for (const descendant of descendantsOf(element)) {
          this.layerBuilder.forget(descendant);
          forgetPseudoPaint(descendant);
        }
      }
      paint.restyled(element, own);
    }
    /**
     * Notes an author's change at `target`, to its `attribute` when the change is to one. Returns
     * whether it changed a covered page that islands below the WebView still show through, which
     * uncovers them.
     */
    notePageChange(target, attribute) {
      var _a, _b;
      const { paint } = this.facts;
      paint.pageChanged();
      if (attribute === void 0 || !(target instanceof HTMLElement))
        return false;
      const coveredPage = paint.ownsClip(target) && attribute !== "style" && attribute !== CLIP_ATTRIBUTE && ((_a = this.pageHandoffs.get(target)) === null || _a === void 0 ? void 0 : _a.state) === "covered";
      const holding = coveredPage && !!((_b = this.heldUnder.get(target)) === null || _b === void 0 ? void 0 : _b.some((native) => this.ports.native.mayShowUnder(native.handle.islandId)));
      paint.noteAuthorChange(target, attribute, coveredPage && !holding);
      return holding;
    }
    /** Whether what `target` paints may reach an island: it holds one, or overlaps one above the WebView. */
    mayReachIsland(target) {
      const box = target.getBoundingClientRect();
      let stickyCover = null;
      for (let el = composedParentElement(target); el; el = composedParentElement(el)) {
        if (this.layerBuilder.stickyBoxes.get(el)) {
          stickyCover = el.getBoundingClientRect();
          break;
        }
      }
      return this.ports.natives.some((native) => {
        if (isComposedAncestor(target, native.el))
          return true;
        if (this.ports.native.planeOf(native.islandId) !== "overlay")
          return false;
        if (stickyCover && box.top >= stickyCover.top - 1 && box.bottom <= stickyCover.bottom + 1)
          return false;
        const island = native.el.getBoundingClientRect();
        return box.left < island.right && island.left < box.right && box.top < island.bottom && island.top < box.bottom;
      });
    }
    /** Moves the holes kept where their islands hold with their elements, which moved since the plan. */
    followAnchoredHoles() {
      this.facts.paint.followAnchoredHoles();
    }
    /** `element` is no longer registered: a mask it refused is forgotten. */
    unregistered(element) {
      this.facts.paint.forgetMask(element);
    }
    /** Native raised islands it showed under the WebView: pages keep holes only for those it may still show there. */
    releaseRaised() {
      for (const [page, islands] of this.heldUnder) {
        const still = islands.filter((native) => this.ports.native.mayShowUnder(native.handle.islandId));
        if (still.length > 0)
          this.heldUnder.set(page, still);
        else
          this.heldUnder.delete(page);
      }
    }
    /** Gives the page back every hole written for the plans sent. */
    releasePaint() {
      this.facts.paint.release();
      this.heldUnder.clear();
      this.pageHandoffs.clear();
    }
    begin(inputs) {
      this.inputs = inputs;
      this.facts.compositionEnabled = inputs.compositionEnabled;
      this.facts.capabilities = inputs.capabilities;
    }
    buildNatives(refusedUnderlays = /* @__PURE__ */ new Set()) {
      const { motion } = this.facts;
      const { natives } = this.ports;
      const reading = {
        motion,
        innerScrollMode: this.inputs.innerScrollMode,
        refusedUnderlays,
        backdrops: modalBackdrops(),
        fading: motion.fading(),
        refusedBecause: (islandId) => this.ports.native.refusedBecause(islandId),
        stickyMotion: (box, basis) => this.layerBuilder.stickyMotion(box, basis)
      };
      for (const handle of natives)
        handle.reconcileObservedStyles();
      resetPaintOrderCache();
      return withSceneReadScope(() => natives.map((handle, dom) => readNativeState(handle, dom, reading)));
    }
    planScene() {
      const { natives } = this.ports;
      const { motion, paint } = this.facts;
      const anyShown = natives.some((handle) => handle.canAttemptNative() && isElementVisible(handle.el));
      this.catchUp(anyShown);
      const effects = anyShown ? this.ports.effects.collect() : [];
      this.planEffects = effects;
      const animated = new Set(effects.map((effect) => effect.target));
      for (const target of outermost([...animated, ...this.animatedTargets]))
        this.forgetLayers(target);
      this.animatedTargets = animated;
      motion.describe(effects, this.facts.capabilities);
      const { layers, covered } = this.readLayers(anyShown, effects);
      this.leadMovingLayers(layers);
      const moves = this.movesIslands(effects) || natives.some((handle) => handle.requiresUnobscuredSurface && motion.targets(handle.el).length > 0);
      const handoffs = this.planPageHandoffs(covered);
      let refused = /* @__PURE__ */ new Set();
      let plan = this.planNatives(layers, refused, covered, handoffs);
      let cutsFollow = plan.cutsFollow;
      while (plan.refusedUnderlays.size > 0) {
        refused = /* @__PURE__ */ new Set([...refused, ...plan.refusedUnderlays]);
        plan = this.planNatives(layers, refused, covered, handoffs);
        cutsFollow || (cutsFollow = plan.cutsFollow);
      }
      const { natives: states, canvasColor } = plan;
      this.pageHandoffs = handoffs;
      const follow = moves || cutsFollow;
      const geometry = new Map(planned(states, "underlay").map(({ handle, rect, visualRect, paintRect, coordinateSpace, scrollPath: scrollPath2 }) => [
        handle.islandId,
        { rect, visualRect, paintRect, coordinateSpace, scrollPath: scrollPath2 }
      ]));
      const { hidden, curtain } = this.findCovers(states, layers);
      const held = this.ports.native.planned(states);
      resetPaintOrderCache();
      const payload = withSceneReadScope(() => writeLayout(states, layers, effects, canvasColor, {
        scrollOffsets: this.ports.native.scrollers,
        motion,
        planes: this.planes,
        paneColors: paint.paneColors,
        holds: (handle) => held.has(handle),
        motionPayloads: (targets, running) => this.ports.motionPayloads(motion, targets, running)
      }));
      return { payload, covered: hidden, geometry, curtain, follow };
    }
    /** Brings what was read up to date with the changes since the last plan. */
    catchUp(anyShown) {
      const reached = anyShown ? this.ports.page.takeRestyled() : [];
      if (reached === "all") {
        forgetKeyframeImpacts();
        this.forgetLayers();
      } else
        for (const root of outermost(reached))
          this.forgetLayers(root);
      this.facts.paint.releaseStaleBackgrounds();
      this.ports.effects.pruneDetached();
      this.ports.page.observeComposition([
        ...this.ports.natives.map((handle) => handle.el),
        ...this.ports.layers.map((handle) => handle.el)
      ]);
    }
    /** The page's layers, less those inside a page covered whole; and the covered pages. */
    readLayers(anyShown, effects) {
      return withSceneReadScope(() => {
        const all = anyShown ? this.layerBuilder.build(effects) : [];
        const covered = this.facts.compositionEnabled ? coveredWebLayers(all, this.ports.natives) : [];
        const coveredElements = new Set(covered.map((layer) => layer.el));
        return {
          layers: all.filter((layer) => activeTopLayerAncestor(layer.el) !== null || !hasComposedAncestorIn(layer.el, coveredElements)),
          covered
        };
      });
    }
    movesIslands(effects) {
      const { motion } = this.facts;
      return effects.some((effect) => effect.impact === "global-layout" || !effect.pseudo && !motion.entries.has(effect.target) && (effect.impact === "local-composition" || effect.impact === "repaint") && this.ports.natives.some((handle) => isComposedAncestor(effect.target, handle.el)));
    }
    /** Layers moved by what native does not run are cut a frame ahead of where they are. */
    leadMovingLayers(layers) {
      var _a;
      const { motion } = this.facts;
      const now = performance.now();
      const moving = /* @__PURE__ */ new Set();
      for (const layer of layers) {
        if (!((_a = layer.movers) === null || _a === void 0 ? void 0 : _a.some((target) => !motion.entries.has(target))))
          continue;
        moving.add(layer.el);
        const previous = this.motionSamples.get(layer.el);
        this.motionSamples.set(layer.el, { x: layer.visualRect.x, y: layer.visualRect.y, at: now });
        const elapsed = previous ? now - previous.at : 0;
        if (!previous || elapsed < 4 || elapsed > 100)
          continue;
        const ahead = this.inputs.frameInterval / elapsed;
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
    planPageHandoffs(covered) {
      var _a;
      const handoffs = /* @__PURE__ */ new Map();
      for (const layer of covered)
        handoffs.set(layer.el, { state: "covered", islands: [] });
      for (const [page, recorded] of this.heldUnder) {
        if (handoffs.has(page))
          continue;
        const islands = recorded.filter((native) => this.ports.native.mayShowUnder(native.handle.islandId));
        const state = ((_a = this.pageHandoffs.get(page)) === null || _a === void 0 ? void 0 : _a.state) === "covered" ? "uncovering" : islands.length > 0 ? "held" : "settled";
        handoffs.set(page, { state, islands });
      }
      return handoffs;
    }
    planNatives(layers, refusedUnderlays, covered, handoffs) {
      var _a, _b;
      const natives = this.buildNatives(refusedUnderlays);
      const canvas = canvasStack(natives, layers);
      this.facts.planCanvas = canvas;
      const plannable = natives.filter((native) => native.active);
      let cutsFollow = false;
      withSceneReadScope(() => {
        const { planes } = this;
        planes.resolveHostPlanes(natives, layers);
        planes.resolveWebUnderlays(natives, layers);
        planes.refuseInseparableOverlaps(natives);
        planes.detectBackgroundPaintConflicts(natives, layers);
        planes.detectLayerCoordinateConflicts(natives, layers);
        cutsFollow = planes.overlayCutsFollow(natives, layers);
        planes.resolveMotionDependencies(natives, layers);
      });
      const revealed = this.holdingUnderlays(natives);
      this.heldUnder = this.facts.paint.apply(revealed, layers, canvas, covered, handoffs);
      resetPaintOrderCache();
      const canvasColor = (_b = (_a = canvas === null || canvas === void 0 ? void 0 : canvas.color) !== null && _a !== void 0 ? _a : revealed.some((native) => native.holding) ? this.ports.native.shownCanvasColor() : null) !== null && _b !== void 0 ? _b : pageCanvasColor();
      const refused = plannable.filter((native) => !native.active && native.plane === "underlay");
      return { natives, canvasColor, refusedUnderlays: new Set(refused.map((native) => native.el)), cutsFollow };
    }
    /** Islands native may still show under the WebView stay there, where native shows them, until it raises them. */
    holdingUnderlays(natives) {
      const held = new Map(Array.from(this.heldUnder.values()).flatMap((islands) => islands.map((native) => [native.handle, native])));
      return natives.map((native) => {
        var _a;
        const id = native.handle.islandId;
        if (!native.active || native.plane !== "overlay" || !this.ports.native.mayShowUnder(id))
          return native;
        const placed = (_a = held.get(native.handle)) !== null && _a !== void 0 ? _a : this.ports.native.placedUnder(id);
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
    /**
     * The islands under the WebView paint covers, and the layer that covers them all: an island
     * above the page is hidden by cutting all of it out; one below, by the paint over it.
     */
    findCovers(natives, layers) {
      var _a, _b;
      const viewport = windowRect("document");
      const hiddenBy = (native, covers) => {
        const shown = native.visualRect && intersection(native.visualRect, viewport);
        return shown === null || covers.some((cover) => hidesIsland(cover, native, shown));
      };
      const hidden = new Set(planned(natives, "underlay").filter((native) => hiddenBy(native, layers)).map((native) => native.handle.islandId));
      const showing = natives.filter((native) => native.active);
      const under = planned(showing);
      const curtain = showing.length > 0 && under.length === showing.length ? (_b = (_a = layers.find((cover) => coversViewport(cover) && under.every((native) => hiddenBy(native, [cover])))) === null || _a === void 0 ? void 0 : _a.el) !== null && _b !== void 0 ? _b : null : null;
      return { hidden, curtain };
    }
  }
  function coveredWebLayers(layers, natives) {
    const viewport = windowRect("document");
    const covers = layers.filter((layer) => {
      var _a, _b, _c;
      const paint = (_a = layer.backgroundPaint) !== null && _a !== void 0 ? _a : separableBackgroundPaint(computedStyle(layer.el));
      return layer.cutoutIssue === null && (paint === null || paint === void 0 ? void 0 : paint.image) === "none" && colorAlpha(paint.color) === 1 && ((_c = (_b = layer.animators) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) === 0 && document.scrollingElement != null && stationaryCoordinatePaths(layer, { coordinateSpace: "viewport", scrollPath: [] }) && opaqueContainsRect(layer.visualRect, viewport) && natives.some((native) => native.el.isConnected && comparePaintOrder(layer.el, native.el) < 0);
    });
    const covered = layers.filter((layer) => covers.some((cover) => above(cover, layer)) && establishesStackingContext(layer.el) && !natives.some((native) => isElementVisible(native.el) && isComposedAncestor(layer.el, native.el)));
    const elements = new Set(covered.map((layer) => layer.el));
    return covered.filter((layer) => {
      const parent = composedParentElement(layer.el);
      return parent === null || !hasComposedAncestorIn(parent, elements);
    });
  }
  function canvasStack(natives, layers) {
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
  const HOLD_LIMIT_MS = 1e3;
  const NO_ANIMATIONS = /* @__PURE__ */ new Set();
  const NO_CHANGES = { scriptTranslated: false, domChanged: false };
  const SCROLL_PLAN_INTERVAL_MS = 250;
  const CURTAIN_PLAN_INTERVAL_MS = 200;
  class StackingService {
    /**
     * `onOpenRoot` hears of each open shadow root found where islands composite;
     * `automaticLayerCandidates` lists every element that may paint over or under an island.
     * `runningEffects`, where it answers, stands in for the effects the page runs, as a test page
     * that runs none needs.
     */
    constructor(onOpenRoot = () => void 0, automaticLayerCandidates = () => [], runningEffects = () => void 0) {
      this.natives = [];
      this.layers = [];
      this.compositionEnabled = false;
      this.holds = 0;
      this.gate = { state: "open" };
      this.writes = new RuntimeWrites();
      this.frames = new FrameLoop(() => this.link.ready, (frameTime) => this.runFrame(frameTime));
      this.effects = new RunningEffects({
        natives: this.natives,
        layers: this.layers,
        refresh: () => this.refresh(),
        mayReachIsland: (target) => this.scene.mayReachIsland(target),
        clock: this.frames,
        motionStartsAtCommit: () => !!this.link.capabilities.motionStartsAtCommit,
        scriptTranslated: () => this.pageWatch.changes.scriptTranslated
      });
      this.link = new NativeLink(this.natives, {
        refresh: () => this.refresh(),
        schedule: () => this.frames.schedule(),
        raised: () => {
          this.scene.releaseRaised();
          this.refresh();
        },
        forgetPaint: () => this.scene.releasePaint(),
        republish: () => this.republish()
      }, this.effects, {
        observeSize: (element) => this.pageWatch.observeSize(element),
        unobserveSize: (element) => this.pageWatch.unobserveSize(element)
      }, this.writes);
      this.canShow = () => this.natives.some((handle) => handle.canAttemptNative());
      this.refresh = () => {
        this.frames.ask();
        this.effects.markDue();
      };
      this.resolveNow = () => this.resolve();
      this.scene = new ScenePlanner({
        natives: this.natives,
        layers: this.layers,
        candidates: automaticLayerCandidates,
        settleWrite: (box, written) => {
          const pending = this.pageWatch.takePendingMutations(box, written);
          if (pending.length > 0)
            queueMicrotask(() => this.handleDomMutations(pending));
        },
        writes: this.writes,
        native: this.link,
        effects: {
          collect: () => {
            var _a;
            return (_a = runningEffects()) !== null && _a !== void 0 ? _a : this.effects.collect();
          },
          pruneDetached: () => this.effects.pruneDetached()
        },
        page: {
          takeRestyled: () => this.pageWatch.takeRestyled(),
          observeComposition: (elements) => this.pageWatch.observeComposition(elements)
        },
        motionPayloads: (motion, targets, effects) => this.effects.payloads(motion, targets, effects)
      });
      this.pageWatch = new PageWatch({
        effects: this.effects,
        writes: this.writes,
        scene: this.scene,
        frames: this.frames,
        link: this.link,
        natives: this.natives,
        refresh: () => this.refresh(),
        handleDomMutations: (records) => this.handleDomMutations(records)
      }, onOpenRoot);
    }
    /** Takes on how the transport carries plans: set as a transport is picked. */
    configure(configuration) {
      this.compositionEnabled = configuration.compositionEnabled;
      this.link.configure(configuration.innerScrollMode, configuration.commandsFollowLayouts);
    }
    registerNative(handle) {
      trace("register", { island: handle.islandId });
      if (this.natives.some((candidate) => candidate.el === handle.el))
        return;
      const priorIndex = this.natives.findIndex((candidate) => candidate.islandId === handle.islandId && candidate.el !== handle.el);
      if (priorIndex >= 0) {
        const [prior] = this.natives.splice(priorIndex, 1);
        this.pageWatch.unobserveSize(prior.el);
      }
      this.link.registered(handle);
      this.natives.push(handle);
      this.effects.forgetRoots();
      this.pageWatch.observeSize(handle.el);
      const failure = this.link.failure;
      if (failure)
        handle.failNative(failure.message);
    }
    registerLayer(handle) {
      if (this.layers.some((candidate) => candidate.el === handle.el))
        return;
      this.link.invalidate();
      this.layers.push(handle);
      this.effects.forgetRoots();
      this.pageWatch.observeSize(handle.el);
      this.refresh();
    }
    unregister(el) {
      this.scene.unregistered(el);
      this.effects.forgetRoots();
      const nativeIndex = this.natives.findIndex((candidate) => candidate.el === el);
      if (nativeIndex >= 0) {
        this.link.invalidate();
        this.natives.splice(nativeIndex, 1);
        this.pageWatch.unobserveSize(el);
      }
      const layerIndex = this.layers.findIndex((candidate) => candidate.el === el);
      if (layerIndex >= 0) {
        this.link.invalidate();
        this.layers.splice(layerIndex, 1);
        this.pageWatch.unobserveSize(el);
      }
      this.refresh();
    }
    findNative(id) {
      return this.natives.find((native) => native.islandId === id);
    }
    /**
     * Native starts over, as a transport session begins: every plan sent and what native held of it
     * is forgotten. Returns what the session reports as the reset settles and while it lasts; with
     * `notifyAvailable`, islands hear that native has become available once it says what it supports.
     */
    beginTransportReset(notifyAvailable = false) {
      this.gate = { state: "open" };
      return this.link.beginSession(notifyAvailable);
    }
    /** Forgets what was read of `root` and everything in it, or of the whole page. */
    invalidateAutomaticLayers(root) {
      this.scene.forgetLayers(root);
    }
    /** See `holdNativeIslands`. */
    hold() {
      this.holds += 1;
      trace("hold", { holds: this.holds });
      let released = null;
      const release = () => {
        if (released)
          return released;
        clearTimeout(limit);
        this.holds -= 1;
        trace("release", { holds: this.holds });
        released = this.link.nextApplied(() => {
          if (this.holds === 0)
            this.refresh();
        });
        released.catch(() => void 0);
        return released;
      };
      const limit = setTimeout(() => void release(), HOLD_LIMIT_MS);
      return release;
    }
    synchronize() {
      const failure = this.link.failure;
      if (failure)
        return Promise.reject(failure);
      this.scene.forgetLayers();
      return this.link.nextApplied(this.refresh);
    }
    republish() {
      this.link.invalidate();
      return this.synchronize();
    }
    start(onChange, onScroll) {
      if (!this.link.attach(onChange, onScroll !== null && onScroll !== void 0 ? onScroll : null))
        return;
      this.pageWatch.start();
      this.refresh();
    }
    observeEffectRoot(root) {
      this.pageWatch.observeRoot(root);
    }
    unobserveEffectRoot(root) {
      this.pageWatch.unobserveRoot(root);
    }
    handleDomMutations(records) {
      this.effects.markDue();
      if (!tracing())
        return this.noteDomMutations(records);
      const start = performance.now();
      const before = this.pageWatch.changes.domChanged;
      try {
        this.noteDomMutations(records);
      } finally {
        trace("mutations", {
          ms: performance.now() - start,
          records: records.length,
          // What changed, and whether it counted as a change to plan for.
          changed: !before && this.pageWatch.changes.domChanged,
          what: records.slice(0, 6).map((record) => {
            var _a, _b;
            const target = record.target;
            const name = `${(_b = (_a = target.nodeName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "?"}${typeof target.className === "string" && target.className ? `.${target.className.split(" ").filter(Boolean).slice(0, 2).join(".")}` : ""}`;
            return record.type === "attributes" ? `${name}[${record.attributeName}]` : `${name} ${record.type}`;
          })
        });
      }
    }
    /** Plans the scene now, writing the paint it wants, without sending it; returns the layout. */
    planScene() {
      return this.resolve().payload;
    }
    noteDomMutations(records) {
      var _a;
      const change = this.pageWatch.noteMutations(records);
      if (!change)
        return;
      const { reachesAll, uncovering } = change;
      const gate = this.gate;
      if (gate.state !== "away" || reachesAll || uncovering || change.records.some((record) => this.reachesIsland(record))) {
        if (gate.state === "curtained" && (reachesAll || records.some((record) => touchesCurtain(record, gate.curtain))))
          this.gate = { state: "open" };
        this.frames.askForChange(change.hosts, !reachesAll && !uncovering);
      }
      if (uncovering)
        this.runFrame((_a = this.frames.lastFrameTime) !== null && _a !== void 0 ? _a : performance.now());
    }
    /** Whether a change is to an island, to something holding one, or adds or takes one away. */
    reachesIsland(record) {
      const target = record.target;
      if (this.natives.some((handle) => {
        var _a;
        return target === handle.el || ((_a = target.contains) === null || _a === void 0 ? void 0 : _a.call(target, handle.el));
      }))
        return true;
      if (record.type !== "childList")
        return false;
      return [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => this.natives.some((handle) => {
        var _a;
        return node === handle.el || ((_a = node.contains) === null || _a === void 0 ? void 0 : _a.call(node, handle.el));
      }));
    }
    /** Plans the scene. Islands are never away when it runs, so the curtain it finds is the whole gate. */
    resolve() {
      const plan = this.scene.plan({
        compositionEnabled: this.compositionEnabled,
        capabilities: this.link.capabilities,
        innerScrollMode: this.link.innerScrollMode,
        frameInterval: this.frames.interval
      });
      const { curtain } = plan;
      this.frames.following = plan.follow;
      this.gate = curtain ? { state: "curtained", curtain } : { state: "open" };
      return plan;
    }
    runFrame(frameTime) {
      const start = tracing() ? performance.now() : 0;
      try {
        const frame = this.frameGate(frameTime);
        if (frame)
          this.sendPlan(frameTime, frame);
      } finally {
        this.effects.endFrame();
        if (tracing())
          trace("frame", { ms: performance.now() - start });
      }
    }
    /** Whether this frame plans, and what it found running; a frame that does not schedules the next look. */
    frameGate(frameTime) {
      if (!this.link.ready)
        return null;
      if (this.holds > 0) {
        trace("held");
        return null;
      }
      if (!this.frames.beginFrame(frameTime))
        return null;
      if (this.staysAway())
        return null;
      this.scene.followAnchoredHoles();
      const scrolling = this.frames.scrolling;
      const fresh = this.effects.listFrame(scrolling);
      const started = fresh.length > 0;
      const still = !scrolling && !fresh.some((animation) => this.effects.mayReachIsland(animation));
      const follow = this.frames.followDue(frameTime, started);
      if (!this.frames.requested && !started && !follow) {
        this.idleFrame();
        return null;
      }
      if (this.waits(frameTime, started, follow, scrolling))
        return null;
      trace("plan", { started, follow, preparing: this.effects.preparing });
      return { fresh, still, paused: NO_ANIMATIONS, changes: NO_CHANGES, frameInterval: 0 };
    }
    /**
     * No island can show and native already has every one off, so a plan would send the same
     * again: a page busy changing where no island is (another tab, a page over them) costs
     * nothing here. Only a change to the page, or the idle watch, looks again, as looking reads
     * style: a change that shows an island wakes the loop, and the idle watch catches the rest.
     */
    staysAway() {
      const lookAgain = this.frames.takeLookAgain();
      const away = this.gate.state === "away";
      if (!away || this.frames.requested || lookAgain || this.link.awaited) {
        if (this.islandsAway())
          this.gate = { state: "away" };
        else if (away)
          this.gate = { state: "open" };
      }
      if (this.gate.state !== "away")
        return false;
      trace("away");
      this.frames.awayFrame(this.canShow);
      return true;
    }
    /** Every island is out of the rendered page, and the last plan native has turned all of them off. */
    islandsAway() {
      if (this.effects.busy || !this.link.holdsOff())
        return false;
      return this.natives.every((handle) => !(handle.canAttemptNative() && isElementVisible(handle.el)));
    }
    idleFrame() {
      trace("idle");
      this.frames.idleFrame(this.canShow);
    }
    /** Whether a frame asked to plan waits: under a curtain, while the page scrolls, or for paint. */
    waits(frameTime, started, follow, scrolling) {
      const needsCreate = this.link.awaitsCreation();
      const sincePlan = this.frames.sincePlan(frameTime);
      if (this.gate.state === "curtained" && !started && !this.frames.urgent && !needsCreate && !this.link.awaited && sincePlan < CURTAIN_PLAN_INTERVAL_MS) {
        trace("curtained");
        this.frames.schedule();
        return true;
      }
      if (!started && !follow && !this.link.awaited && scrolling && (this.link.innerScrollMode === "bridge" ? !needsCreate : sincePlan < SCROLL_PLAN_INTERVAL_MS)) {
        trace("scrolling");
        this.frames.schedule();
        return true;
      }
      return this.link.waitsForPaint(this.pageWatch.changes.domChanged, this.resolveNow);
    }
    /** Plans the scene and sends it, unless native already has it. */
    sendPlan(frameTime, frame) {
      this.frames.taken();
      frame.paused = this.effects.beginPlan(frame.fresh);
      const plan = this.resolve();
      frame.changes = this.pageWatch.takeChanges();
      frame.frameInterval = this.frames.interval;
      this.tracePlanned(plan.payload);
      this.frames.planned(frameTime, this.link.send(plan, frame));
    }
    tracePlanned(payload) {
      if (!tracing())
        return;
      trace("planned", {
        registered: this.natives.map((handle) => handle.islandId),
        components: payload.components.map((component) => `${component.id}${component.active ? "" : "(off)"}`),
        visible: this.natives.map((handle) => isElementVisible(handle.el))
      });
    }
  }
  function touchesCurtain(record, curtain) {
    if (curtain.isConnected === false)
      return true;
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (!target)
      return false;
    if (isComposedAncestor(target, curtain) || isComposedAncestor(curtain, target)) {
      return record.type !== "childList" || target === curtain || isComposedAncestor(curtain, target);
    }
    return false;
  }
  const NATIVE_ISLANDS_TRANSPORT_PRIORITY = {
    unavailable: 0,
    carrier: 10
  };
  const DEFAULT_INITIALIZATION = {
    identity: "custom",
    priority: NATIVE_ISLANDS_TRANSPORT_PRIORITY.carrier
  };
  const RESTYLING_MEDIA = [
    "(prefers-color-scheme: dark)",
    "(prefers-contrast: more)",
    "(forced-colors: active)",
    "(prefers-reduced-motion: reduce)"
  ];
  class NativeIslandsRuntime {
    constructor() {
      this.transport = createWebTransport();
      this.transportPriority = Number.NEGATIVE_INFINITY;
      this.stacking = new StackingService((root) => this.watcher.watchShadowRoot(root), () => this.watcher.elements);
      this.watcher = new DocumentWatcher(this.stacking);
      this.events = new NativeEvents();
      this.transportDisposers = [];
      this.session = null;
      this.reports = null;
      this.started = false;
    }
    get available() {
      return this.transport.available;
    }
    initialize(transport, options = DEFAULT_INITIALIZATION) {
      const priority = transport.available ? options.priority : NATIVE_ISLANDS_TRANSPORT_PRIORITY.unavailable;
      if (this.transportIdentity !== void 0 && (options.identity === this.transportIdentity || this.transport.available || priority <= this.transportPriority)) {
        return false;
      }
      for (const dispose of this.transportDisposers.splice(0))
        dispose();
      this.transport = transport;
      this.transportIdentity = options.identity;
      this.transportPriority = priority;
      this.stacking.configure({
        compositionEnabled: transport.available,
        innerScrollMode: transport.innerScrollMode,
        commandsFollowLayouts: transport.ordered === true
      });
      this.events.attach(transport);
      if (transport.available) {
        this.beginSession(transport, true);
        this.listenToTransport(transport);
        this.autostart();
      }
      return true;
    }
    registerIsland(handle) {
      this.watcher.watchRootsOf(handle.el);
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
    hold() {
      return this.stacking.hold();
    }
    /** Sends a component command once native is reset; one issued before a later reset is dropped. */
    command(island, nativeComponent, method, properties, instance) {
      try {
        validateCommand(island, nativeComponent, method, properties);
      } catch (error) {
        return Promise.reject(error);
      }
      if (tracing())
        trace("command", { island, component: nativeComponent, method, properties });
      const request = Object.assign({ island, islandType: nativeComponent, method, params: properties }, instance !== void 0 && { instance });
      const issuedIn = this.session;
      if (!issuedIn)
        return this.transport.command(request);
      return this.afterReset(issuedIn, (session) => session === issuedIn ? session.transport.command(request) : Promise.resolve());
    }
    listen(eventName, listener, islandId) {
      return this.events.listen(eventName, listener, islandId);
    }
    listenToTransport(transport) {
      const reasonOf = (event, fallback) => typeof event.reason === "string" ? event.reason : fallback;
      this.transportDisposers.push(this.listen("islandError", (event) => {
        var _a;
        if (!event.island)
          return;
        const instance = typeof event.instance === "number" ? event.instance : void 0;
        (_a = this.stacking.findNative(event.island)) === null || _a === void 0 ? void 0 : _a.failNative(reasonOf(event, "Native component failed."), instance);
      }), this.listen("scrollError", (event) => {
        var _a;
        if (!Array.isArray(event.containers))
          return;
        (_a = this.reports) === null || _a === void 0 ? void 0 : _a.scrollFailed(event.containers.filter((id) => typeof id === "string"), reasonOf(event, "Native scroll synchronization failed."));
      }), this.listen("scrollRejected", (event) => {
        var _a;
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.offsetsRefused(new Error(reasonOf(event, "Native refused scroll offsets.")));
      }));
      if (typeof window === "undefined")
        return;
      const resetOnPageHide = () => this.beginSession(transport);
      const reconcileOnPageShow = (event) => {
        if (event.persisted && this.session)
          void this.restoreAfterPageShow(this.session);
      };
      window.addEventListener("pagehide", resetOnPageHide);
      window.addEventListener("pageshow", reconcileOnPageShow);
      this.transportDisposers.push(() => window.removeEventListener("pagehide", resetOnPageHide), () => window.removeEventListener("pageshow", reconcileOnPageShow));
    }
    beginSession(transport, notifyAvailable = false) {
      var _a;
      (_a = this.session) === null || _a === void 0 ? void 0 : _a.end();
      this.reports = this.stacking.beginTransportReset(notifyAvailable);
      this.session = new NativeSession(transport, this.reports);
    }
    /** Runs `action` in the session current once its reset settles, following any reset begun meanwhile. */
    async afterReset(from, action) {
      let session = from;
      await session.ready.catch(() => void 0);
      while (session !== this.session && this.session) {
        session = this.session;
        await session.ready.catch(() => void 0);
      }
      if (session.state.phase === "failed")
        throw session.state.failure;
      return action(session);
    }
    async restoreAfterPageShow(session) {
      let restoring;
      try {
        await this.afterReset(session, (current) => {
          restoring = current;
          return this.stacking.republish();
        });
        if (restoring === null || restoring === void 0 ? void 0 : restoring.current)
          this.stacking.refresh();
      } catch (error) {
        if (!(restoring === null || restoring === void 0 ? void 0 : restoring.current) || restoring.state.phase === "failed")
          return;
        restoring.fail(new Error(failureReason(error, "Native restoration failed", "Native components could not be restored after page show.")));
      }
    }
    autostart() {
      if (typeof document === "undefined")
        return;
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.start(), { once: true });
      } else {
        this.start();
      }
    }
    start() {
      if (this.started || !document.body)
        return;
      this.started = true;
      this.watcher.watchDocument();
      this.stacking.start((payload) => {
        var _a, _b;
        return (_b = (_a = this.session) === null || _a === void 0 ? void 0 : _a.applyLayout(payload)) !== null && _b !== void 0 ? _b : Promise.resolve();
      }, (payload) => {
        var _a;
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.sendOffsets(payload);
        return Promise.resolve();
      });
      this.refreshOnPageChanges();
    }
    /** Page changes that can move or restyle what islands sit in without a DOM mutation. */
    refreshOnPageChanges() {
      var _a, _b, _c, _d;
      const refresh = () => this.refresh();
      const restyle = () => {
        this.stacking.invalidateAutomaticLayers();
        this.refresh();
      };
      window.addEventListener("resize", refresh, { passive: true });
      window.addEventListener("load", restyle, { once: true });
      window.addEventListener("hashchange", restyle);
      document.addEventListener("fullscreenchange", restyle);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
          this.refresh();
      });
      void ((_b = (_a = document.fonts) === null || _a === void 0 ? void 0 : _a.ready) === null || _b === void 0 ? void 0 : _b.then(refresh).catch(() => void 0));
      (_c = document.fonts) === null || _c === void 0 ? void 0 : _c.addEventListener("loadingdone", refresh);
      (_d = document.fonts) === null || _d === void 0 ? void 0 : _d.addEventListener("loadingerror", refresh);
      for (const query of RESTYLING_MEDIA)
        window.matchMedia(query).addEventListener("change", restyle);
    }
  }
  const nativeIslandsRuntime = globalSingleton("runtime/v1", () => new NativeIslandsRuntime());
  function initializeNativeIslands(transport, options) {
    return nativeIslandsRuntime.initialize(transport, options);
  }
  const definitionState = globalSingleton("definitions/v1", () => ({
    commandGeneration: 0,
    commandsSuspended: false,
    islandSequence: 0,
    lifecycleListenersInstalled: false,
    definitions: /* @__PURE__ */ new Map()
  }));
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
  function nextIslandId() {
    return `native-island-${++definitionState.islandSequence}`;
  }
  class CommandFailures {
    constructor() {
      this.times = [];
      this.retry = null;
    }
    /** Records a failure of `command`; true when it makes too many within the window. */
    record(command) {
      const now = Date.now();
      this.times = this.times.filter((at) => now - at < REFUSAL_WINDOW_MS);
      this.times.push(now);
      if (this.times.length >= MAX_REFUSALS)
        return true;
      this.retry = this.retry === "create" ? "create" : command;
      return false;
    }
    forget() {
      this.times = [];
      this.retry = null;
    }
  }
  function validated(options) {
    var _a;
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
    return firstFrame;
  }
  function structuralSignature(options, observedAttributes, observedStyles, firstFrame) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return JSON.stringify({
      isInteractive: (_a = options.isInteractive) !== null && _a !== void 0 ? _a : false,
      accessibility: (_b = options.accessibility) !== null && _b !== void 0 ? _b : "web",
      requiresUnobscuredSurface: (_c = options.requiresUnobscuredSurface) !== null && _c !== void 0 ? _c : false,
      supportsProtectedSurfaceClip: (_d = options.supportsProtectedSurfaceClip) !== null && _d !== void 0 ? _d : false,
      observedAttributes: [...observedAttributes].sort(),
      observedStyles: [...observedStyles].sort(),
      preserveChildren: (_e = options.preserveChildren) !== null && _e !== void 0 ? _e : false,
      hostsChildren: (_f = options.hostsChildren) !== null && _f !== void 0 ? _f : false,
      firstFrame: firstFrame && Object.assign(Object.assign({}, firstFrame), ((_g = options.firstFrame) === null || _g === void 0 ? void 0 : _g.startWhen) && { startWhen: true }),
      events: Object.entries((_h = options.events) !== null && _h !== void 0 ? _h : {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    });
  }
  function defineNativeIsland(options) {
    var _a, _b, _c, _d, _e;
    installCommandLifecycleListeners();
    const firstFrame = validated(options);
    const observedAttributes = [...new Set((_a = options.observedAttributes) !== null && _a !== void 0 ? _a : [])];
    const observedStyles = [
      ...new Set(((_b = options.observedStyles) !== null && _b !== void 0 ? _b : []).map((property) => property.trim()).filter(Boolean))
    ];
    const signature = structuralSignature(options, observedAttributes, observedStyles, firstFrame);
    const handlers = {
      getProperties: options.getProperties,
      renderFallback: options.renderFallback,
      firstFrameStartWhen: (_c = options.firstFrame) === null || _c === void 0 ? void 0 : _c.startWhen
    };
    const existing = definitionState.definitions.get(options.tagName);
    if (existing) {
      if (existing.nativeComponent !== options.nativeComponent) {
        throw new Error(`<${options.tagName}> is already registered for "${existing.nativeComponent}".`);
      }
      if (existing.structuralSignature !== signature) {
        throw new Error(`<${options.tagName}> is already registered with a different definition contract.`);
      }
      Object.assign(existing.handlers, handlers);
      return existing.constructor;
    }
    if (customElements.get(options.tagName)) {
      throw new Error(`<${options.tagName}> was defined outside Native Islands.`);
    }
    registerIslandContract(options.nativeComponent, {
      tagName: options.tagName,
      observedAttributes,
      requiresUnobscuredSurface: (_d = options.requiresUnobscuredSurface) !== null && _d !== void 0 ? _d : false,
      supportsProtectedSurfaceClip: (_e = options.supportsProtectedSurfaceClip) !== null && _e !== void 0 ? _e : false
    });
    const constructor = defineIslandElement(options, handlers, observedAttributes, observedStyles, firstFrame);
    definitionState.definitions.set(options.tagName, {
      nativeComponent: options.nativeComponent,
      constructor,
      structuralSignature: signature,
      handlers
    });
    return constructor;
  }
  function defineIslandElement(options, handlers, observedAttributes, observedStyles, firstFrame) {
    const reflectedAttributes = /* @__PURE__ */ new Set();
    const portalOwners = /* @__PURE__ */ new Map();
    class DefinedNativeIsland extends HTMLElement {
      constructor() {
        var _a, _b, _c, _d;
        super();
        this._islandId = nextIslandId();
        this.type = options.nativeComponent;
        this.interactive = (_a = options.isInteractive) !== null && _a !== void 0 ? _a : false;
        this.requiresUnobscuredSurface = (_b = options.requiresUnobscuredSurface) !== null && _b !== void 0 ? _b : false;
        this.supportsProtectedSurfaceClip = (_c = options.supportsProtectedSurfaceClip) !== null && _c !== void 0 ? _c : false;
        this.placement = { kind: "detached" };
        this.lifecycle = new IslandLifecycle(firstFrame !== void 0);
        this.presentation = new IslandPresentation(this, {
          render: (element) => handlers.renderFallback(element),
          keepsChildren: !!(options.preserveChildren || options.hostsChildren),
          webAccessibility: ((_d = options.accessibility) !== null && _d !== void 0 ? _d : "web") === "web"
        });
        this.firstFrameDeadline = firstFrame && new FirstFrameDeadline(firstFrame.timeoutMs, () => this.reportError(`Native first frame was not reported within ${firstFrame.timeoutMs} ms.`, "firstFrameTimeout"));
        this.failures = new CommandFailures();
        this.mountGeneration = 0;
        this.disconnectGeneration = 0;
        this.nativeInactiveReason = null;
        this.eventDisposers = [];
        this.updateScheduled = false;
        this.observedStyleSnapshot = null;
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
      get islandId() {
        return this._islandId;
      }
      get portal() {
        var _a, _b;
        const value = (_b = (_a = this.getAttribute("data-native-island-portal")) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "";
        return value.length > 0 && value.length <= 128 ? value : null;
      }
      get connected() {
        return this.placement.kind !== "detached";
      }
      get failed() {
        return this.lifecycle.state === "failed";
      }
      get drawn() {
        return !firstFrame || this.lifecycle.state === "drawn";
      }
      canAttemptNative() {
        return this.connected && !this.failed && nativeIslandsRuntime.available;
      }
      connectedCallback() {
        this.disconnectGeneration += 1;
        if (this.connected)
          return;
        this.mountGeneration += 1;
        this.placement = { kind: "web" };
        if (options.hostsChildren)
          markIslandHost(this);
        if (nativeIslandsRuntime.available && this.becomeHosted())
          return;
        this.adoptPortalView();
        const portalKey = this.portal;
        if (portalKey)
          portalOwners.set(portalKey, this);
        nativeIslandsRuntime.registerIsland(this);
        if (!nativeIslandsRuntime.available) {
          this.presentation.showWeb();
          return;
        }
        this.activateNative();
      }
      disconnectedCallback() {
        if (this.placement.kind === "detached")
          return;
        if (this.placement.kind === "hosted") {
          const { host } = this.placement;
          this.placement = { kind: "detached" };
          this.removeAttribute("data-native-islands-hosted");
          host.hostedChildrenChanged(this);
          return;
        }
        const generation = ++this.disconnectGeneration;
        queueMicrotask(() => {
          var _a;
          if (generation !== this.disconnectGeneration || this.isConnected)
            return;
          const portalKey = this.portal;
          if (portalKey && portalOwners.get(portalKey) === this)
            portalOwners.delete(portalKey);
          this.mountGeneration += 1;
          this.placement = { kind: "detached" };
          this.lifecycle.transition({ type: "restarted" });
          this.failures.forget();
          this.nativeInactiveReason = null;
          (_a = this.firstFrameDeadline) === null || _a === void 0 ? void 0 : _a.cancel();
          this.observedStyleSnapshot = null;
          this.presentation.restoreWebPaint();
          this.stopListening();
          nativeIslandsRuntime.unregister(this);
        });
      }
      attributeChangedCallback(_name, oldValue, newValue) {
        if (!this.connected || oldValue === newValue)
          return;
        if (this.placement.kind === "hosted") {
          this.placement.host.hostedChildrenChanged(this);
          return;
        }
        nativeIslandsRuntime.refresh();
        this.propertiesChanged();
      }
      hostedIsland() {
        if (this.placement.kind !== "hosted")
          return null;
        return {
          element: this,
          nativeComponent: options.nativeComponent,
          properties: () => {
            var _a, _b;
            return (_b = (_a = handlers.getProperties) === null || _a === void 0 ? void 0 : _a.call(handlers, this)) !== null && _b !== void 0 ? _b : {};
          },
          dispatchNativeEvent: (event, detail) => {
            var _a;
            const domEvent = (_a = options.events) === null || _a === void 0 ? void 0 : _a[event];
            if (!domEvent)
              return false;
            this.dispatchEvent(new CustomEvent(domEvent, { bubbles: true, composed: true, detail }));
            return true;
          }
        };
      }
      hostedChildrenChanged(child) {
        noteHostedChange(this, child !== null && child !== void 0 ? child : null);
        if (this.placement.kind === "native")
          this.scheduleUpdate(false);
      }
      onTransportAvailable() {
        if (this.placement.kind !== "web" || this.failed)
          return;
        if (this.becomeHosted()) {
          nativeIslandsRuntime.unregister(this);
          return;
        }
        this.activateNative();
        nativeIslandsRuntime.refresh();
      }
      failNative(reason, instance) {
        var _a;
        if (instance !== void 0 && instance !== this.lifecycle.instance)
          return;
        if (!this.lifecycle.transition({ type: "failed" }))
          return;
        (_a = this.firstFrameDeadline) === null || _a === void 0 ? void 0 : _a.cancel();
        if (this.placement.kind === "native")
          this.placement = { kind: "web" };
        this.failures.retry = null;
        this.stopListening();
        this.presentation.removeAccessibility();
        this.reportError(reason);
      }
      nativeLayoutSent() {
        this.lifecycle.transition({ type: "sent" });
      }
      /** Native applied a layout that holds this island's view or not; holding, resolves once it is created. */
      nativeLayoutApplied(holds2) {
        var _a, _b;
        if (!this.lifecycle.transition({ type: "applied", holds: holds2 }))
          return holds2 ? this.creation : void 0;
        this.mountGeneration += 1;
        this.failures.retry = null;
        if (!holds2) {
          this.creation = void 0;
          (_a = this.firstFrameDeadline) === null || _a === void 0 ? void 0 : _a.cancel();
          if (firstFrame && this.connected)
            this.presentation.showWeb();
          return;
        }
        if (this.placement.kind !== "native")
          return;
        if (!this.drawn) {
          (_b = this.firstFrameDeadline) === null || _b === void 0 ? void 0 : _b.rearm();
          this.presentation.showWeb();
        }
        return this.creation = this.send("create");
      }
      nativeReset() {
        var _a;
        if (!this.lifecycle.transition({ type: "reset" }))
          return;
        this.mountGeneration += 1;
        this.creation = void 0;
        this.failures.retry = null;
        (_a = this.firstFrameDeadline) === null || _a === void 0 ? void 0 : _a.cancel();
        if (firstFrame && this.connected)
          this.presentation.showWeb();
      }
      /** Planned: shown natively (null), or held out for `reason` with the web implementation showing. */
      setNativeInactive(reason) {
        const retry = this.lifecycle.holdsView ? this.failures.retry : null;
        if (retry) {
          this.failures.retry = null;
          void this.send(retry);
        }
        if (this.nativeInactiveReason === reason)
          return;
        this.nativeInactiveReason = reason;
        if (reason === null) {
          this.removeAttribute("data-native-islands-inactive");
          if (this.placement.kind === "native")
            this.presentNative();
        } else {
          this.setAttribute("data-native-islands-inactive", "");
          this.presentation.showWeb();
        }
      }
      reconcileObservedStyles() {
        if (!this.connected || observedStyles.length === 0)
          return;
        const next = this.readObservedStyles();
        const previous = this.observedStyleSnapshot;
        this.observedStyleSnapshot = next;
        if (previous !== null && next !== previous)
          this.propertiesChanged();
      }
      /** Hands the view of the island holding this one's portal key over to this one. */
      adoptPortalView() {
        const portalKey = this.portal;
        if (!portalKey)
          return;
        const donor = portalOwners.get(portalKey);
        if (!donor || donor === this || donor.portal !== portalKey || !donor.lifecycle.holdsView)
          return;
        donor.surrenderView(this);
      }
      surrenderView(recipient) {
        var _a;
        this.mountGeneration += 1;
        (_a = this.firstFrameDeadline) === null || _a === void 0 ? void 0 : _a.cancel();
        this.stopListening();
        this.presentation.restoreWebPaint();
        recipient._islandId = this._islandId;
        recipient.lifecycle.state = this.lifecycle.state;
        recipient.lifecycle.instance = this.lifecycle.instance;
        this._islandId = nextIslandId();
        this.lifecycle.state = "pending";
        this.lifecycle.instance = 1;
        if (!this.isConnected) {
          this.placement = { kind: "detached" };
          nativeIslandsRuntime.unregister(this);
          return;
        }
        this.placement = { kind: "web" };
        this.activateNative();
      }
      /** Hands this island to the hosting island it sits in, if there is one. */
      becomeHosted() {
        const host = islandHostOf(this);
        if (!host)
          return false;
        this.placement = { kind: "hosted", host };
        this.setAttribute("data-native-islands-hosted", "");
        host.hostedChildrenChanged(this);
        return true;
      }
      activateNative() {
        var _a;
        if (this.placement.kind !== "web" || this.failed || !nativeIslandsRuntime.available)
          return;
        this.placement = { kind: "native" };
        if (this.drawn)
          this.presentation.showNative();
        else
          this.presentation.showWeb();
        this.listenToNative();
        if (this.lifecycle.holdsView)
          void this.send("create");
        else
          (_a = handlers.getProperties) === null || _a === void 0 ? void 0 : _a.call(handlers, this);
      }
      presentNative() {
        if (this.drawn)
          this.presentation.showNative();
      }
      listenToNative() {
        var _a;
        const listen = (event, callback) => {
          this.eventDisposers.push(nativeIslandsRuntime.listen(event, callback, this.islandId));
        };
        if (firstFrame)
          listen(firstFrame.event, (event) => this.firstFrameDrawn(event.instance));
        for (const [nativeEvent, domEvent] of Object.entries((_a = options.events) !== null && _a !== void 0 ? _a : {})) {
          listen(nativeEvent, (event) => {
            if (typeof event.instance === "number" && event.instance !== this.lifecycle.instance)
              return;
            const detail = Object.assign({}, event);
            delete detail.island;
            delete detail.instance;
            this.dispatchEvent(new CustomEvent(domEvent, { bubbles: true, composed: true, detail }));
          });
        }
      }
      firstFrameDrawn(instance) {
        var _a, _b;
        if (!this.connected || !this.lifecycle.transition({ type: "drawn", instance }))
          return;
        const late = (_b = (_a = this.firstFrameDeadline) === null || _a === void 0 ? void 0 : _a.drawn()) !== null && _b !== void 0 ? _b : false;
        if (late && this.failures.retry === null)
          this.removeAttribute("data-native-islands-error");
        if (this.nativeInactiveReason === null)
          this.presentNative();
        nativeIslandsRuntime.refresh();
      }
      stopListening() {
        for (const dispose of this.eventDisposers.splice(0))
          dispose();
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
      propertiesChanged() {
        if (this.placement.kind === "native")
          this.scheduleUpdate();
        else if (!nativeIslandsRuntime.available)
          this.presentation.showWeb();
      }
      readObservedStyles() {
        const style = computedStyle(this);
        return JSON.stringify(observedStyles.map((property) => style.getPropertyValue(property)));
      }
      async send(command) {
        var _a, _b, _c;
        const generation = this.mountGeneration;
        try {
          if (observedStyles.length > 0)
            this.observedStyleSnapshot = this.readObservedStyles();
          const properties = (_a = handlers.getProperties) === null || _a === void 0 ? void 0 : _a.call(handlers, this, { command });
          if (!this.drawn)
            (_b = this.firstFrameDeadline) === null || _b === void 0 ? void 0 : _b.start(() => {
              var _a2;
              return ((_a2 = handlers.firstFrameStartWhen) === null || _a2 === void 0 ? void 0 : _a2.call(handlers, this)) !== false;
            });
          await nativeIslandsRuntime.command(this.islandId, options.nativeComponent, command, properties, command === "create" ? this.lifecycle.instance : void 0);
        } catch (error) {
          if (!this.connected || generation !== this.mountGeneration || this.failed)
            return;
          const reason = error instanceof Error ? error.message : "Native command failed.";
          if (this.failures.record(command))
            this.failNative(reason);
          else
            this.reportError(reason);
          return;
        }
        const clean = generation === this.mountGeneration && !this.failed && this.failures.retry === null && !((_c = this.firstFrameDeadline) === null || _c === void 0 ? void 0 : _c.timedOut);
        if (clean)
          this.removeAttribute("data-native-islands-error");
      }
      /** Sends the island's properties once this task is done, however many changed in it. */
      scheduleUpdate(refreshAccessibility = true) {
        if (this.updateScheduled)
          return;
        this.updateScheduled = true;
        const commandGeneration = definitionState.commandGeneration;
        queueMicrotask(() => {
          this.updateScheduled = false;
          if (!this.connected || this.failed || !nativeIslandsRuntime.available || definitionState.commandsSuspended || commandGeneration !== definitionState.commandGeneration) {
            return;
          }
          if (refreshAccessibility && this.drawn)
            this.presentation.refreshAccessibility();
          if (this.lifecycle.holdsView)
            void this.send("update");
        });
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
      reset() {
        return callForCapabilities("reset", {});
      },
      on(eventName, listener) {
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
            [{}]
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
    const label = TEXT_LABELS[normalizedTextType];
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
    text.textContent = label;
    button.append(icon, text);
    button.setAttribute("aria-label", label);
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
