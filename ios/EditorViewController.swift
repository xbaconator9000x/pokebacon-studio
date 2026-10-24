import UIKit
import WebKit
import AVFoundation

final class EditorViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, UIDocumentPickerDelegate {
    private(set) var web: WKWebView!
    private var server: AssetServer?
    private var output: FileHandle?
    private var exportURL: URL?
    private var expected = 0
    private var received = 0
    private var share = false
    private var presentingExport = false
    private let back = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.09, green: 0.16, blue: 0.13, alpha: 1)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "studioExport")
        if let url = Bundle.main.url(forResource: "Bridge", withExtension: "js"), let js = try? String(contentsOf: url, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        web.isInspectable = true
        #endif
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        // Native escape route remains available even when a nested editor covers the toolbar.
        back.setTitle("‹ Back", for: .normal)
        back.accessibilityLabel = "Back one screen"
        back.tintColor = UIColor(red: 0.9, green: 0.94, blue: 0.84, alpha: 1)
        back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
        back.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(back)
        NSLayoutConstraint.activate([
            back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            back.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            back.heightAnchor.constraint(equalToConstant: 36),
            web.topAnchor.constraint(equalTo: back.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        do {
            guard let root = Bundle.main.url(forResource: "Web", withExtension: nil) else { throw CocoaError(.fileNoSuchFile) }
            let server = AssetServer(root: root)
            self.server = server
            try server.start { [weak self] error in
                if let error { self?.failure("The editor could not start: \(error.localizedDescription)") }
                else { self?.web.load(URLRequest(url: AssetServer.origin.appendingPathComponent("index.html"))) }
            }
        } catch { failure("The bundled editor could not be opened. \(error.localizedDescription)") }
    }
    @objc private func goBack() { web.evaluateJavaScript("window.mapStudioBack?.()") }
    private func isLocal(_ url: URL?) -> Bool {
        url?.scheme == "http" && url?.host == "127.0.0.1" && url?.port == Int(AssetServer.port)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if isLocal(action.request.url) { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if action.navigationType == .linkActivated, let url = action.request.url, ["https", "http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["https", "http"].contains(url.scheme ?? ""), !isLocal(url) { UIApplication.shared.open(url) }
        return nil
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        failure("The editor ran out of resources. Reopen it to restore the last saved project.")
    }
    private func failure(_ text: String) {
        let alert = UIAlertController(title: "PokéBacon Studio", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, isLocal(web.url), message.frameInfo.securityOrigin.host == "127.0.0.1", message.frameInfo.securityOrigin.port == Int(AssetServer.port), let body = message.body as? [String: Any], let action = body["action"] as? String else { replyHandler(nil, "Untrusted export request."); return }
        do {
            switch action {
            case "begin":
                guard output == nil, !presentingExport, let name = body["name"] as? String, !name.isEmpty, name.count <= 180, URL(fileURLWithPath: name).lastPathComponent == name, !name.contains("/"), !name.contains("\\"), name != ".", name != "..", let size = body["size"] as? Int, (0...100*1024*1024).contains(size) else { throw ExportError.invalid }
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let url = directory.appendingPathComponent(name)
                guard FileManager.default.createFile(atPath: url.path, contents: nil) else { throw ExportError.invalid }
                output = try FileHandle(forWritingTo: url)
                exportURL = url; expected = size; received = 0; share = body["share"] as? Bool ?? false
            case "chunk":
                guard let output, let encoded = body["data"] as? String, encoded.count <= 700000, let data = Data(base64Encoded: encoded), received + data.count <= expected else { throw ExportError.invalid }
                try output.write(contentsOf: data); received += data.count
            case "finish":
                guard let output, received == expected, let url = exportURL else { throw ExportError.invalid }
                try output.close(); self.output = nil; presentingExport = true
                if share {
                    let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                    sheet.popoverPresentationController?.sourceView = back
                    sheet.popoverPresentationController?.sourceRect = back.bounds
                    sheet.completionWithItemsHandler = { [weak self] _, done, _, error in self?.result(done, error?.localizedDescription ?? (done ? "File shared." : "Sharing cancelled.")); self?.cleanup() }
                    present(sheet, animated: true)
                } else {
                    let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                    picker.delegate = self; present(picker, animated: true)
                }
            case "abort": if !presentingExport { cleanup() }
            default: throw ExportError.invalid
            }
            replyHandler(["ok": true], nil)
        } catch { if !presentingExport { cleanup() }; replyHandler(nil, "Could not export the file. Finish any open save sheet and check available storage.") }
    }
    private enum ExportError: Error { case invalid }
    private func result(_ ok: Bool, _ message: String) {
        let data = try? JSONSerialization.data(withJSONObject: ["ok": ok, "message": message])
        if let data, let json = String(data: data, encoding: .utf8) { web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-file-result',{detail:\(json)}))") }
    }
    private func cleanup() {
        try? output?.close(); output = nil
        if let url = exportURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        exportURL = nil; presentingExport = false
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { result(true, "File saved."); cleanup() }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { result(false, "Save cancelled."); cleanup() }
}
