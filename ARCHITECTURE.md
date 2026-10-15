# Architecture & Git Workflow Specification 📐

Comprehensive architectural blueprint, security model, and Git development lifecycle for **RightClickRestore**.

---

## 1. Executive Summary & Design Principles

RightClickRestore is a dual-tier extension and companion application for macOS and Safari (Manifest V3) engineered to unblock copy, selection, context menus, and media interaction across restrictive web applications.

### Core Principles
- **Zero Trust DOM**: Untrusted page scripts frequently poison or clobber native DOM prototypes. RightClickRestore operates under the assumption that instance methods (`appendChild`, `querySelectorAll`, `attachShadow`, `getAttribute`) may be shadowed, spoofed, or overwritten by malicious forms or child elements.
- **Fail Closed & Safe**: Defensive routines never fall back to executing unknown instance properties. If an unshadowed native method cannot be resolved, the operation returns `null` or aborts safely.
- **Strict Boundary Separation**: Code runs across distinct execution environments (Main World, Isolated World, Service Worker, Popup, and Swift Companion App) with explicitly typed message interfaces.
- **High Performance / Low Latency**: Native DOM prototype references are captured at module evaluation time. Complex prototype chain walks are bypassed when standard instances do not possess shadowing properties.

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph macOS_Host["macOS Native Layer (AppKit / SwiftUI)"]
        HostApp["RightClickRestore.app\n(Menu Bar & Onboarding Window)"]
        PlugIn["PlugIns / RightClickRestore Extension.appex\n(SFSafariExtensionHandler)"]
        HostApp --> PlugIn
    end

    subgraph Safari_Engine["Safari Engine (WebKit)"]
        subgraph Extension_Context["Extension Process (MV3)"]
            Background["Background Service Worker\n(src/background/index.ts)"]
            Popup["Extension Popup (Svelte 5 + Tailwind v4)\n(src/popup/App.svelte)"]
            Storage[("chrome.storage.local\n(Settings & Domain Config)")]
            
            Popup <-->|"Settings Read/Write"| Storage
            Background <-->|"Event Dispatch & Badges"| Storage
        end

        subgraph Web_Page["Web Page Execution Context"]
            subgraph Main_World["Main World (Page Script)"]
                PageScript["src/page-script/index.ts\n(Event Trapping & Handler Stripping)"]
            end

            subgraph Isolated_World["Isolated World (Content Script)"]
                ContentScript["src/content/index.ts\n(DOM Cleaner, Anti-Shield & Style Injection)"]
                DOMUtils["src/shared/dom.ts\n(DOM Clobbering Defense Toolkit)"]
                ContentScript --> DOMUtils
            end

            DOM["DOM Tree\n(HTML5 Media, Inputs, ProseMirror, Monaco)"]
            
            PageScript -->|"Intercepts Capture Phase"| DOM
            ContentScript -->|"Mutations & Shadow Host"| DOM
            Main_World <-->|"Custom DOM Events"| Isolated_World
        end
    end

    PlugIn <-->|"Safari Web Extension API"| Background
    Background <-->|"chrome.tabs.sendMessage"| ContentScript
```

---

## 3. WebKit Execution Contexts & Inter-Process Communication

RightClickRestore partitions responsibilities across four distinct runtime contexts to balance security, performance, and permission boundaries:

| Context | Script | Permissions / Scope | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Main World** | [`src/page-script/index.ts`](file:///Users/marspater/Projects/right-click-restore/src/page-script/index.ts) | Unrestricted page JS access; no extension APIs. | Intercepts capture-phase `contextmenu`, `copy`, `cut`, `selectstart` events; disables inline handler properties (`oncontextmenu = null`). |
| **Isolated World** | [`src/content/index.ts`](file:///Users/marspater/Projects/right-click-restore/src/content/index.ts) | Access to DOM; isolated JavaScript global; limited Chrome extension APIs. | Injects user-select override styles; manages `MutationObserver` for video unblurring and anti-shield overlay bypass; displays closed-mode Shadow DOM toast. |
| **Service Worker** | [`src/background/index.ts`](file:///Users/marspater/Projects/right-click-restore/src/background/index.ts) | Full Web Extension APIs; no DOM access. | Manages persistent settings in `chrome.storage.local`; handles tab updates; routes broadcast messages across active tabs. |
| **Popup UI** | [`src/popup/App.svelte`](file:///Users/marspater/Projects/right-click-restore/src/popup/App.svelte) | Standard Web Extension popup; Svelte 5 Runes. | Controls global & per-site configuration; provides Force Unlock trigger; styled with Tailwind CSS v4 and macOS Liquid Glass aesthetics. |

---

## 4. DOM Clobbering Resistance Architecture

DOM Clobbering is an attack pattern where HTML forms or inputs containing specific `id` or `name` attributes shadow DOM properties on elements or the document (e.g. `<form id="appendChild">` or `<input name="querySelectorAll">`).

```mermaid
flowchart TD
    Start(["Call safeDOMMethod(target, ...args)"]) --> FastPathCheck{"Has target clobbered property?\n(Object.hasOwn)"}
    
    FastPathCheck -- "No (99.9% of calls)" --> CallCached["Invoke Cached Native Prototype Method\n(via safeApply)"]
    FastPathCheck -- "Yes (Instance Shadowed)" --> ProtoWalk["Walk Prototype Chain\n(getUnshadowedMethod)"]
    
    CallCached --> Success(["Operation Succeeded"])
    
    ProtoWalk --> Found{"Unshadowed Prototype\nMethod Found?"}
    Found -- "Yes" --> CallProto["Invoke Native Prototype Descriptor\n(via safeApply)"]
    Found -- "No" --> SafeFail["Return null / Abort Safely\n(Never execute target[method])"]
    
    CallProto --> Success
    SafeFail --> Terminate(["Defensive Termination"])
