import XCTest
import WebKit
@testable import PokeBaconStudio

final class SmokeTests: XCTestCase {
    @MainActor func testOfflineEditorBootsWithPersistentStorageAndNativeBridge() async throws {
        let window = try XCTUnwrap(UIApplication.shared.windows.first(where: { $0.isKeyWindow }))
        let editor = try XCTUnwrap(window.rootViewController as? EditorViewController)
        let web = try XCTUnwrap(editor.web)
        var ready = false
        for _ in 0..<120 {
            if let value = try? await web.evaluateJavaScript("typeof window.mapStudioBack === 'function'"), value as? Bool == true { ready = true; break }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        XCTAssertTrue(ready, "Bundled editor must boot without internet")
        let capabilities = try await web.evaluateJavaScript("JSON.stringify({secure:isSecureContext,crypto:!!crypto.subtle,wasm:typeof WebAssembly==='object',idb:!!indexedDB,bridge:typeof NativeBridge.exportBlob==='function'})")
        let text = try XCTUnwrap(capabilities as? String)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Bool])
        for key in ["secure", "crypto", "wasm", "idb", "bridge"] { XCTAssertEqual(object[key], true, key) }
        let result = try await web.callAsyncJavaScript("return await new Promise((resolve,reject)=>{const r=indexedDB.open('ios-smoke',1);r.onupgradeneeded=()=>r.result.createObjectStore('test');r.onsuccess=()=>{r.result.close();resolve(true)};r.onerror=()=>reject(r.error.message)})", arguments: [:], in: nil, contentWorld: .page)
        XCTAssertEqual(result as? Bool, true)
    }
}
