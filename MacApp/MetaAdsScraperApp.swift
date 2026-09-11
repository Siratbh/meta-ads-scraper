import Foundation
import SwiftUI
import WebKit

@main
struct MetaAdsScraperApp: App {
    @StateObject private var server = LocalServer.shared
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup("AdScope") {
            ContentView(server: server)
                .frame(minWidth: 1100, minHeight: 760)
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Reload Dashboard") {
                    server.reloadToken = UUID()
                }
                .keyboardShortcut("r", modifiers: [.command])
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        LocalServer.shared.stop()
    }
}

enum LocalServerState: Equatable {
    case starting
    case ready(URL)
    case failed(String)
}

@MainActor
final class LocalServer: ObservableObject {
    static let shared = LocalServer()

    @Published var state: LocalServerState = .starting
    @Published var reloadToken = UUID()

    private var process: Process?
    private var ownsProcess = false
    private var bootTask: Task<Void, Never>?
    private let port = 3000

    func start() {
        guard bootTask == nil else { return }
        state = .starting
        bootTask = Task { [weak self] in
            await self?.boot()
        }
    }

    func stop() {
        bootTask?.cancel()
        bootTask = nil
        if ownsProcess, let process, process.isRunning {
            process.terminate()
        }
        process = nil
        ownsProcess = false
    }

    func retry() {
        stop()
        start()
    }

    private func boot() async {
        let dashboardURL = URL(string: "http://127.0.0.1:\(port)")!

        if await isHealthy() {
            state = .ready(dashboardURL)
            bootTask = nil
            return
        }

        let root = repositoryRoot()
        let packageJSON = root.appendingPathComponent("package.json")
        let nodeModules = root.appendingPathComponent("node_modules")
        guard FileManager.default.fileExists(atPath: packageJSON.path),
              FileManager.default.fileExists(atPath: nodeModules.path) else {
            state = .failed("The local project or node_modules folder could not be found at \(root.path).")
            bootTask = nil
            return
        }

        let child = Process()
        child.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        child.arguments = ["npm", "run", "dev", "--", "-p", String(port)]
        child.currentDirectoryURL = root

        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        environment["BROWSER"] = "none"
        environment["NEXT_TELEMETRY_DISABLED"] = "1"
        child.environment = environment

        let output = Pipe()
        child.standardOutput = output
        child.standardError = output

        do {
            try child.run()
        } catch {
                state = .failed("Could not start AdScope's local engine: \(error.localizedDescription)")
            bootTask = nil
            return
        }

        process = child
        ownsProcess = true

        for _ in 0..<60 {
            if Task.isCancelled { return }
            if await isHealthy() {
                state = .ready(dashboardURL)
                bootTask = nil
                return
            }
            try? await Task.sleep(for: .milliseconds(500))
        }

        state = .failed("The local engine did not become ready. Run `npm run dev` in the project folder to inspect the error.")
        bootTask = nil
    }

    private func isHealthy() async -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)/api/health") else { return false }
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    private func repositoryRoot() -> URL {
        if let configured = ProcessInfo.processInfo.environment["META_ADS_SCRAPER_ROOT"] {
            return URL(fileURLWithPath: configured, isDirectory: true)
        }

        var candidate = Bundle.main.bundleURL.deletingLastPathComponent()
        for _ in 0..<6 {
            if FileManager.default.fileExists(atPath: candidate.appendingPathComponent("package.json").path) {
                return candidate
            }
            candidate.deleteLastPathComponent()
        }

        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    }
}

struct ContentView: View {
    @ObservedObject var server: LocalServer

    var body: some View {
        Group {
            switch server.state {
            case .starting:
                VStack(spacing: 14) {
                    ProgressView()
                        .controlSize(.large)
                    Text("Starting the local scraper…")
                        .font(.headline)
                    Text("Playwright and SQLite stay on this Mac.")
                        .foregroundStyle(.secondary)
                }

            case .ready(let url):
                LocalWebView(url: url, reloadToken: server.reloadToken)

            case .failed(let message):
                VStack(spacing: 14) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 32))
                        .foregroundStyle(.orange)
                    Text("Could not start AdScope")
                        .font(.headline)
                    Text(message)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: 620)
                    Button("Try Again", action: server.retry)
                        .keyboardShortcut(.defaultAction)
                }
                .padding(32)
            }
        }
        .onAppear {
            server.start()
        }
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    server.reloadToken = UUID()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("Reload dashboard")
                .disabled(!isReady)
            }
        }
    }

    private var isReady: Bool {
        if case .ready = server.state { return true }
        return false
    }
}

struct LocalWebView: NSViewRepresentable {
    let url: URL
    let reloadToken: UUID

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastReloadToken != reloadToken else { return }
        context.coordinator.lastReloadToken = reloadToken
        webView.reload()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(reloadToken: reloadToken)
    }

    final class Coordinator {
        var lastReloadToken: UUID

        init(reloadToken: UUID) {
            self.lastReloadToken = reloadToken
        }
    }
}
