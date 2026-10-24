package dev.shattered.mapstudio.next;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerClient;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private static final int PICK_FILE = 110, SAVE_FILE = 111;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingBytes;
    private String pendingName;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final android.os.Handler ui = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean healthRunning=false,healthWaiting=false,recoveryShowing=false;
    private int backRequest=0;
    private String lastHealth="{}";
    private long lastHealthAt=0;
    private final Runnable healthTick=new Runnable(){@Override public void run(){
        if(!healthRunning||web==null)return;
        if(!healthWaiting){healthWaiting=true;web.evaluateJavascript("window.mapStudioHealth ? JSON.stringify(window.mapStudioHealth()) : null",value->{healthWaiting=false;try{Object decoded=new org.json.JSONTokener(value).nextValue();if(decoded instanceof String){lastHealth=(String)decoded;lastHealthAt=android.os.SystemClock.elapsedRealtime();}}catch(Exception ignored){}});}
        ui.postDelayed(this,3000);
    }};

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(24,41,34));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(232,236,230));
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left,i.top,i.right,i.bottom);
                return insets;
            });
        }
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        web.addJavascriptInterface(new Bridge(),"NativeBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if("https".equals(uri.getScheme())&&ORIGIN.equals(uri.getHost()))return false;
                if(request.hasGesture()&&("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))) {
                    try {startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
                }
                return true;
            }
        });
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request){return serveAsset(request);}
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] accepted=params.getAcceptTypes();
                boolean images=false;
                if(accepted!=null)for(String a:accepted)if(a!=null&&a.startsWith("image/"))images=true;
                if(images){intent.setType("image/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg","image/webp","image/gif"});}
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(intent,PICK_FILE);}catch(Exception error){fileCallback.onReceiveValue(null);fileCallback=null;notifyResult(false,"The file picker could not be opened.");}
                return true;
            }
        });
        web.loadUrl("https://"+ORIGIN+"/assets/index.html");
        if (!getPreferences(MODE_PRIVATE).getBoolean("migration-notice-seen",false)) {
            new AlertDialog.Builder(this)
                .setTitle("Welcome to Shattered Studio 4.5.0")
                .setMessage("This app includes visual scenes, NPC and item makers, selective music import, opening/credits tools and custom options. It updates Shattered Studio 3.1 and 3.2 in place. If you used the older Shattered Map Studio app, it installs alongside it.\n\nTo bring your work across, open the old app and export each project, then choose Import a project here. For saved custom objects and terrain, export and import My library too.\n\nKeep the old app until you have checked your imported work.")
                .setPositiveButton("Start editing",(dialog,which)->getPreferences(MODE_PRIVATE).edit().putBoolean("migration-notice-seen",true).apply())
                .setCancelable(false)
                .show();
        }
    }

    private WebResourceResponse serveAsset(WebResourceRequest request){
                Uri uri=request.getUrl();
                if (!"https".equals(uri.getScheme()) || !ORIGIN.equals(uri.getHost())) {
                    if ("data".equals(uri.getScheme()) || "blob".equals(uri.getScheme())) return null;
                    return missing();
                }
                String path=uri.getPath();
                if(path==null || !path.startsWith("/assets/") || path.contains(".."))return missing();
                path=path.substring(8); if(path.isEmpty())path="index.html";
                try {
                    String mime=mime(path);
                    HashMap<String,String> headers=new HashMap<>();
                    headers.put("Cache-Control","no-cache");
                    headers.put("X-Content-Type-Options","nosniff");
                    return new WebResourceResponse(mime,mime.startsWith("text/")||mime.contains("json")||mime.contains("javascript")?"UTF-8":null,200,"OK",headers,getAssets().open(path));
                } catch(IOException error) { return missing(); }

    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new HashMap<>(),new ByteArrayInputStream(new byte[0]));
    }
    private static String mime(String name) {
        name=name.toLowerCase(Locale.ROOT);
        if(name.endsWith(".html"))return "text/html";
        if(name.endsWith(".js"))return "text/javascript";
        if(name.endsWith(".wasm"))return "application/wasm";
        if(name.endsWith(".css"))return "text/css";
        if(name.endsWith(".json")||name.endsWith(".webmanifest"))return "application/json";
        if(name.endsWith(".png"))return "image/png";
        if(name.endsWith(".svg"))return "image/svg+xml";
        if(name.endsWith(".jpg")||name.endsWith(".jpeg"))return "image/jpeg";
        if(name.endsWith(".webp"))return "image/webp";
        return "text/plain";
    }
    private String safeName(String value) {
        String name=value.replaceAll("[^a-zA-Z0-9_. -]","_");
        if(name.length()>140)name=name.substring(0,140);
        if(name.isEmpty()||name.startsWith("."))name="map_export"+name;
        return name;
    }
    private void notifyResult(boolean ok,String message) {
        runOnUiThread(()->{
            try{
                JSONObject info=new JSONObject();info.put("ok",ok);info.put("message",message);
                web.evaluateJavascript("window.dispatchEvent(new CustomEvent('native-file-result',{detail:"+info.toString()+"}))",null);
            }catch(Exception ignored){}
            Toast.makeText(this,message,Toast.LENGTH_LONG).show();
        });
    }
    public class Bridge {
        @JavascriptInterface public void saveFile(String name,String encoded,String type){export(name,encoded,type,false);}
        @JavascriptInterface public void shareFile(String name,String encoded,String type){export(name,encoded,type,true);}
    }
    private void export(String requestedName,String encoded,String type,boolean share){
        if(encoded.length()>140*1024*1024){notifyResult(false,"This export is too large. Export individual maps instead.");return;}
        final String name=safeName(requestedName);
        final String mimeType=type!=null&&type.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")?type:"application/octet-stream";
        io.execute(()->{
            try{
                byte[] data=Base64.decode(encoded,Base64.DEFAULT);
                if(share){
                    File directory=new File(getCacheDir(),"exports");if(!directory.exists())directory.mkdirs();
                    File file=new File(directory,name);try(FileOutputStream stream=new FileOutputStream(file)){stream.write(data);}
                    Uri uri=Uri.parse("content://"+getPackageName()+".files/"+Uri.encode(name));
                    runOnUiThread(()->{
                        Intent intent=new Intent(Intent.ACTION_SEND);intent.setType(mimeType);intent.putExtra(Intent.EXTRA_STREAM,uri);intent.setClipData(ClipData.newRawUri(name,uri));intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try{startActivity(Intent.createChooser(intent,"Share "+name));}catch(Exception error){notifyResult(false,"No app can share this file. Use Save file instead.");}
                    });
                }else if(Build.VERSION.SDK_INT>=29){
                    ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,name);values.put(MediaStore.MediaColumns.MIME_TYPE,mimeType);values.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/Shattered Map Studio");values.put(MediaStore.MediaColumns.IS_PENDING,1);
                    Uri uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
                    if(uri==null)throw new IOException("Could not create download");
                    try{
                        try(OutputStream stream=getContentResolver().openOutputStream(uri)){if(stream==null)throw new IOException("Could not open download");stream.write(data);}
                        values.clear();values.put(MediaStore.MediaColumns.IS_PENDING,0);getContentResolver().update(uri,values,null,null);
                    }catch(Exception error){getContentResolver().delete(uri,null,null);throw error;}
                    notifyResult(true,"Saved to Downloads / Shattered Map Studio / "+name);
                }else{
                    runOnUiThread(()->{
                        if(pendingBytes!=null){notifyResult(false,"Finish the current save first.");return;}
                        pendingBytes=data;pendingName=name;
                        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(mimeType);intent.putExtra(Intent.EXTRA_TITLE,name);
                        try{startActivityForResult(intent,SAVE_FILE);}catch(Exception error){pendingBytes=null;notifyResult(false,"Could not open the save picker.");}
                    });
                }
            }catch(Exception error){notifyResult(false,"Could not export the file. Check available storage and try again.");}
        });
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_FILE&&fileCallback!=null){
            Uri[] uris=null;
            if(result==RESULT_OK&&data!=null){ClipData clip=data.getClipData();if(clip!=null){uris=new Uri[clip.getItemCount()];for(int i=0;i<uris.length;i++)uris[i]=clip.getItemAt(i).getUri();}else if(data.getData()!=null)uris=new Uri[]{data.getData()};}
            fileCallback.onReceiveValue(uris);fileCallback=null;
        }
        if(request==SAVE_FILE){final byte[] bytes=pendingBytes;final String name=pendingName;pendingBytes=null;pendingName=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){final Uri uri=data.getData();io.execute(()->{try(OutputStream stream=getContentResolver().openOutputStream(uri)){if(stream==null)throw new IOException();stream.write(bytes);notifyResult(true,"Saved "+name);}catch(Exception error){notifyResult(false,"Could not save the file.");}});}}
    }
    private void copyDiagnostics(){
        try{JSONObject report=new JSONObject();report.put("appVersion","4.5.0");report.put("android",Build.VERSION.RELEASE);report.put("model",Build.MANUFACTURER+" "+Build.MODEL);
            android.content.pm.PackageInfo provider=WebView.getCurrentWebViewPackage();report.put("webView",provider==null?"unknown":provider.packageName+" "+provider.versionName);
            report.put("lastResponseAgeMs",lastHealthAt==0?-1:android.os.SystemClock.elapsedRealtime()-lastHealthAt);
            report.put("lastEditorState",new org.json.JSONTokener(lastHealth).nextValue());
            android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);clipboard.setPrimaryClip(ClipData.newPlainText("Shattered Studio diagnostics",report.toString(2)));Toast.makeText(this,"Diagnostics copied. Paste them into your bug report.",Toast.LENGTH_LONG).show();
        }catch(Exception error){Toast.makeText(this,"Could not copy diagnostics.",Toast.LENGTH_LONG).show();}
    }
    private void editorRecovery(boolean stalled){
        if(recoveryShowing||isFinishing())return;recoveryShowing=true;
        new AlertDialog.Builder(this).setTitle(stalled?"Editor is not responding":"Editor controls")
            .setItems(new String[]{"Restore controls (keep work open)","Copy diagnostics","Reload last saved project","Close app"},(dialog,which)->{
                if(which==0)web.evaluateJavascript("window.mapStudioRecover && window.mapStudioRecover()",null);
                else if(which==1)copyDiagnostics();
                else if(which==2)new AlertDialog.Builder(this).setTitle("Reload editor?").setMessage("The last saved project will reopen. Unsaved edits may be lost.").setPositiveButton("Reload",(d,w)->{healthWaiting=false;web.reload();}).setNegativeButton("Cancel",null).show();
                else finish();
            }).setNegativeButton("Cancel",null).setOnDismissListener(d->recoveryShowing=false).show();
    }
    @Override public void onBackPressed(){
        final int ticket=++backRequest;final Runnable watchdog=()->{if(ticket==backRequest){backRequest++;editorRecovery(true);}};ui.postDelayed(watchdog,2500);
        web.evaluateJavascript("Boolean(window.mapStudioBack && window.mapStudioBack())",handled->{if(ticket!=backRequest)return;backRequest++;ui.removeCallbacks(watchdog);if(!"true".equals(handled))editorRecovery(false);});
    }
    @Override protected void onPause(){healthRunning=false;ui.removeCallbacks(healthTick);if(web!=null){web.evaluateJavascript("window.mapStudioSuspend && window.mapStudioSuspend()",null);web.onPause();}super.onPause();}
    @Override protected void onResume(){super.onResume();healthRunning=true;ui.removeCallbacks(healthTick);ui.post(healthTick);if(web!=null){web.onResume();web.evaluateJavascript("window.mapStudioResume && window.mapStudioResume()",null);}}
    @Override public void onTrimMemory(int level){super.onTrimMemory(level);if(level>=TRIM_MEMORY_RUNNING_LOW&&web!=null)web.post(()->web.evaluateJavascript("window.mapStudioTrimMemory && window.mapStudioTrimMemory()",null));}
    @Override protected void onDestroy(){healthRunning=false;ui.removeCallbacksAndMessages(null);if(fileCallback!=null)fileCallback.onReceiveValue(null);io.shutdown();web.removeJavascriptInterface("NativeBridge");web.destroy();super.onDestroy();}
}
