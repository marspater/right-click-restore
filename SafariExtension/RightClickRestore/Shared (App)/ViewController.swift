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
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

#if os(macOS)
    override func viewWillAppear() {
        super.viewWillAppear()
        if let window = self.view.window {
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.styleMask.insert(.fullSizeContentView)
            window.isMovableByWindowBackground = true
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

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let command = message.body as? String else { return }

#if os(macOS)
        switch command {
        case "open-preferences":
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
                if error != nil {
                    // Fallback to opening Safari
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