```

### Defense-in-Depth Mechanisms in `src/shared/dom.ts`:
1. **Module-Evaluation Initialization**: Native prototypes (`Element.prototype.getAttribute`, `Node.prototype.appendChild`, `Element.prototype.attachShadow`, `querySelectorAll`) are stored when the module loads, ahead of arbitrary page scripts.
2. **Function Application Detachment**: Functions are called using `safeApply`, which preferentially uses `Reflect.apply` or falls back to `Function.prototype.call.bind(Function.prototype.apply)`, preventing page scripts from spoofing `Function.prototype.apply`.
3. **Integer-Dispatched Node Type Queries**: `safeQuerySelectorAll` inspects `(root as Node).nodeType` directly (1 for Element, 9 for Document, 11 for DocumentFragment) to avoid high cyclomatic complexity while selecting the appropriate native prototype.
4. **No Insecure Fallbacks**: If instance properties are shadowed and prototype resolution fails, functions abort cleanly rather than calling `parent.appendChild(child)` or `element.attachShadow(init)`.

---

## 5. End-to-End Event Interception Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as User Action
    participant WebPage as Page Event Target
    participant MainWorld as Main World (Page Script)
    participant ContentScript as Isolated World (Content Script)
    participant Background as Service Worker
    participant Storage as chrome.storage.local

    Note over User,WebPage: User right-clicks or copies text
    User->>WebPage: Dispatch 'contextmenu' / 'copy' (Capture Phase)
    WebPage->>MainWorld: Intercepted by capture listener
    
    alt Event Default Prevented by Restrictive Script
        MainWorld->>MainWorld: Normalize event cancellation flag
        MainWorld->>WebPage: Stop immediate propagation
        MainWorld-->>User: Native Context Menu Displays
    else Interactive Element Guard
        MainWorld->>MainWorld: Check ALL_INTERACTIVE_SELECTORS (input, textarea, Monaco, ProseMirror)
        MainWorld->>WebPage: Allow native element interaction
    end

    opt Force Unlock Requested
        User->>ContentScript: Trigger Force Unlock from Popup
        ContentScript->>ContentScript: Clean inline oncontextmenu / onselectstart
        ContentScript->>ContentScript: Inject __rcr_selection_style__ via safeAppendChild
        ContentScript->>ContentScript: Create __rcr_toast_host__ with safeAttachShadow
        ContentScript-->>User: Visual Toast Notification Appears
    end
```

---

## 6. Git Architecture & Branching Workflow

RightClickRestore enforces a disciplined Git lifecycle paired with automated quality gates and strict commit semantics.

```mermaid
flowchart LR
    subgraph Feature_Branches["Working Branches"]
        feat["feat/*\n(New Capabilities)"]
        fix["fix/*\n(Bug Fixes)"]
        sentinel["sentinel/*\n(Security & Anti-Clobbering)"]
        bolt["bolt/*\n(Performance & DOM Caching)"]
        palette["palette/*\n(UI, Themes & Styling)"]
    end

    subgraph Verification["Local Verification & TDD"]
        TDD["1. Red / Green / Refactor\n2. bun test\n3. bun run check\n4. bun run format"]
    end

    subgraph Pull_Request["Pull Request & CI Pipeline"]
        PR["GitHub PR Review"]
        CI1["GitHub Actions CI\n(macOS 15 & macOS latest)"]
        CI2["Web Extension CI\n(Bun test & Build verification)"]
        Codacy["Codacy Analysis\n(ESLint 8, Lizard CCN ≤ 10)"]
        Sonar["SonarCloud Quality Gate\n(Duplication ≤ 3%, 0 Vulnerabilities)"]
    end

    subgraph Main_Branch["Main Production Line"]
        main["origin / main\n(Strict Signed Releases)"]
    end

    Feature_Branches --> TDD
    TDD --> PR
    PR --> CI1
    PR --> CI2
    PR --> Codacy
    PR --> Sonar
    CI1 & CI2 & Codacy & Sonar -->|"All Checks Pass"| main
```

### 1. Branch Naming Conventions
- `feat/<topic>`: Additions to core extension capabilities or UI.
- `fix/<topic>`: Regression and bug resolution.
- `sentinel/<topic>`: Security, DOM clobbering resistance, input sanitation.
- `bolt/<topic>`: Performance optimizations, caching, and prototype acceleration.
- `palette/<topic>`: Visual themes, macOS HIG adherence, Svelte/CSS refinements.

### 2. Commit Protocol
All commits follow the structured format:
```
<type>(<optional-scope>): <short description>
```
- **Allowed Types**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.
- **Length**: Maximum 50 characters for the subject line.
- **Mood**: Imperative mood without trailing period (`fix(dom): resolve method bindings`).

### 3. Automated Quality Gates
Every Pull Request must satisfy:
1. **Zero Open Issues in Codacy**: Includes ESLint, Lizard cyclomatic complexity (CCN ≤ 10), and OWASP security rules.
2. **SonarCloud Quality Gate**: Zero vulnerabilities, zero security hotspots, and new code duplication density ≤ 3.0%.
3. **Cross-Platform Matrix**: Universal Apple Silicon (`arm64`) and Intel (`x86_64`) builds passing on `macos-15` and `macos-latest`.
4. **Clean Formatting**: `biome check` and `biome format` with zero discrepancies.
