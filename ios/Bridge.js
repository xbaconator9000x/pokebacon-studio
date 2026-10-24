(() => {
  if (!window.webkit?.messageHandlers?.studioExport) return;
  let busy = false;
  window.NativeBridge = {
    platform: 'ios',
    async exportBlob(blob, name, share = false) {
      if (busy) throw Error('Finish the current export first.');
      if (blob.size > 100 * 1024 * 1024) throw Error('This export is too large. Export individual maps instead.');
      busy = true;
      const send = body => window.webkit.messageHandlers.studioExport.postMessage(body);
      try {
        await send({action: 'begin', name, size: blob.size, share});
        for (let offset = 0; offset < blob.size; offset += 512 * 1024) {
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob.slice(offset, offset + 512 * 1024));
          });
          await send({action: 'chunk', data});
        }
        await send({action: 'finish'});
      } catch (error) {
        await send({action: 'abort'}).catch(() => {});
        throw error;
      } finally { busy = false; }
    }
  };
})();
