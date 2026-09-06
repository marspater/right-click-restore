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
}

// MARK: - SwiftUI Onboarding View (Apple HIG Compliant)

struct ContentView: View {
    @State private var state: ExtensionState = .checking
    @State private var isChecking = false

    var body: some View {
        VStack(spacing: 18) {
            // Header: App Icon & Title
            VStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.0, green: 0.48, blue: 1.0),
                                    Color(red: 0.0, green: 0.38, blue: 0.8)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 64, height: 64)
                        .shadow(color: Color.blue.opacity(0.28), radius: 8, x: 0, y: 4)

                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundStyle(.white)
                }

                VStack(spacing: 4) {
                    Text("RightClickRestore")
                        .font(.system(size: 19, weight: .bold))
                        .tracking(-0.2)

                    Text("Restores right-click menus, text selection, and copy operations across hostile websites.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 300)
                }
            }

            // Live Extension Status Card
            HStack(spacing: 12) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 9, height: 9)

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
                        .font(.system(size: 12, weight: .semibold))
                        .rotationEffect(.degrees(isChecking ? 360 : 0))
                        .animation(isChecking ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: isChecking)
                        .padding(4)
                        .contentShape(Rectangle())
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
                    .stroke(Color.primary.opacity(0.08), lineWidth: 0.5)
            )
            .frame(maxWidth: 320)

            // Primary Action Button
            Button(action: openSafariPreferences) {
                HStack(spacing: 6) {
                    Text("Manage in Safari Extensions…")
                        .font(.system(size: 13, weight: .semibold))
                    Image(systemName: "arrow.up.right.square")
                        .font(.system(size: 12, weight: .medium))
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.regular)
            .frame(maxWidth: 320)

            // Calm Shortcut Tip
            Text("Tip: Hold ⇧ Shift while clicking to summon native menu anywhere")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(width: 360, height: 360)
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
            return .blue
        case .checking:
            return .gray
        }
    }

    private var statusTitle: String {
        switch state {
        case .enabled:
            return "Extension is Active in Safari"
        case .disabled:
            return "Ready to Enable in Safari"
        case .checking:
            return "Checking Safari Status…"
        }
    }

    private var statusSubtitle: String {
        switch state {
        case .enabled:
            return "Protection is active on all web pages."
        case .disabled:
            return "Click below to open Safari Settings and check the box."
        case .checking:
            return "Querying Safari extension status…"
        }
    }

    private func checkExtensionState() {
        guard !isChecking else { return }
        isChecking = true

        // Timeout safeguard to prevent indefinite hang if extension query stalls
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            if self.isChecking {
                self.isChecking = false
                if self.state == .checking {
                    self.state = .disabled
                }
            }
        }

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { safariState, _ in
            DispatchQueue.main.async {
                self.isChecking = false
                if let safariState = safariState, safariState.isEnabled {
                    self.state = .enabled
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
            window.setContentSize(NSSize(width: 360, height: 360))
            window.minSize = NSSize(width: 360, height: 360)
            window.maxSize = NSSize(width: 360, height: 360)
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
