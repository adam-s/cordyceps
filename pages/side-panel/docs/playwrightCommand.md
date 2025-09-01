Got it, Mr. Sohn. Below is a clean inventory of every **BiDi command** this code sends (grouped by class/file), followed by compact **sequence/parallel flow charts** showing when they fire in a typical “connect → first page → navigate” lifecycle.

---

# Inventory — messages sent to WebDriver BiDi (by file/class)

## BidiBrowser

* `session.new` — during `connect`
* `session.subscribe` — during `connect`
* `browser.createUserContext` — in `doCreateNewContext(...)`
* *(dispatch-only; created elsewhere)* `createMainFrameBrowsingContextSession(...)` (not a BiDi command, just session plumbing)

## BidiBrowserContext

* `browsingContext.create` — in `_createNewPageImpl(...)`
* `storage.getCookies` — in `doGetCookies(...)`
* `storage.setCookie` — in `addCookies(...)` (per cookie)
* `storage.deleteCookies` — in `doClearCookies(...)`
* `permissions.setPermission` — in `_setPermission(...)` (grant/clear)
* `emulation.setGeolocationOverride` — in `setGeolocation(...)`
* `script.addPreloadScript` — in `doAddInitScript(...)`
* `script.removePreloadScript` — in `doRemoveInitScripts(...)` (per id)
* `browsingContext.setViewport` — in `doUpdateDefaultViewport(...)`
* `script.addPreloadScript` — in `doExposePlaywrightBinding(...)`
* `script.callFunction` — in `doExposePlaywrightBinding(...)` (for each main-world realm)
* `browser.removeUserContext` — in `doClose(...)`

## BidiPage

* `script.evaluate` *(sendMayFail)* — in `_touchUtilityWorld(...)`
* `browsingContext.handleUserPrompt` — in `_onUserPromptOpened(...)`
* `browsingContext.navigate` — in `navigateFrame(...)`
* `browsingContext.activate` — in `bringToFront(...)`
* `browsingContext.setViewport` — in `updateEmulatedViewportSize(...)`
* `browsingContext.reload` — in `reload(...)`
* `browsingContext.traverseHistory` — in `goBack(...)`, `goForward(...)`
* `script.addPreloadScript` — in `addInitScript(...)`
* `script.removePreloadScript` — in `removeInitScripts(...)`
* `browsingContext.close` — in `closePage(...)`
* `browsingContext.captureScreenshot` — in `takeScreenshot(...)`
* `input.setFiles` — in `setInputFilePaths(...)`

## BidiExecutionContext

* `script.evaluate` — in `rawEvaluateJSON(...)`, `rawEvaluateHandle(...)`
* `script.callFunction` — in `evaluateWithArguments(...)`, `_rawCallFunction(...)`
* `script.disown` — in `releaseHandle(...)`

## BidiNetworkManager (+ route)

* `network.setCacheBehavior` — in `_updateProtocolRequestInterception(...)`
* `network.addIntercept` — in `_updateProtocolRequestInterception(...)`
* `network.removeIntercept` — in `_updateProtocolRequestInterception(...)`
* `network.continueRequest` *(sendMayFail)* — in `_onBeforeRequestSent(...)` (redirect case) and `BidiRouteImpl.continue(...)`
* `network.provideResponse` *(sendMayFail)* — in `BidiRouteImpl.fulfill(...)`
* `network.failRequest` *(sendMayFail)* — in `BidiRouteImpl.abort(...)`
* `network.continueWithAuth` *(sendMayFail)* — in `_onAuthRequired(...)`

> Notes
> • All `...sendMayFail(...)` calls intentionally ignore transport errors (best-effort).
> • “Browser-level” calls use `this._browserSession`; “page/frame-level” calls use the per-page `this._session`.

---

# Flow — when these messages fire (sequential vs parallel)

## 1) Connect & (optional) persistent context boot

```mermaid
sequenceDiagram
  autonumber
  participant Client as Playwright (server)
  participant Browser as BiDi BrowserSession
  participant PageS as BiDi PageSession (created per top-level context)

  Client->>Browser: session.new
  Browser-->>Client: capabilities (userAgent, version)
  Client->>Browser: session.subscribe [browsingContext, network, log, script]

  alt options.persistent
    rect rgb(245,245,245)
      Note over Client,Browser: Create default persistent context & first page
      par Context init (in parallel)
        Client->>Browser: browsingContext.setViewport (if viewport set)
      and
        Client->>Browser: emulation.setGeolocationOverride (if geo set)
      and
        Client->>Browser: script.addPreloadScript (binding preload)
      end
      Client->>Browser: browsingContext.create (type: Window, userContext)
      Note over Browser,Client: emits browsingContext.contextCreated (event)
      Client->>PageS: (construct BidiPage/session for the new context)
    end
  else non-persistent
    Note over Client,Browser: No default context/page auto-created here
  end
```

