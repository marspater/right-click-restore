//
//  ViewController.swift
//  Shared (App)
//
//  Created by Mars Pater on 2026-08-20.
//

import SwiftUI
import SafariServices

// Dynamic bundle identifier derived from host app container
private var extensionBundleIdentifier: String {
    if let bundleId = Bundle.main.bundleIdentifier {
        return bundleId.hasSuffix(".Extension") ? bundleId : "\(bundleId).Extension"
    }
    return "com.antigravity.RightClickRestore.Extension"
}

// MARK: - Extension State Model

enum ExtensionState: Equatable {
    case checking
    case enabled
    case disabled
    case unavailable(String)
}

// MARK: - SwiftUI Onboarding View (Apple HIG Compliant)

struct ContentView: View {
    @State private var state: ExtensionState = .checking
    @State private var isChecking = false

    var body: some View {
        VStack(spacing: 20) {
            // Header: App Icon & Title
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.blue, Color.cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 64, height: 64)
                    .shadow(color: Color.blue.opacity(0.35), radius: 10, x: 0, y: 5)

                Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(spacing: 6) {
                Text("RightClickRestore")
                    .font(.title2.weight(.bold))

                Text("Restores right-click context menus, text selection, and copy operations across hostile websites.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }

            // Live Extension Status Card
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 10, height: 10)

                    if state == .enabled {
                        Circle()
                            .stroke(statusColor.opacity(0.4), lineWidth: 3)
                            .frame(width: 18, height: 18)
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

                Button(action: checkExtensionState) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .semibold))
                        .rotationEffect(.degrees(isChecking ? 360 : 0))
                        .animation(isChecking ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: isChecking)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .help("Refresh extension status")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.primary.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
            .frame(maxWidth: 330)

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
            .frame(maxWidth: 330)

            // HIG Calm Tip
            Text("💡 Tip: Hold Shift while right-clicking anywhere to force native menus.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(28)
        .frame(width: 380, height: 380)
        .background(.ultraThinMaterial)
        .onAppear {
            checkExtensionState()
        }
        #if os(macOS)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            checkExtensionState()
        }
        #elseif os(iOS)
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            checkExtensionState()
        }
        #endif
    }

    private var statusColor: Color {
        switch state {
        case .enabled:
            return .green
        case .disabled:
            return .orange
        case .checking:
            return .gray
        case .unavailable:
            return .red
        }
    }

    private var statusTitle: String {
        switch state {
        case .enabled:
            return "Extension is Active in Safari"
        case .disabled:
            return "Extension Not Enabled"
        case .checking:
            return "Checking Safari Status…"
        case .unavailable:
            return "Extension Unavailable"
        }
    }

    private var statusSubtitle: String {
        switch state {
        case .enabled:
            return "Protection is active on all web pages."
        case .disabled:
            return "Turn on in Safari > Settings > Extensions."
        case .checking:
            return "Querying macOS Extension Manager…"
        case .unavailable(let reason):
            return reason
        }
    }

    private func checkExtensionState() {
        guard !isChecking else { return }
        isChecking = true

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { safariState, error in
            DispatchQueue.main.async {
                isChecking = false
                if let error = error {
                    self.state = .unavailable(error.localizedDescription)
                } else if let safariState = safariState {
                    self.state = safariState.isEnabled ? .enabled : .disabled
                } else {
                    self.state = .disabled
                }
            }
        }
    }

    private func openSafariPreferences() {
        #if os(macOS)
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if error != nil {
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

        self.view.subviews.forEach { $0.removeFromSuperview() }
        self.view.wantsLayer = true

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
            window.setContentSize(NSSize(width: 380, height: 380))
            window.minSize = NSSize(width: 380, height: 380)
            window.maxSize = NSSize(width: 380, height: 380)
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
