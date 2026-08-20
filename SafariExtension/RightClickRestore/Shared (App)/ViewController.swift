//
//  ViewController.swift
//  Shared (App)
//
//  Created by Mars Pater on 2026-08-20.
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "com.antigravity.RightClickRestore.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = true
        self.webView.isOpaque = false
        self.webView.backgroundColor = .clear
#elseif os(macOS)
        self.webView.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) {
            self.webView.underPageBackgroundColor = .clear
        }
#endif

        // AutoLayout pinning to ensure the webView fills the entire window
        self.webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            self.webView.topAnchor.constraint(equalTo: self.view.topAnchor),
            self.webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            self.webView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            self.webView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor)
        ])

        self.webView.configuration.userContentController.add(self, name: "controller")

        loadMainContent()
    }

    func loadMainContent() {
        if let htmlURL = Bundle.main.url(forResource: "Main", withExtension: "html") ??
                         Bundle.main.url(forResource: "Main", withExtension: "html", subdirectory: "Base.lproj") {
            if let htmlString = try? String(contentsOf: htmlURL, encoding: .utf8) {
                self.webView.loadHTMLString(htmlString, baseURL: Bundle.main.resourceURL ?? htmlURL.deletingLastPathComponent())
                return
            }
            self.webView.loadFileURL(htmlURL, allowingReadAccessTo: Bundle.main.bundleURL)
        }
    }

#if os(macOS)
    override func viewWillAppear() {
        super.viewWillAppear()
        if let window = self.view.window {
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.styleMask.insert(.fullSizeContentView)
            window.isMovableByWindowBackground = true
            window.setContentSize(NSSize(width: 540, height: 640))
            window.minSize = NSSize(width: 480, height: 500)
            window.center()
        }
        checkExtensionStatus()
    }
#endif

    func checkExtensionStatus() {
#if os(macOS)
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            DispatchQueue.main.async {
                guard let state = state, error == nil else {
                    self.webView.evaluateJavaScript("updateStatus(false, 'unknown')")
                    return
                }
                self.webView.evaluateJavaScript("updateStatus(\(state.isEnabled), 'ready')")
            }
        }
#endif
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        webView.evaluateJavaScript("initPlatform('ios')")
#elseif os(macOS)
        webView.evaluateJavaScript("initPlatform('mac')")
        checkExtensionStatus()
#endif
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[WebView] Navigation failed:", error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("[WebView] Provisional navigation failed:", error.localizedDescription)
        loadMainContent()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let command = message.body as? String else { return }

#if os(macOS)
        switch command {
        case "open-preferences":
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
                if error != nil {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.Safari.Extensions") {
                        NSWorkspace.shared.open(url)
                    }
                }
            }
        case "open-test-suite":
            let testURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("test_page.html")
            NSWorkspace.shared.open(testURL)
        case "check-status":
            checkExtensionStatus()
        default:
            break
        }
#endif
    }
}