**Key ordering:**

1. `session.new` → 2) `session.subscribe` are **sequential**.
   Persistent boot then runs a **parallel** init (`setViewport`, `setGeolocationOverride`, optional `addPreloadScript`) before/around `browsingContext.create`.

---

## 2) Page wiring right after `contextCreated`

```mermaid
sequenceDiagram
  autonumber
  participant Client as Playwright
  participant PageS as BiDi PageSession
  participant Net as BidiNetworkManager

  Note over Client,PageS: BidiPage._initialize()
  par In parallel (Promise.all)
    Client->>PageS: (via Net) network.setCacheBehavior (enabled? bypass : default)
    Client->>PageS: (via Net) network.addIntercept / removeIntercept
    Client-->>PageS: waitForBlockingPageCreations() (no BiDi sends)
  and
    Client->>PageS: (via Net) network.setCacheBehavior (triggered again if creds/interception)
  end

  Note over PageS: On first main-world realm per frame
  Client->>PageS: script.evaluate (touch utility world sandbox)
```

**Parallelism:**
Inside `_initialize()`, Playwright runs:

* `updateHttpCredentials()` → may call `_updateProtocolRequestInterception()`
* `updateRequestInterception()` → `_updateProtocolRequestInterception()`
* `waitForBlockingPageCreations()`
  Those two updates can each trigger **parallel** `network.setCacheBehavior` and `network.addIntercept/removeIntercept` (joined with `Promise.all`).

---

## 3) Navigation & request interception

```mermaid
sequenceDiagram
  autonumber
  participant Client as Playwright
  participant PageS as BiDi PageSession
  participant Net as BidiNetworkManager

  Client->>PageS: browsingContext.navigate (frameId, url)

  Note over PageS: Browser emits network.beforeRequestSent, etc.
  alt Interception or HTTP auth flows
    opt BeforeRequestSent (intercepts present)
      Client->>PageS: network.continueRequest (sendMayFail)  %% via BidiRouteImpl.continue(...)
    end
    opt Auth challenge
      Client->>PageS: network.continueWithAuth (sendMayFail)
    end
    opt Mock/fulfill/abort
      Client->>PageS: network.provideResponse (sendMayFail)
      Client->>PageS: network.failRequest (sendMayFail)
    end
  end

  Note over PageS: (later, any time)
  Client->>PageS: browsingContext.captureScreenshot
  Client->>PageS: browsingContext.reload
  Client->>PageS: browsingContext.traverseHistory (±1)
  Client->>PageS: browsingContext.activate
  Client->>PageS: input.setFiles
  Client->>PageS: browsingContext.close
```

**Ordering:**

* `browsingContext.navigate` is **sequentially** issued by your `goto`-style path.
* Interception-related sends (`continueRequest` / `provideResponse` / `failRequest` / `continueWithAuth`) occur **asynchronously**, driven by incoming network events. Multiple in-flight requests can cause these to happen **in parallel** across requests.

---

## 4) Script evaluation & bindings

```mermaid
sequenceDiagram
  autonumber
  participant Client as Playwright
  participant PageS as BiDi PageSession

  Note over PageS: One-time binding exposure (context-level)
  Client->>PageS: script.addPreloadScript (binding channel)
  par For each main-world realm
    Client->>PageS: script.callFunction (install binding into realm)
  end

  Note over PageS: General evaluations
  Client->>PageS: script.evaluate / script.callFunction (evaluateWithArguments)
  Client->>PageS: script.disown (release handles)
```

**Parallelism:**

* The “install binding into each realm” loop may fan out **in parallel** to multiple realms.
* Per-frame `script.evaluate` (utility world ping) occurs on each main-world realm creation.

---

## Handy cross-reference (which session sends what)

* **Browser-level (`_browserSession`):** `session.*`, `browser.*`, `storage.*`, `permissions.*`, `emulation.*`, context-wide `browsingContext.*` with `userContexts: [...]`, context-wide `script.add/removePreloadScript`, `script.callFunction` (binding install).
* **Page-level (`_session`):** `browsingContext.navigate/activate/reload/traverseHistory/close/setViewport/captureScreenshot/handleUserPrompt`, `input.setFiles`, `script.evaluate/callFunction/disown/addPreloadScript/removePreloadScript`, and **all** `network.*` controls (cache behavior, intercepts, continue/provide/abort/auth).
