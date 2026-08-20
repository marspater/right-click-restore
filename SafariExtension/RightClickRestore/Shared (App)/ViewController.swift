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

    var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "controller")
        config.userContentController = userContentController

#if os(macOS)
        let frame = NSRect(x: 0, y: 0, width: 540, height: 640)
        let wv = WKWebView(frame: frame, configuration: config)
        wv.navigationDelegate = self
        wv.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) {
            wv.underPageBackgroundColor = .clear
        }
        self.view = wv
        self.webView = wv
#elseif os(iOS)
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        self.view = wv
        self.webView = wv
#endif
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadMainContent()
    }

    func loadMainContent() {
        let bundle = Bundle.main
        var htmlContent: String?
        var baseURL: URL? = bundle.resourceURL

        if let url = bundle.url(forResource: "Main", withExtension: "html") ??
                     bundle.url(forResource: "Main", withExtension: "html", subdirectory: "Base.lproj") {
            htmlContent = try? String(contentsOf: url, encoding: .utf8)
            baseURL = url.deletingLastPathComponent()
        }

        if let html = htmlContent {
            self.webView.loadHTMLString(html, baseURL: baseURL)
        } else if let resourcePath = bundle.path(forResource: "Main", ofType: "html") {
            if let html = try? String(contentsOfFile: resourcePath, encoding: .utf8) {
                self.webView.loadHTMLString(html, baseURL: bundle.resourceURL)
            }
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
            window.backgroundColor = NSColor(red: 11/255.0, green: 14/255.0, blue: 20/255.0, alpha: 1.0)
            window.setContentSize(NSSize(width: 540, height: 640))
            window.minSize = NSSize(width: 480, height: 500)
            window.center()
        }
        loadMainContent()
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
