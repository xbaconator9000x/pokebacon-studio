import Foundation
import Network

// A fixed loopback origin keeps IndexedDB projects stable across launches.
// Only bundled public editor resources are served; no Documents or ROM files.
final class AssetServer {
    static let port: UInt16 = 18743
    static let origin = URL(string: "http://127.0.0.1:\(port)")!
    private let root: URL
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "dev.pokebacon.assets")
    init(root: URL) { self.root = root.resolvingSymlinksInPath() }
    func start(ready: @escaping (Error?) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .loopback
        let listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: Self.port)!)
        self.listener = listener
        var delivered = false
        listener.stateUpdateHandler = { state in
            guard !delivered else { return }
            switch state {
            case .ready: delivered = true; DispatchQueue.main.async { ready(nil) }
            case .failed(let error): delivered = true; DispatchQueue.main.async { ready(error) }
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { connection.cancel(); return }
            connection.start(queue: self.queue)
            self.receive(connection, data: Data())
            self.queue.asyncAfter(deadline: .now() + 15) { connection.cancel() }
        }
        listener.start(queue: queue)
    }
    private func receive(_ connection: NWConnection, data: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] chunk, _, complete, error in
            guard let self else { connection.cancel(); return }
            var data = data
            data.append(chunk ?? Data())
            if data.count > 16384 { self.respond(connection, status: "431 Request Header Fields Too Large"); return }
            if data.range(of: Data("\r\n\r\n".utf8)) != nil { self.serve(connection, request: data); return }
            if complete || error != nil { connection.cancel(); return }
            self.receive(connection, data: data)
        }
    }
    private func serve(_ connection: NWConnection, request: Data) {
        guard let text = String(data: request, encoding: .utf8) else { respond(connection, status: "400 Bad Request"); return }
        let lines = text.components(separatedBy: "\r\n")
        let first = (lines.first ?? "").split(separator: " ")
        guard first.count == 3, ["GET", "HEAD"].contains(String(first[0])) else { respond(connection, status: "405 Method Not Allowed"); return }
        let headers = lines.dropFirst().reduce(into: [String: String]()) { result, line in
            if let i = line.firstIndex(of: ":") { result[line[..<i].lowercased()] = line[line.index(after: i)...].trimmingCharacters(in: .whitespaces) }
        }
        guard headers["host"] == "127.0.0.1:\(Self.port)" else { respond(connection, status: "403 Forbidden"); return }
        let raw = String(first[1]).components(separatedBy: "?")[0]
        guard raw.hasPrefix("/"), let path = raw.removingPercentEncoding, !path.contains("\0"), !path.split(separator: "/").contains("..") else { respond(connection, status: "403 Forbidden"); return }
        let relative = path == "/" ? "index.html" : String(path.dropFirst())
        let file = root.appendingPathComponent(relative).resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file, options: .mappedIfSafe) else { respond(connection, status: "404 Not Found"); return }
        let types = ["html":"text/html", "js":"text/javascript", "css":"text/css", "json":"application/json", "webmanifest":"application/manifest+json", "wasm":"application/wasm", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "svg":"image/svg+xml", "webp":"image/webp", "gif":"image/gif", "mp3":"audio/mpeg", "wav":"audio/wav", "mid":"audio/midi"]
        respond(connection, status: "200 OK", body: data, mime: types[file.pathExtension.lowercased()] ?? "application/octet-stream", head: first[0] == "HEAD")
    }
    private func respond(_ connection: NWConnection, status: String, body: Data = Data(), mime: String = "text/plain", head: Bool = false) {
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n".utf8)
        if !head { response.append(body) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
    deinit { listener?.cancel() }
}
