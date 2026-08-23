//
//  ViewController.swift
//  Shared (App)
//
//  Created by Mars Pater on 2026-08-20.
//

import SwiftUI
import SafariServices

let extensionBundleIdentifier = "com.antigravity.RightClickRestore.Extension"

// MARK: - SwiftUI Onboarding View (Apple HIG Compliant)

struct ContentView: View {
    @State private var isExtensionEnabled: Bool? = nil
    @State private var isChecking = false
    @State private var timer: Timer? = nil

    var body: some View {
        VStack(spacing: 22) {
            // Header: Vibrant App Icon & Branding
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.blue, Color.cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 68, height: 68)
                    .shadow(color: Color.blue.opacity(0.35), radius: 12, x: 0, y: 6)

                Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(spacing: 6) {
                Text("RightClickRestore")
                    .font(.title2.weight(.bold))

                Text("Restores right-click context menus, text selection, and copy operations across hostile websites.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            // Live Extension Status Card
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 12, height: 12)

                    if isExtensionEnabled == true {
                        Circle()
                            .stroke(statusColor.opacity(0.4), lineWidth: 4)
                            .frame(width: 20, height: 20)
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(statusTitle)
                        .font(.system(size: 13, weight: .semibold))

                    Text(statusSubtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button(action: {
                    checkExtensionState()
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .semibold))
                        .rotationEffect(.degrees(isChecking ? 360 : 0))
                        .animation(isChecking ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: isChecking)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .help("Refresh extension status")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.primary.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
            .frame(maxWidth: 340)

            // Primary Action Button
            Button(action: openSafariPreferences) {
                HStack(spacing: 8) {
                    Text("Manage Extension in Safari…")
                        .fontWeight(.semibold)
                    Image(systemName: "arrow.up.right.square")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .frame(maxWidth: 340)

            // HIG Calm Tip
            Text("💡 Tip: Hold Shift or Option while right-clicking to force native menus.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(32)
        .frame(minWidth: 400, minHeight: 390)
        .background(.ultraThinMaterial)
        .onAppear {
            checkExtensionState()
            startPeriodicCheck()
        }
        .onDisappear {
            timer?.invalidate()
        }
    }

    private var statusColor: Color {
        switch isExtensionEnabled {
        case true:
            return .green
        case false:
            return .orange
        case nil:
            return .gray
        }
    }

    private var statusTitle: String {
        switch isExtensionEnabled {
        case true:
            return "Extension is Active in Safari"
        case false:
            return "Extension Not Enabled"
        case nil:
            return "Checking Safari Status…"
        }
    }

    private var statusSubtitle: String {
        switch isExtensionEnabled {
        case true:
            return "Protection is active on all web pages."
        case false:
            return "Turn on in Safari > Settings > Extensions."
        case nil:
            return "Querying macOS Safari Extension Manager…"
        }
    }

    private func checkExtensionState() {
        isChecking = true
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            DispatchQueue.main.async {
                isChecking = false
                if let state = state, error == nil {
                    self.isExtensionEnabled = state.isEnabled
                } else {
                    self.isExtensionEnabled = false
                }
            }
        }
    }

    private func startPeriodicCheck() {
        timer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: true) { _ in
            checkExtensionState()
        }
    }

    private func openSafariPreferences() {
        #if os(macOS)
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if error != nil {
                // Fallback deep-link directly to Safari Settings > Extensions on macOS
                if let url = URL(string: "x-apple.systempreferences:com.apple.Safari-Settings.extension.pref") ?? URL(string: "x-apple.systempreferences:com.apple.Safari.Extensions") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
        #elseif os(iOS)
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
        #endif
    }
}

// MARK: - AppKit View Controller (macOS)

#if os(macOS)
import Cocoa

class ViewController: NSViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // Clear any placeholder subviews from storyboard
        self.view.subviews.forEach { $0.removeFromSuperview() }
        self.view.wantsLayer = true

        // Embed SwiftUI ContentView
        let hostingView = NSHostingView(rootView: ContentView())
        hostingView.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(hostingView)

        NSLayoutConstraint.activate([
            hostingView.topAnchor.constraint(equalTo: self.view.topAnchor),
            hostingView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            hostingView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            hostingView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor)
        ])
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        if let window = self.view.window {
            window.title = "RightClickRestore"
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.styleMask.insert(.fullSizeContentView)
            window.isMovableByWindowBackground = true
            window.setContentSize(NSSize(width: 400, height: 400))
            window.minSize = NSSize(width: 380, height: 380)
            window.maxSize = NSSize(width: 460, height: 460)
            window.center()
        }
    }
}

// MARK: - UIKit View Controller (iOS)

#elseif os(iOS)
import UIKit

class ViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        self.view.subviews.forEach { $0.removeFromSuperview() }

        let hostingController = UIHostingController(rootView: ContentView())
        addChild(hostingController)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: self.view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: self.view.trailingAnchor)
        ])

        hostingController.didMove(toParent: self)
    }
}
#endif
